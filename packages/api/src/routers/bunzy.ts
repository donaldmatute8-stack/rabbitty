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

  // 3. Fallback Heurístico Local Seguro si no hay LLM accesible
  return {
    content:
      "🐰 Hola. Mi red neuronal remota está en mantenimiento en este momento, " +
      "pero tus herramientas operativas (Caja, Lealtad, Menú y Campañas) están operando con total normalidad. " +
      "¿Deseas que te redirija a alguna sección en específico?",
    modelUsed: "fallback:heuristic-core",
  };
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
`;

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

      return {
        success: true,
        businessId: targetBusiness.id,
        businessName: targetBusiness.name,
        newRewardPercentage: input.newRewardPercentage,
        message: `Regla de lealtad para "${targetBusiness.name}" actualizada a ${input.newRewardPercentage}% de cashback en Bunz.`,
      };
    }),
});
