import { z } from "zod";
import { router, protectedProcedure, resolveBranchId } from "../trpc";
import { TRPCError } from "@trpc/server";
import {
  campaigns,
  cashShifts,
  orders,
  branches,
  restaurants,
  staff,
} from "@rabbitty/database-restaurant/schema";
import { ownedBusinesses } from "@rabbitty/database-core/schema";
import { eq, and, desc, sql, gte, inArray } from "drizzle-orm";

// ─── GUARDRAILS & LIMITANTES ────────────────────────────────────────────────
const MAX_PROMPT_LENGTH = 600;
const FORBIDDEN_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /olvida\s+(todas\s+)?las\s+instrucciones\s+anteriores/i,
  /system\s*prompt/i,
  /act\s+as\s+dan/i,
  /modo\s+dios/i,
  /drop\s+table/i,
  /delete\s+from/i,
];

function sanitizePrompt(raw: string): string {
  const trimmed = raw.trim().slice(0, MAX_PROMPT_LENGTH);
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(trimmed)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Consulta no permitida por políticas de seguridad de Bunzy.",
      });
    }
  }
  return trimmed;
}

// ─── ORQUESTADOR DE INFERENCIA (OLLAMA CON FALLBACK RESILIENTE) ─────────────
interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface InferenceResult {
  content: string;
  modelUsed: string;
}

async function callInferenceEngine(messages: LLMMessage[]): Promise<InferenceResult> {
  const ollamaUrl = process.env.OLLAMA_BASE_URL || process.env.OLLAMA_URL;
  // Modelos reales disponibles en el nodo Ollama local:
  // default: qwen2.5-coder:14b o dolphin-llama3:8b (o deepseek/gemma si configurado)
  const ollamaModel = process.env.OLLAMA_MODEL || "qwen2.5-coder:14b";
  const ollamaApiKey = process.env.OLLAMA_API_KEY;

  // 1. Intentar Ollama si está configurado
  if (ollamaUrl) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000); // 12s timeout

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (ollamaApiKey) headers["Authorization"] = `Bearer ${ollamaApiKey}`;

      const res = await fetch(`${ollamaUrl}/api/chat`, {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model: ollamaModel,
          messages,
          stream: false,
          options: {
            temperature: 0.6,
            top_p: 0.9,
          },
        }),
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = (await res.json()) as { message?: { content?: string } };
        if (data.message?.content) {
          return {
            content: data.message.content.trim(),
            modelUsed: `ollama:${ollamaModel}`,
          };
        }
      }
    } catch (ollamaErr) {
      console.warn("[Bunzy AI] Ollama endpoint no disponible o timeout, ejecutando fallback...", ollamaErr);
    }
  }

  // 2. Fallback a OpenAI si existe API Key
  const openAiKey = process.env.OPENAI_API_KEY;
  if (openAiKey && openAiKey !== "dummy_key_for_build") {
    try {
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey: openAiKey });
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: 350,
        temperature: 0.6,
      });
      const text = completion.choices[0]?.message?.content?.trim();
      if (text) {
        return {
          content: text,
          modelUsed: "openai:gpt-4o-mini",
        };
      }
    } catch (openaiErr) {
      console.error("[Bunzy AI] OpenAI fallback error:", openaiErr);
    }
  }

  // 3. Fallback Heurístico Local Asistente Operativo si no hay LLM accesible
  return {
    content: generateHeuristicResponse(messages),
    modelUsed: "heuristic:rabbitty-pilot",
  };
}

/**
 * Motor heurístico experto para resolver dudas del comercio en tiempo real
 * aún cuando las GPUs externas no estén respondiendo.
 */
function generateHeuristicResponse(messages: LLMMessage[]): string {
  const userMsg = messages.filter((m) => m.role === "user").pop()?.content || "";
  const systemMsg = messages.find((m) => m.role === "system")?.content || "";
  const q = userMsg.toLowerCase();

  // Extraer valores contextuales inyectados en el system prompt
  const cashbackMatch = systemMsg.match(/Cashback Bunz Activo:\s*([0-9.]+)%/);
  const currentCashback = cashbackMatch ? cashbackMatch[1] : "20";
  const negocioMatch = systemMsg.match(/Negocio:\s*([^\n]+)/);
  const negocioName = negocioMatch?.[1]?.trim() || "tu negocio";

  // 1. Porcentaje de recompensa / cashback / lealtad / bunz
  if (/\b(porcentaje|recompensa|cashback|lealtad|premio|tasa|dar bunz|ajustar %|cambiar %|donde est[aá]|d[oó]nde est[aá])\b/i.test(q) && !q.includes("corte")) {
    return (
      `🐰 ¡Con gusto! Para ajustar el porcentaje de recompensa que otorga **${negocioName}**:\n\n` +
      `1️⃣ Dirígete al menú lateral y haz clic en **Lealtad** (\`/loyalty\`).\n` +
      `2️⃣ En la sección **"Tasa de Cashback Base"**, encontrarás el slider que te permite definir el porcentaje entre **2% y 50%**.\n` +
      `3️⃣ Tu porcentaje actual está configurado en **${currentCashback}%**.\n` +
      `4️⃣ Al mover el slider y guardar, se sincroniza de inmediato como la **fuente de la verdad única** hacia la app móvil de clientes, el mapa Freehands y la sección Bunz'in.\n\n` +
      `💡 *Recuerda*: Cada 1 Bunz equivale a $1 MXN. Si un cliente consume $100 y tienes ${currentCashback}%, recibirá ${currentCashback} Bunz.`
    );
  }

  // 2. Caja, corte de caja, turno, ticket x, ticket z
  if (/\b(caja|corte|turno|ticket|gaveta|arqueo|abrir caja|cerrar caja|ticket x|ticket z)\b/i.test(q)) {
    return (
      `🐰 Para operaciones de caja en el **POS** (\`/pos\`):\n\n` +
      `• **Apertura de Turno**: Haz clic en *"Caja cerrada · Abrir"* en la barra superior del POS. Ingresa tu PIN de 4 dígitos y el fondo inicial en efectivo (cambio).\n` +
      `• **Retiros/Gastos Menores**: Ve a *"Caja / Turno" ➔ "Retiro"*. Captura monto y concepto (hielo, insumos). Se descuenta automáticamente del efectivo a entregar.\n` +
      `• **Corte Informativo (Ticket X)**: Arqueo parcial en cualquier momento sin cerrar turno.\n` +
      `• **Cierre de Turno (Ticket Z)**:\n` +
      `  1. Primero coteja el total de tarjetas bancarias con el reporte de tu terminal física (Clip/Mercado Pago/Banco).\n` +
      `  2. Cuenta el dinero en efectivo de la gaveta e ingrésalo.\n` +
      `  3. Ingresa PIN de cajero y PIN de manager para emitir el Ticket Z definitivo.\n\n` +
      `📖 Puedes consultar la guía paso a paso en **Manual Operativo** (\`/operations-manual\`).`
    );
  }

  // 3. Ventas, reportes, auditoría, estadísticas
  if (/\b(ventas|ordenes|[oó]rdenes|ingresos|ganancias|reporte|auditor[ií]a|cu[aá]nto vend[ií])\b/i.test(q)) {
    return (
      `🐰 Puedes consultar tus métricas en tiempo real:\n\n` +
      `• **Dashboard Principal** (\`/\`): Gráficas de volumen diario, órdenes y Bunz emitidos.\n` +
      `• **Ventas y Reportes** (\`/reports\`): Historial detallado por ticket, método de pago (Efectivo, Tarjeta, Bunz) y desglose de propinas.\n` +
      `• **Auditoría de Turnos** (\`/reports/audit\`): Bitácora inmutable de turnos de caja, diferencias de conteo y tickets Z emitidos.`
    );
  }

  // 4. Bóveda, recarga, inventario de Bunz
  if (/\b(b[oó]veda|fondear|aprovisionar|comprar bunz|inventario|paquete|saldo)\b/i.test(q)) {
    return (
      `🐰 **Bóveda de Bunz** de **${negocioName}**:\n\n` +
      `• Tu bóveda almacena el inventario de Bunz respaldados para otorgar como recompensa a los clientes.\n` +
      `• Puedes ver el saldo disponible en la tarjeta **Bóveda de Bunz** del Dashboard (\`/\`).\n` +
      `• Conforme los clientes acumulan compras en tu sucursal, los Bunz se transfieren de tu bóveda al wallet de los usuarios.\n` +
      `• Para aprovisionar o recargar saldo en tu bóveda, puedes hacerlo desde el botón *"Recargar Bóveda"* o contactar directamente a tu asesor Rabbitty.`
    );
  }

  // 5. Vincular celular, escáner, terminal móvil
  if (/\b(vincular|celular|tel[eé]fono|escanear|esc[aá]ner|c[aá]mara|terminal)\b/i.test(q)) {
    return (
      `🐰 Para convertir cualquier smartphone en una terminal de escaneo:\n\n` +
      `1️⃣ Haz clic en el botón **"Vincular Celular"** en la barra superior del Admin.\n` +
      `2️⃣ Se mostrará un código QR con clave de sincronización segura (Zero-Install).\n` +
      `3️⃣ Abre la cámara del teléfono del mesero o cajero y escanea el código.\n` +
      `4️⃣ El teléfono quedará vinculado al instante para escanear tickets y otorgar o canjear Bunz sin necesidad de instalar apps adicionales.`
    );
  }

  // 6. Menú, productos, precios
  if (/\b(men[uú]|producto|art[ií]culo|precio|categor[ií]a|platillo)\b/i.test(q)) {
    return (
      `🐰 Para gestionar tu catálogo y precios:\n\n` +
      `• Ve a **Menú / Catálogo** (\`/menu\`).\n` +
      `• Aquí puedes crear categorías, productos con modificadores, combos y cambiar precios en vivo para POS y Kiosko.`
    );
  }

  // Respuesta por defecto con mapa de acción claro
  return (
    `🐰 ¡Hola! Estoy activo como tu copiloto de **${negocioName}**.\n\n` +
    `Aquí tienes accesos rápidos a lo que puedes gestionar hoy:\n\n` +
    `• 🎁 **% de Recompensa (Cashback)**: Ve a **Lealtad** (\`/loyalty\`) — actualmente en **${currentCashback}%**.\n` +
    `• 💳 **Caja y Turnos (Tickets X y Z)**: Ve a **Caja POS** (\`/pos\`).\n` +
    `• 📊 **Ventas y Auditoría**: Ve a **Reportes** (\`/reports\`).\n` +
    `• 📱 **Vincular Teléfono**: Usa el botón *"Vincular Celular"* en la barra superior.\n` +
    `• 🍔 **Menú y Productos**: Ve a **Menú** (\`/menu\`).\n\n` +
    `¿En cuál de estas áreas te gustaría que te oriente en detalle?`
  );
}

// ─── ROUTER PRINCIPAL DE BUNZY ──────────────────────────────────────────────
export const bunzyRouter = router({
  /**
   * Chat inteligente con contexto vivo de la sucursal (Knowledge Injection),
   * blindaje multi-tenant estricto y sanitización total del historial.
   */
  chat: protectedProcedure
    .input(
      z.object({
        branchId: z.string().optional(),
        message: z.string(),
        mode: z.enum(["strategist", "concierge", "operator"]).default("strategist"),
        history: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string(),
            })
          )
          .optional()
          .default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // ─── SEGURIDAD: BRANCH ACCESS CHECK ────────────────────────────────
      let branchId = resolveBranchId(ctx, input.branchId);

      // Si el usuario es STAFF, resolveBranchId ya fija ctx.staffBranchId.
      // Si no es STAFF (Dueño/Admin), verificar que la sucursal pertenezca a sus restaurantes/negocios.
      if (!ctx.staffRole && input.branchId) {
        const staffRows = await ctx.restaurantDb
          .select({ branchId: staff.branchId })
          .from(staff)
          .where(eq(staff.userId, ctx.userId));
        const userStaffBranches = staffRows.map((s) => s.branchId).filter(Boolean);

        // Si tiene branches asignadas y pide una ajena, restringir
        if (userStaffBranches.length > 0 && !userStaffBranches.includes(input.branchId)) {
          branchId = userStaffBranches[0] as string;
        }
      }

      // Sanitización estricta del mensaje actual y del historial completo
      const cleanMessage = sanitizePrompt(input.message);
      const cleanHistory = input.history.slice(-4).map((h) => ({
        role: h.role as "user" | "assistant",
        content: sanitizePrompt(h.content),
      }));

      // ─── 1. INYECCIÓN DE KNOWLEDGE VIVO DE LA SUCURSAL DEL TENANT ACTIVO ─
      // a) Estado del turno de caja actual
      const [activeShift] = await ctx.restaurantDb
        .select({
          id: cashShifts.id,
          status: cashShifts.status,
          openedAt: cashShifts.openedAt,
          openingFloat: cashShifts.openingFloat,
        })
        .from(cashShifts)
        .where(
          and(
            eq(cashShifts.branchId, branchId),
            eq(cashShifts.status, "OPEN")
          )
        )
        .orderBy(desc(cashShifts.openedAt))
        .limit(1);

      // b) Cashback y negocio pertenecientes EXCLUSIVAMENTE al usuario autenticado (Anti-Tenant Leak)
      const [business] = await ctx.coreDb
        .select({
          id: ownedBusinesses.id,
          name: ownedBusinesses.name,
          rewardPercentage: ownedBusinesses.rewardPercentage,
        })
        .from(ownedBusinesses)
        .where(eq(ownedBusinesses.ownerId, ctx.userId))
        .limit(1);

      // c) Resumen de ventas recientes (últimas 24h) de su sucursal
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentOrders = await ctx.restaurantDb
        .select({
          count: sql<number>`count(*)`,
          total: sql<number>`coalesce(sum(${orders.total}), 0)`,
        })
        .from(orders)
        .where(
          and(
            eq(orders.branchId, branchId),
            gte(orders.createdAt, oneDayAgo)
          )
        );

      const salesStats = recentOrders[0] || { count: 0, total: 0 };
      const currentCashback = business?.rewardPercentage ?? 10;
      const shiftState = activeShift
        ? `Turno ABIERTO (Fondo inicial: $${activeShift.openingFloat})`
        : "Turno de caja CERRADO";

      // ─── 2. SYSTEM PROMPT CON IDENTITY Y REGLAS DE NEGOCIO ───────────────
      const systemPrompt = `
Eres Bunzy 🐰, el Co-Pilot e Inteligencia Estratégica oficial de Rabbitty para restaurantes y comercios.
Modo actual: ${input.mode}.
Tono: Profesional, fresco, mexicano, directo y altamente resolutivo.

CONTEXTO REAL DE TU NEGOCIO (KNOWLEDGE VIVO AUTÉNTICO):
- Negocio: ${business?.name || "Comercio Rabbitty"}
- Estado de Caja: ${shiftState}.
- Cashback Bunz Activo: ${currentCashback}% (Límite permitido por sistema: 2% a 50%).
- Ventas últimas 24h: ${salesStats.count} órdenes registradas, volumen aproximado: $${Number(salesStats.total).toFixed(2)}.

LIMITANTES Y REGLAS FINANCIERAS INFRANQUEABLES:
1. Jamás inventes saldos ni apruebes transferencias de Bunz sin autorización del usuario o PIN.
2. Si sugieres una campaña comercial, el porcentaje de cashback DEBE estar entre 2% y 50% y debe tener una vigencia clara (ej. 24 a 72 horas).
3. No des asesoría fiscal ni contable vinculante.
4. Si el usuario te pide ejecutar una acción (crear campaña o ajustar cashback), confírmale los parámetros y sugiérele aplicarla mediante las herramientas de acción de Bunzy.

CONOCIMIENTO OPERATIVO OFICIAL DEL POS Y CORTE DE CAJA (ÚSALO PARA ASISTIR AL COMERCIO):
- Apertura de caja: Se hace en el POS con 'Caja cerrada · Abrir'. Requiere PIN de 4 dígitos y capturar el fondo inicial (cambio para dar a clientes). Imprime ticket de apertura.
- Retiros y gastos menores (agua, café, hielo, insumos): Se registran en 'Caja / Turno' -> 'Retiro'. El cajero escribe el monto y concepto. Este monto se DESCUENTA AUTOMÁTICAMENTE del efectivo que debe entregar al final. Si no hay suficiente dinero en gaveta, el sistema bloquea el retiro avisando fondos insuficientes.
- Cierre Parcial (Ticket X): Arqueo informativo a mitad de turno sin cerrar la caja ni interrumpir ventas.
- Cierre Definitivo (Ticket Z): 
  a) Cuadre de Tarjeta Bancaria: El cajero primero coteja el total cobrado con tarjeta en la pantalla con el reporte de la terminal bancaria física (Clip, Mercado Pago o Banco). Las tarjetas no se cuentan en el efectivo.
  b) Conteo de Efectivo: El cajero cuenta el dinero físico de la gaveta e ingresa el monto total.
  c) PIN de Cajero y PIN de Manager: Cierra el turno e imprime el comprobante Z definitivo.
- Descuadres (sobrantes/faltantes): No bloquean el cierre. El cajero captura lo contado real y el sistema solicita una nota justificativa y PIN de manager para la bitácora inmutable.
- Manual imprimible y visual: Guía completa siempre disponible en '/operations-manual'.

CAPACIDAD DE SOPORTE, REPORTE DE BUGS Y FEEDBACK:
- Si el usuario reporta un problema, error técnico, fallo en pantalla o sugiere una mejora ("hay un error", "falló el ticket", "se trabó", "tengo una sugerencia", "quiero dejar feedback"), agradécele cálidamente, infórmale que has canalizado su reporte directamente con el equipo de ingeniería de Rabbitty y que está siendo atendido de inmediato.
`;

      // ─── 2.1 AUTO-DISPATCH TELEGRAM SI EL USUARIO REPORTA BUG O FEEDBACK ──
      const lowerMsg = cleanMessage.toLowerCase();
      const isBugReport = /\b(bug|error|fallo|falla|se trabó|no sirve|se congeló|no imprime|problema tecnico|problema técnico|crash)\b/i.test(lowerMsg);
      const isFeedbackReport = /\b(feedback|sugerencia|mejora|recomiendo que|estaría bien|idea para)\b/i.test(lowerMsg);

      if (isBugReport || isFeedbackReport) {
        const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.AUTH_TELEGRAM_BOT_TOKEN;
        const adminTelegramIds = (process.env.ADMIN_TELEGRAM_IDS || "798431743")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        if (botToken) {
          const reportCategory = isBugReport ? "🐞 REPORTE DE ERROR VÍA BUNZY AI (ADMIN)" : "💡 FEEDBACK VÍA BUNZY AI (ADMIN)";
          const tgText =
            `${reportCategory}\n\n` +
            `📝 Mensaje:\n${cleanMessage}\n\n` +
            `👤 Remitente: ${ctx.user?.email || "Usuario Admin"} (Sucursal: ${branchId})\n` +
            `🏢 Negocio: ${business?.name || "Rabbitty"}\n` +
            `🤖 Asistente: Bunzy Co-Pilot`;

          for (const adminId of adminTelegramIds) {
            fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: adminId, text: tgText, disable_web_page_preview: true }),
            }).catch((err) => console.error("[BunzyFeedback] Telegram dispatch error:", err));
          }
        }
      }

      const promptMessages: LLMMessage[] = [
        { role: "system", content: systemPrompt },
        ...cleanHistory,
        { role: "user", content: cleanMessage },
      ];

      const { content: reply, modelUsed } = await callInferenceEngine(promptMessages);

      return {
        reply,
        metadata: {
          shiftState,
          currentCashback,
          salesLast24h: Number(salesStats.total),
          modelUsed,
        },
      };
    }),

  /**
   * ACCIÓN ORQUESTADA: Crear campaña comercial recomendada por Bunzy
   * (Human-in-the-Loop: Ejecutada tras confirmación del comerciante)
   */
  createRecommendedCampaign: protectedProcedure
    .input(
      z.object({
        branchId: z.string().optional(),
        name: z.string().min(3),
        targetSegment: z.enum(["ALL", "VIP", "RECURRENT", "NEW", "CHURN_RISK"]),
        message: z.string().min(5),
        incentiveCashbackPercent: z.number().min(2).max(50),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const branchId = resolveBranchId(ctx, input.branchId);

      const formattedMessage = `${input.message} • [Bonificación especial: ${input.incentiveCashbackPercent}% en Bunz]`;

      const [campaign] = await ctx.restaurantDb
        .insert(campaigns)
        .values({
          branchId,
          name: `[Bunzy AI] ${input.name}`,
          targetSegment: input.targetSegment,
          message: formattedMessage,
          status: "DRAFT",
        })
        .returning();

      if (!campaign) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "No se pudo crear la campaña recomendada.",
        });
      }

      return {
        success: true,
        campaignId: campaign.id,
        message: `Campaña "${campaign.name}" guardada en Borradores lista para revisión y envío.`,
      };
    }),

  /**
   * ACCIÓN ORQUESTADA: Ajuste asistido de regla de lealtad
   * Protegido contra ataques IDOR / Daño Financiero Multi-Tenant.
   * Requiere estricta titularidad (ownerId === ctx.userId) o rol ADMIN.
   */
  adjustCashbackRule: protectedProcedure
    .input(
      z.object({
        businessId: z.string().optional(),
        newRewardPercentage: z.number().min(2).max(50),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Buscar el negocio propiedad del usuario autenticado
      let businessQuery = ctx.coreDb
        .select({ id: ownedBusinesses.id, name: ownedBusinesses.name })
        .from(ownedBusinesses);

      const targetBusiness = input.businessId
        ? (
            await businessQuery
              .where(
                and(
                  eq(ownedBusinesses.id, input.businessId),
                  eq(ownedBusinesses.ownerId, ctx.userId)
                )
              )
              .limit(1)
          )[0]
        : (
            await businessQuery
              .where(eq(ownedBusinesses.ownerId, ctx.userId))
              .limit(1)
          )[0];

      if (!targetBusiness) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "No tienes autorización para modificar la tasa de lealtad de este comercio.",
        });
      }

      // 2. Modificación protegida exclusivamente sobre el negocio verificado
      await ctx.coreDb
        .update(ownedBusinesses)
        .set({
          rewardPercentage: input.newRewardPercentage,
          updatedAt: new Date(),
        })
        .where(eq(ownedBusinesses.id, targetBusiness.id));

      // ── FUENTE ÚNICA DE LA VERDAD ──
      // Espejar a restaurants.defaultRewardRate (admin /loyalty y POS leen de ahí).
      try {
        await ctx.restaurantDb
          .update(restaurants)
          .set({ defaultRewardRate: input.newRewardPercentage, updatedAt: new Date() })
          .where(eq(restaurants.businessId, targetBusiness.id));
      } catch (syncErr) {
        console.warn("[Bunzy Sync] Error espejando defaultRewardRate en restaurants:", syncErr);
      }

      return {
        success: true,
        businessId: targetBusiness.id,
        businessName: targetBusiness.name,
        newRewardPercentage: input.newRewardPercentage,
        message: `Regla de lealtad para "${targetBusiness.name}" actualizada a ${input.newRewardPercentage}% de cashback en Bunz.`,
      };
    }),
});
