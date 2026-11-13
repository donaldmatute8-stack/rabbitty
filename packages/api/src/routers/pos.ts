import { z } from "zod";
import { and, asc, desc, eq, sql, inArray, or, ilike, gte, gt, isNull, isNotNull } from "drizzle-orm";
import crypto from "crypto";
import { router, posProcedure, posPermission } from "../trpc";
import { validateGratuity, parseGratuityPcts, GRATUITY_MAX_PCT } from "../services/gratuityRules";
import { TRPCError } from "@trpc/server";
import { assertCardPaymentAllowed, isCardMethod } from "../services/cardGuard";
import { ORDER_STATUS, isCashPaymentRequested, isOrderPaidStatus, isOrderPayableStatus } from "../services/payments/contracts";
import * as dbSchema from "@rabbitty/database-restaurant";
import { bus, EventTypes } from "@rabbitty/events";
import { withOrderMutation, withOrderCreate, withOrderRollback } from "../services/orderIntegrity";
import { resolveStationsForItems } from "../services/stationRouting";
import { enqueueRealtimeEvent, stationChannel, drainRealtimeInBackground } from "../services/realtimeOutbox";
import { resolveBusinessIdFromBranch } from "../services/businessContext";
export { resolveBusinessIdFromBranch };
import { deriveOrderStage, type OrderStage, orderStageStepIndex } from "@rabbitty/events";
import { tables as tablesTable, tableSessions, branches, menuCategories, menuItems, orders, orderItems, deliveries, payments, menuItemModifiers, restaurants, events as posEvents, paymentIntents, bunzReserves, bunzRedemptionAttempts, bunzLedgerEntries, bunzObligations, bunzObligationEvents, bunzEconomicLimits, bunzControlState, posChargeRequests } from "@rabbitty/database-restaurant/schema";
import { DELIVERY_PROVIDERS, canTransition, getProvider, type DeliveryStatus } from "../services/deliveryProviders";
import {
  uberDirectConfigured,
  uberQuote,
  uberCreateDelivery,
  uberCancelDelivery,
  mapUberStatus,
  type UberAddress,
} from "../services/uberDirect";
import { users as coreUsers, systemSettings, ownedBusinesses as coreBusinesses, membershipSubscriptions as coreMembershipSubs, membershipEntitlements as coreMembershipEnts, entitlementUsages as coreEntUsages } from "@rabbitty/database-core/schema";
/** Split DIVIDIDA activo? */
function pendingSplit(input: { splitBunz?: number; splitCash?: number }): boolean {
  return typeof input.splitBunz === "number" && input.splitBunz > 0;
}

import { miniappClient } from "../services/miniapp-client";
import { assertOpenShiftForCash } from "../services/cashShift";
import { REDEMPTION_REASONS, recordEmissionBooks, recordRedemptionBooks } from "../services/bunzBooks";
import { isSandboxLedgerTx } from "../services/ledgerSubjects";
import { accrueCommission } from "../services/bunzObligations";
import { checkOperation } from "../services/bunzControls";
import { recognizeActivity } from "../services/mcce";


/**
 * USD: convierte monto MXN → USD con la tasa configurable por el admin
 * (restaurants.usdRateMode/usdRate; AUTO = API gratuita con caché).
 * Los mints de Bunz esperan amount_usd — no MXN.
 */
async function toUsdAmount(restaurantDb: any, branchId: string, mxn: number): Promise<number> {
  try {
    const [brRow] = await restaurantDb
      .select({ restaurantId: branches.restaurantId })
      .from(branches)
      .where(eq(branches.id, branchId))
      .limit(1);
    if (brRow?.restaurantId) {
      const { resolveUsdRate, mxnToUsd } = await import("../services/fx");
      const { rate } = await resolveUsdRate(restaurantDb, brRow.restaurantId);
      if (rate > 0) return mxnToUsd(mxn, rate);
    }
  } catch {
    console.warn("[USD] tasa no disponible, uso fallback 18 MXN/USD");
  }
  return Math.round((mxn / 18) * 100) / 100;
}

/**
 * Genera un claimToken criptográfico para el ticket de compra.
 * Formato: orderId.exp.hmac (de un solo uso, expira en 48 horas).
 */
/** Respuesta de un cobro ya completado con la misma clave de idempotencia. */
function completedCheckoutResponse(order: typeof orders.$inferSelect, fallbackBranchId: string) {
  return {
    success: true as const,
    orderId: order.id,
    orderNumber: order.id.slice(-4).toUpperCase(),
    total: order.total,
    subtotal: order.subtotal,
    tax: order.tax,
    customerName: order.customerName ?? null,
    awardedBunz: Number(order.bunzReward ?? 0),
    rewardQueued: Boolean(order.bunzReward && order.bunzReward > 0),
    claimToken: generateTicketClaimToken(order.id, order.total, order.branchId ?? fallbackBranchId),
    idempotent: true,
  };
}

export function generateTicketClaimToken(orderId: string, amount: number, branchId: string): string {
  const secret = process.env.RABBITTY_API_SECRET;
  if (!secret) {
    throw new Error("[SECURITY_CRITICAL] RABBITTY_API_SECRET environment variable is missing. Refusing to generate insecure ticket claim token.");
  }
  const exp = Math.floor(Date.now() / 1000) + 48 * 3600; // 48 horas
  const payload = `${orderId}:${amount}:${branchId}:${exp}`;
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex").slice(0, 16);
  return `${orderId}.${exp}.${sig}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FISCAL CANÓNICO (México IVA 16% incluido en precio)
//
// Regla: los precios del menú ya incluyen IVA (precio de venta al público).
//   total    = suma exacta de los items (sin redondeo adicional)
//   subtotal = Math.round((total / 1.16) * 100) / 100   → base gravable
//   tax      = total - subtotal                          → IVA exacto (NO redondear)
//
// Nunca redondear `tax` por separado. Así subtotal + tax === total siempre,
// sin centavos perdidos o inventados.
// ─────────────────────────────────────────────────────────────────────────────
const TAX_RATE = 0.16;
const r2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** Calcula base (subtotal), IVA y total a partir de los items de una orden.
 *  Garantía: subtotal + tax === total (sin discrepancias de redondeo). */
/** Identidad para la bitácora de órdenes: quién (empleado) y desde dónde (terminal). */
const posActor = (ctx: { posOperator?: { staffId?: string } | null; posAuth?: { terminalId?: string } | null }) => ({
  staffId: ctx.posOperator?.staffId ?? null,
  terminalId: ctx.posAuth?.terminalId ?? null,
});

export function calcTax(itemsTotal: number): { total: number; subtotal: number; tax: number } {
  const total = r2(itemsTotal);
  const subtotal = r2(total / (1 + TAX_RATE));
  const tax = r2(total - subtotal); // derived, never independently rounded from scratch
  return { total, subtotal, tax };
}


/**
 * Resuelve el id del NEGOCIO (ownedBusinesses.id) desde la branch del contexto.
 * La miniapp /api/pos/reward espera un businessId de negocio (su inventario Bunz
 * vive en ownedBusinesses) — un branchId jamás matcheará.
 */
const uberAddressSchema = z.object({
  street1: z.string().min(4).max(200),
  street2: z.string().max(200).optional(),
  neighborhood: z.string().max(120).optional(),
  city: z.string().min(2).max(120),
  state: z.string().min(2).max(120),
  zip: z.string().min(3).max(20),
  country: z.string().min(2).max(2).default("MX"),
  phone: z.string().max(30).optional(),
  notes: z.string().max(300).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

/**
 * Contexto para Uber Direct: pickup estructurado del negocio + dropoff del
 * pedido + items (manifest). Falla con mensajes accionables si falta algo.
 * `addressOverride` permite enviar a domicilio un pedido PARA LLEVAR que aún
 * no tenía dirección capturada.
 */
async function loadDeliveryContext(
  restaurantDb: any,
  coreDb: any,
  branchId: string,
  orderId: string,
  addressOverride?: UberAddress | null,
) {
  const [order] = await restaurantDb
    .select({
      id: orders.id,
      branchId: orders.branchId,
      orderType: orders.orderType,
      status: orders.status,
      total: orders.total,
      customerId: orders.customerId,
      customerName: orders.customerName,
      customerPhone: orders.customerPhone,
      deliveryAddress: orders.deliveryAddress,
      deliveryAddressData: orders.deliveryAddressData,
      deliveryFee: orders.deliveryFee,
      prepEtaMinutes: orders.prepEtaMinutes,
    })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.branchId, branchId)))
    .limit(1);
  if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Orden no encontrada" });
  if (order.orderType !== "DELIVERY" && order.orderType !== "TAKEAWAY") {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "El pedido no es a domicilio ni para llevar" });
  }

  const businessId = await resolveBusinessIdFromBranch(restaurantDb, branchId);
  const [biz] = businessId
    ? await coreDb
        .select({
          name: coreBusinesses.name,
          addressData: coreBusinesses.addressData,
          lat: coreBusinesses.lat,
          lng: coreBusinesses.lng,
        })
        .from(coreBusinesses)
        .where(eq(coreBusinesses.id, businessId))
        .limit(1)
    : [];

  const pickupData = (biz?.addressData ?? null) as UberAddress | null;
  if (!pickupData?.street1 || !pickupData?.city) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Configura la dirección estructurada del negocio (calle y ciudad) para usar Uber Direct.",
    });
  }

  const dropoffData = (addressOverride ?? order.deliveryAddressData ?? null) as UberAddress | null;
  if (!dropoffData?.street1 || !dropoffData?.city) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "El pedido no tiene dirección estructurada (calle, ciudad, estado, CP).",
    });
  }

  const items = await restaurantDb
    .select({ name: menuItems.name, quantity: orderItems.quantity })
    .from(orderItems)
    .innerJoin(menuItems, eq(orderItems.menuItemId, menuItems.id))
    .where(eq(orderItems.orderId, orderId))
    .limit(20);

  return {
    order,
    pickup: {
      ...pickupData,
      name: biz?.name ?? "Rabbitty",
      phone: pickupData.phone ?? null,
      lat: pickupData.lat ?? biz?.lat ?? null,
      lng: pickupData.lng ?? biz?.lng ?? null,
    } as UberAddress,
    dropoff: {
      ...dropoffData,
      name: order.customerName ?? undefined,
      phone: order.customerPhone ?? dropoffData.phone ?? undefined,
    } as UberAddress,
    items,
    businessId,
  };
}


export const posRouter = router({
  /**
   * Búsqueda e identificación inmediata de Rabbitter antes de cobrar:
   * Por QR personal (UUID / telegramId / username) o por teléfono.
   */


  /** Clientes con check-in activo en este negocio (últimas 2h) — presencia para el cajero. */

  /** Rabbitters que marcaron "Planeo ir" en las últimas 24h — el cajero los prepara. */
  getPlannedVisits: posProcedure.query(async ({ ctx }) => {
    const bizId = await resolveBusinessIdFromBranch(ctx.restaurantDb, ctx.branchId);
    if (!bizId) return [];
    const oneDayAgo = sql`(now() AT TIME ZONE 'UTC') - interval '24 hours'`;
    const rows = await ctx.coreDb.execute(
      sql`SELECT "userId", MAX("createdAt") AS at FROM "business_interactions"
          WHERE "businessId" = ${bizId} AND action = 'PLAN_VISIT' AND "userId" IS NOT NULL
            AND "createdAt" >= ${oneDayAgo}
          GROUP BY "userId" ORDER BY at DESC LIMIT 10`
    ).then((r: unknown) => ((r as { rows?: Array<{ userId: string; at: string }> }).rows || (r as unknown as Array<{ userId: string; at: string }>)));
    const out: Array<{ userId: string; name: string; at: string }> = [];
    for (const row of rows) {
      const [u] = await ctx.coreDb.select({ firstName: coreUsers.firstName, lastName: coreUsers.lastName, username: coreUsers.username })
        .from(coreUsers).where(eq(coreUsers.id, row.userId)).limit(1);
      out.push({
        userId: row.userId,
        name: [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.username || "Rabbitter",
        at: row.at,
      });
    }
    return out;
  }),

  getActiveCheckIns: posProcedure.query(async ({ ctx }) => {
    const bizId = await resolveBusinessIdFromBranch(ctx.restaurantDb, ctx.branchId);
    if (!bizId) return [];
    // Presencia REAL: sesiones abiertas cuyo último ping esté fresco (GPS pings + escaneos las refrescan)
    // Cutoff en SQL: el driver postgres.js no serializa objetos Date como
    // parámetros de sql`` (falla con ERR_INVALID_ARG_TYPE) — y así la
    // comparación usa timestamps naive UTC aunque cambie el TZ del servidor.
    const rows = await ctx.coreDb.execute(
      sql`SELECT "userId", GREATEST("lastPingAt", "startedAt") AS at,
                 EXTRACT(EPOCH FROM (now() - GREATEST("lastPingAt", "startedAt")))::int AS "ageSeconds"
          FROM "presenceSessions"
          WHERE "businessId" = ${bizId} AND "endedAt" IS NULL AND "lastPingAt" >= (now() AT TIME ZONE 'UTC') - interval '1 hour'
          ORDER BY "lastPingAt" DESC LIMIT 12`
    ).then((r: unknown) => ((r as { rows?: Array<{ payeeSubjectId: string; at: string; ageSeconds: number }> }).rows || (r as unknown as Array<{ payeeSubjectId: string; at: string; ageSeconds: number }>)).map((r: any) => ({ payeeSubjectId: `usr_${r.userId}`, at: r.at, ageSeconds: Number(r.ageSeconds ?? 9999) })));
    const out: Array<{ userId: string; name: string; username: string | null; at: string; ageSeconds: number }> = [];
    for (const row of rows) {
      const userId = (row.payeeSubjectId || "").replace(/^usr_/, "");
      if (!userId) continue;
      const [u] = await ctx.coreDb.select({ firstName: coreUsers.firstName, lastName: coreUsers.lastName, username: coreUsers.username })
        .from(coreUsers).where(eq(coreUsers.id, userId)).limit(1);
      out.push({
        userId,
        name: [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.username || "Rabbitter",
        username: u?.username ?? null,
        at: row.at,
        ageSeconds: row.ageSeconds,
      });
    }
    return out;
  }),

  lookupRabbitter: posProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      let raw = input.query.trim();
      // Extraer identificador si viene en formato URL / URI scheme (ej. rabbitty://pay?to=@username)
      if (raw.includes("to=")) {
        const match = raw.match(/[?&]to=([^&]+)/);
        if (match) raw = decodeURIComponent(match[1] ?? raw);
      } else if (raw.includes("user=")) {
        const match = raw.match(/[?&]user=([^&]+)/);
        if (match) raw = decodeURIComponent(match[1] ?? raw);
      } else if (raw.includes("phone=")) {
        const match = raw.match(/[?&]phone=([^&]+)/);
        if (match) raw = decodeURIComponent(match[1] ?? raw);
      }

      // Limpiar @ inicial si se ingresó o escaneó un handle
      const cleanQ = raw.replace(/^@/, "").trim();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanQ);

      const conditions = [
        eq(coreUsers.telegramId, cleanQ),
        eq(coreUsers.telegramId, raw),
        eq(coreUsers.phoneNumber, cleanQ),
        eq(coreUsers.phoneNumber, raw),
        ilike(coreUsers.username, cleanQ),
        ilike(coreUsers.username, raw),
      ];
      if (isUuid) {
        conditions.push(eq(coreUsers.id, cleanQ));
      }
      // Nombre/apellido (wizard de cortesías, search del POS): mínimo 3 chars para evitar ruido
      if (cleanQ.length >= 3) {
        conditions.push(ilike(coreUsers.firstName, cleanQ));
        conditions.push(ilike(coreUsers.lastName, cleanQ));
      }
      // Teléfono: se compara por dígitos y por los últimos 10. El cajero teclea
      // "322 274 1987" y la BD guarda "+5213222741987": el match exacto fallaba.
      const phoneDigits = cleanQ.replace(/\D/g, "");
      if (phoneDigits.length >= 8) {
        const tail = phoneDigits.slice(-10);
        conditions.push(
          sql`right(regexp_replace(COALESCE(${coreUsers.phoneNumber}, ''), '\\D', '', 'g'), 10) = ${tail}`,
        );
      }

      // RabbittyCode numérico (13 barras decodificadas o tecleado): match exacto por scanCode
      const numeric = /^\d{1,9}$/.test(cleanQ);
      if (numeric) {
        conditions.push(eq(coreUsers.scanCode, Number(cleanQ)));
      }

      // Priorizar: scanCode exacto > telegramId > phone > uuid > username > nombre
      const [user] = await ctx.coreDb
        .select({
          id: coreUsers.id,
          firstName: coreUsers.firstName,
          lastName: coreUsers.lastName,
          username: coreUsers.username,
          phoneNumber: coreUsers.phoneNumber,
          telegramId: coreUsers.telegramId,
          totalBunzEarned: coreUsers.totalBunzEarned,
          totalBunzSpent: coreUsers.totalBunzSpent,
          hops: coreUsers.hops,
          levelId: coreUsers.levelId,
        })
        .from(coreUsers)
        .where(or(...conditions))
        // ── Prioridad determinista: matches EXACTOS (identidad: username/scan/tel/uuid)
        // antes que fuzzy de nombre — evita wrong-match con homónimos ──
        .orderBy(sql`(
          CASE
            WHEN lower(${coreUsers.username}) = ${cleanQ.toLowerCase()} THEN 0
            WHEN "scanCode"::text = ${/^\d{1,9}$/.test(cleanQ) ? cleanQ : "\N"} THEN 1
            WHEN ${coreUsers.telegramId} = ${cleanQ} THEN 2
            WHEN regexp_replace(COALESCE(${coreUsers.phoneNumber}, ''), '\\D', '', 'g') = ${cleanQ.replace(/\D/g, "")} AND ${cleanQ.replace(/\D/g, "")} != '' THEN 3
            WHEN id = ${isUuid ? cleanQ : ""} THEN 4
            ELSE 5
          END) ASC, id ASC`)
        .limit(1);

      if (!user) {
        return null;
      }

      // Obtener porcentaje de cashback vigente de la sucursal actual
      const [branch] = await ctx.restaurantDb
        .select({ restaurantId: dbSchema.branches.restaurantId })
        .from(dbSchema.branches)
        .where(eq(dbSchema.branches.id, ctx.branchId))
        .limit(1);

      let rewardRate = 20;
      if (branch) {
        const [restaurant] = await ctx.restaurantDb
          .select({ defaultRewardRate: restaurants.defaultRewardRate })
          .from(restaurants)
          .where(eq(restaurants.id, branch.restaurantId))
          .limit(1);
        if (restaurant?.defaultRewardRate) {
          rewardRate = restaurant.defaultRewardRate;
        }
      }

      return {
        id: user.id,
        name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "Rabbitter",
        phoneNumber: user.phoneNumber,
        telegramId: user.telegramId,
        bunzBalance: Math.max(0, Number(user.totalBunzEarned || 0) - Number(user.totalBunzSpent || 0)),
        hops: user.hops,
        level: user.levelId || "Rookie",
        currentRewardRate: rewardRate,
      };
    }),

  /** POS: resuelve un código de negocio (QR del afiliado) para no confundirlo con un Rabbitter. */
  lookupBusinessByCode: posProcedure
    .input(z.object({ code: z.string().min(1).max(20) }))
    .query(async ({ ctx, input }) => {
      const code = Number(String(input.code).replace(/\D/g, ""));
      if (!code) return null;
      const [biz] = await ctx.coreDb
        .select({ id: coreBusinesses.id, name: coreBusinesses.name, scanCode: coreBusinesses.scanCode })
        .from(coreBusinesses)
        .where(eq(coreBusinesses.scanCode, code))
        .limit(1);
      return biz ?? null;
    }),

  /**
   * POS: pide autorización al Rabbitter ANTES de ejecutar el cobro.
   * Crea la solicitud con precios/nombres del menú server-side y envía un push
   * con deep-link /pay/confirm/<id>. El POS espera APPROVED para continuar.
   */
  requestChargeApproval: posPermission("POS_CHARGE")
    .input(z.object({
      customerId: z.string().uuid(),
      customerName: z.string().optional(),
      method: z.string().min(1).max(40),
      tipAmount: z.number().min(0).max(5000).default(0),
      items: z.array(z.object({
        menuItemId: z.string(),
        quantity: z.number().min(1),
        /** Precio unitario del POS (incluye modificadores); se valida el ítem. */
        unitPrice: z.number().min(0).optional(),
      })).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const [customer] = await ctx.coreDb
        .select({ id: coreUsers.id, firstName: coreUsers.firstName, lastName: coreUsers.lastName })
        .from(coreUsers)
        .where(eq(coreUsers.id, input.customerId))
        .limit(1);
      if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "Rabbitter no encontrado." });

      const menu = await ctx.restaurantDb
        .select({ id: menuItems.id, name: menuItems.name, price: menuItems.price })
        .from(menuItems)
        .where(eq(menuItems.branchId, ctx.branchId));
      const priceMap = new Map(menu.map((m: any) => [m.id, m]));

      const items = input.items.map((it) => {
        const m = priceMap.get(it.menuItemId);
        if (!m) throw new TRPCError({ code: "BAD_REQUEST", message: "Producto inválido para esta sucursal." });
        const unit = Number(it.unitPrice ?? m.price);
        return {
          name: String(m.name),
          quantity: Number(it.quantity),
          totalPrice: r2(unit * Number(it.quantity)),
        };
      });
      const subtotal = r2(items.reduce((sum, i) => sum + i.totalPrice, 0));
      const amount = r2(subtotal + Number(input.tipAmount || 0));
      if (amount <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "El cobro no tiene monto." });

      const [branch] = await ctx.restaurantDb
        .select({ restaurantId: branches.restaurantId })
        .from(branches)
        .where(eq(branches.id, ctx.branchId))
        .limit(1);
      const [rest] = branch?.restaurantId
        ? await ctx.restaurantDb
            .select({ name: restaurants.name })
            .from(restaurants)
            .where(eq(restaurants.id, branch.restaurantId))
            .limit(1)
        : [];
      const businessName = rest?.name || "Rabbitty";

      const [request] = await ctx.restaurantDb
        .insert(posChargeRequests)
        .values({
          branchId: ctx.branchId,
          customerId: input.customerId,
          staffId: ctx.userId ?? null,
          method: input.method,
          amount,
          tipAmount: Number(input.tipAmount || 0),
          items,
          businessName,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 2 * 60 * 1000),
        })
        .returning();
      if (!request) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No se pudo crear la solicitud." });

      const methodLabel =
        input.method === "BUNZ" ? "Pago con Bunz" :
        input.method === "DIVIDIDA" ? "Efectivo + Bunz" :
        input.method === "TARJETA_EXTERNA" ? "Tarjeta (terminal)" :
        input.method === "TARJETA" ? "Tarjeta" : "Efectivo";

      try {
        await miniappClient.sendNotification({
          userId: input.customerId,
          title: `🐰 Confirma tu cobro en ${businessName}`,
          message: `${methodLabel} · $${amount.toFixed(2)}. Abre Rabbitty y confirma para que el negocio cobre.`,
          type: "CHARGE_APPROVAL",
          route: `/pay/confirm/${request.id}`,
          dedupeKey: `charge_approval_${request.id}`,
          priority: "high",
        } as any);
      } catch (notifyErr) {
        console.warn("[POS] push de confirmación falló:", notifyErr);
      }

      return { requestId: request.id, amount, expiresAt: request.expiresAt, method: input.method };
    }),

  /** POS: estado de la solicitud (polling mientras espera al Rabbitter). */
  getChargeApproval: posProcedure
    .input(z.object({ requestId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [request] = await ctx.restaurantDb
        .select()
        .from(posChargeRequests)
        .where(and(eq(posChargeRequests.id, input.requestId), eq(posChargeRequests.branchId, ctx.branchId)))
        .limit(1);
      if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Solicitud no encontrada." });

      let status = request.status;
      if (status === "PENDING" && request.expiresAt < new Date()) {
        await ctx.restaurantDb
          .update(posChargeRequests)
          .set({ status: "EXPIRED", updatedAt: new Date() })
          .where(eq(posChargeRequests.id, request.id));
        status = "EXPIRED";
      }
      return {
        requestId: request.id,
        status,
        amount: request.amount,
        method: request.method,
        customerId: request.customerId,
        respondedAt: request.respondedAt,
      };
    }),

  /** POS: el cajero cancela la espera (el Rabbitter ya no puede aprobar). */
  cancelChargeApproval: posProcedure
    .input(z.object({ requestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.restaurantDb
        .update(posChargeRequests)
        .set({ status: "CANCELLED", updatedAt: new Date() })
        .where(and(
          eq(posChargeRequests.id, input.requestId),
          eq(posChargeRequests.branchId, ctx.branchId),
          eq(posChargeRequests.status, "PENDING"),
        ));
      return { ok: true };
    }),

  getTables: posProcedure.query(async ({ ctx }) => {
    const tables = await ctx.restaurantDb.select().from(tablesTable).where(eq(tablesTable.branchId, ctx.branchId));
    return tables;
  }),

  getTable: posProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const table = await ctx.restaurantDb.select().from(tablesTable).where(
        and(
          eq(tablesTable.id, input.id),
          eq(tablesTable.branchId, ctx.branchId)
        )
      );
      return table;
    }),

  getCategories: posProcedure.query(async ({ ctx }) => {
    const categories = await ctx.restaurantDb.select().from(menuCategories).where(
      eq(menuCategories.branchId, ctx.branchId)
    ).orderBy(asc(menuCategories.sortOrder));
    return categories;
  }),

  /**
   * GRATIFICACIONES VOLUNTARIAS (D-11): config del canal presencial.
   * Catálogo server-side (gratuityRules) — afiliado solo elige subconjunto [5,10,15]
   * y canal; NADA condicionado al método de pago. Disabled → Korean UI oculta fila.
   */
  /**
   * ── Aviso sonoro de pedidos (por restaurante) ──
   * Vive en systemSettings (core) para no tocar el esquema del restaurante:
   * key `pos_order_sound:<restaurantId>` = "on" | "off" (default: on).
   */
  getOrderAlertSettings: posProcedure.query(async ({ ctx }) => {
    try {
      const [branch] = await ctx.restaurantDb
        .select({ restaurantId: branches.restaurantId })
        .from(branches)
        .where(eq(branches.id, ctx.branchId))
        .limit(1);
      if (!branch?.restaurantId) return { soundEnabled: true };
      const [row] = await ctx.coreDb
        .select({ value: systemSettings.value })
        .from(systemSettings)
        .where(eq(systemSettings.key, `pos_order_sound:${branch.restaurantId}`))
        .limit(1);
      return { soundEnabled: row?.value !== "off" };
    } catch {
      return { soundEnabled: true };
    }
  }),

  setOrderAlertSound: posProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const [branch] = await ctx.restaurantDb
        .select({ restaurantId: branches.restaurantId })
        .from(branches)
        .where(eq(branches.id, ctx.branchId))
        .limit(1);
      if (!branch?.restaurantId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Esta sucursal no tiene restaurante asociado" });
      }
      const key = `pos_order_sound:${branch.restaurantId}`;
      const value = input.enabled ? "on" : "off";
      await ctx.coreDb
        .insert(systemSettings)
        .values({ key, value })
        .onConflictDoUpdate({ target: systemSettings.key, set: { value, updatedAt: new Date() } });
      return { success: true, soundEnabled: input.enabled };
    }),

  getGratuityConfig: posProcedure.query(async ({ ctx }) => {    let enabled = false;
    let options: number[] = [];
    try {
      const [branch] = await ctx.restaurantDb
        .select({ restaurantId: branches.restaurantId })
        .from(branches)
        .where(eq(branches.id, ctx.branchId))
        .limit(1);
      if (branch?.restaurantId) {
        const [rest] = await ctx.restaurantDb
          .select({ mode: restaurants.gratuityMode, pcts: restaurants.gratuityPcts })
          .from(restaurants)
          .where(eq(restaurants.id, branch.restaurantId))
          .limit(1);
        const pcts = parseGratuityPcts(rest?.pcts);
        const mode = String(rest?.mode || "OFF");
        enabled = (mode === "POS" || mode === "BOTH") && pcts.length > 0;
        options = pcts;
      }
    } catch {
      // — faltas de configuración no revientan el POS
    }
    return { enabled, options, maxPct: GRATUITY_MAX_PCT };
  }),

  getMenuItems: posProcedure
    .input(z.object({ categoryId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      // `isActive = false` = archivado (tenía ventas y no se pudo borrar).
      const where = input.categoryId
        ? and(
            eq(menuItems.categoryId, input.categoryId),
            eq(menuItems.branchId, ctx.branchId),
            eq(menuItems.isActive, true)
          )
        : and(eq(menuItems.branchId, ctx.branchId), eq(menuItems.isActive, true));
      const items = await ctx.restaurantDb.select().from(menuItems).where(where).orderBy(asc(menuItems.sortOrder));
      return items;
    }),

  /**
   * Aviso de Llegada a POS: recupera los eventos CUSTOMER_ARRIVAL sin leer
   * (los inserta /api/location/ping cuando un Rabbitter entra a ≤60m del local)
   * y los marca como leídos. Incluye a VIPs y a quienes ya no llegan dentro de
   * la ventana de 4 horas (anti-spam del motor de proximidad).
   */
  getRecentArrivals: posProcedure.query(async ({ ctx }) => {
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const rows = await ctx.restaurantDb.select()
      .from(posEvents)
      .where(and(
        eq(posEvents.branchId, ctx.branchId),
        eq(posEvents.type, "CUSTOMER_ARRIVAL"),
        gte(posEvents.createdAt, fourHoursAgo)
      ))
      .orderBy(desc(posEvents.createdAt))
      .limit(20);

    const unseen = rows.filter((r: any) => !r.read);
    if (unseen.length > 0) {
      await ctx.restaurantDb.update(posEvents)
        .set({ read: true })
        .where(inArray(posEvents.id, unseen.map((r: any) => r.id)));
    }

    return {
      newArrivals: unseen.map((r: any) => {
        const payload = (typeof r.payload === "string" ? JSON.parse(r.payload) : r.payload) || {};
        return {
          eventId: r.id,
          createdAt: r.createdAt,
          userId: payload.userId ?? null,
          username: payload.username ?? "Rabbitter",
          visitCount: Number(payload.visitCount ?? 0),
          isVip: Boolean(payload.isVip),
          distanceMeters: Number(payload.distanceMeters ?? 0),
          accuracy: Number(payload.accuracy ?? 0),
        };
      }),
      recent: rows.map((r: any) => {
        const payload = (typeof r.payload === "string" ? JSON.parse(r.payload) : r.payload) || {};
        return {
          createdAt: r.createdAt,
          username: payload.username ?? "Rabbitter",
          visitCount: Number(payload.visitCount ?? 0),
          isVip: Boolean(payload.isVip),
        };
      }),
    };
  }),

  // ── Feed del dashboard (1 roundtrip, sin N+1) ──
  // Órdenes activas (todas, limit 50 más recientes) + "ventas hoy" y count de
  // pagadas de hoy (día America/Mexico_City calculado en SQL — nunca en JS).
  getDashboardFeed: posProcedure.query(async ({ ctx }) => {
    // ── Auto-limpieza de tabs huérfanas ──
    // Órdenes PENDING/CASH_PAYMENT_REQUESTED más viejas que `staleOrderHours`
    // (config del restaurante, default 12h) se marcan EXPIRED: nunca fueron
    // ejecutadas ni pagadas → no se contabilizan ni bloquean el tablero,
    // pero quedan auditables (voidReason = STALE_TAB).
    const { expireStaleOrders } = await import("../services/tabsSweep");
    await expireStaleOrders(ctx.restaurantDb, ctx.branchId);

    const openRows = await ctx.restaurantDb.execute(sql`
      SELECT o.id, o."tableId", o.status, o."orderType", o."customerName", o.total, o."createdAt",
             t.number AS "tableNumber", t."location" AS "tableLocation",
             COALESCE((SELECT SUM(oi.quantity)::int FROM "order_items" oi WHERE oi."orderId" = o.id), 0) AS "itemsCount"
      FROM "orders" o
      LEFT JOIN "tables" t ON t.id = o."tableId"
      WHERE o."branchId" = ${ctx.branchId}
        AND o.status IN ('PENDING', 'OPEN', 'IN_PROGRESS', 'READY', 'CASH_PAYMENT_REQUESTED')
      ORDER BY o."createdAt" DESC
      LIMIT 50`);
    const [paid] = await ctx.restaurantDb.execute(sql`
      SELECT COUNT(*)::int AS count, COALESCE(SUM(total), 0) AS total
      FROM "orders"
      WHERE "branchId" = ${ctx.branchId}
        AND status IN ('PAID', 'COMPLETED')
        AND ((((("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Mexico_City'))::date)
             = ((now() AT TIME ZONE 'America/Mexico_City')::date))`)
      .then((r: any) => (r?.rows ?? r) as Array<{ count: number; total: string | number }>);
    return {
      // 50 órdenes activas más recientes (más de 50 activas simultáneas es
      // prácticamente imposible; si ocurriera, se muestran las 50 nuevas).
      openOrders: (openRows as unknown as { rows?: any[] }).rows?.map((r: any) => ({
        id: r.id as string,
        tableId: (r.tableId ?? null) as string | null,
        tableNumber: (r.tableNumber ?? null) as number | null,
        tableLocation: (r.tableLocation ?? null) as string | null,
        status: r.status as string,
        orderType: r.orderType as string | null,
        customerName: (r.customerName ?? null) as string | null,
        total: Number(r.total ?? 0),
        createdAt: r.createdAt as string,
        itemsCount: Number(r.itemsCount ?? 0),
      })),
      paidToday: {
        count: Number(paid?.count ?? 0),
        total: Number(paid?.total ?? 0),
      },
    };
  }),

  getOrders: posProcedure
    .input(z.object({ tableId: z.string().optional(), status: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      let where = input.tableId
        ? and(
            eq(orders.tableId, input.tableId),
            eq(orders.branchId, ctx.branchId)
          )
        : eq(orders.branchId, ctx.branchId);
      if (input.status) {
        where = and(where, eq(orders.status, input.status));
      }
      const ordersList = await ctx.restaurantDb.select().from(orders).where(where).orderBy(asc(orders.createdAt));
      const ordersWithItems = await Promise.all(ordersList.map(async (order) => {
        const items = await ctx.restaurantDb.select().from(orderItems).where(eq(orderItems.orderId, order.id));
        const itemsWithNames = await Promise.all(items.map(async (item) => {
          const [menuItem] = await ctx.restaurantDb.select().from(menuItems).where(eq(menuItems.id, item.menuItemId));
          return { ...item, name: menuItem?.name ?? item.menuItemId };
        }));
        return { ...order, items: itemsWithNames };
      }));
      return ordersWithItems;
    }),

  /**
   * H-PERSIST · ensureCustomerTab — vincular a un Rabbitter NO se queda en
   * memoria: abre (o reutiliza) una comanda PENDING persistente para ESE
   * cliente en esta sucursal. No se ejecuta ni se cobra: queda en Tabs para
   * agregarle productos o cobrarla aparte cuando el cliente decida.
   *
   * Reutiliza comandas PENDING del cliente de las últimas 12h (mismo criterio
   * que el barrido de tabs huérfanas) para no acumular borradores.
   */
  ensureCustomerTab: posProcedure
    .input(z.object({
      customerId: z.string(),
      customerName: z.string().optional(),
      customerPhone: z.string().optional(),
      orderType: z.enum(["DINE_IN", "TO_GO", "DELIVERY"]).default("TO_GO"),
      tableId: z.string().optional(),
      /** Si false, solo reutiliza una comanda existente CON productos; no crea borradores. */
      createIfMissing: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const candidates = await ctx.restaurantDb
        .select({ id: orders.id, total: orders.total, createdAt: orders.createdAt })
        .from(orders)
        .where(and(
          eq(orders.branchId, ctx.branchId),
          eq(orders.customerId, input.customerId),
          or(
            inArray(orders.status, [ORDER_STATUS.PENDING, ORDER_STATUS.PAID, ORDER_STATUS.CASH_REQUESTED]),
            and(eq(orders.status, ORDER_STATUS.PENDING_PAYMENT), isNotNull(orders.tableId))
          ),
          isNull(orders.voidReason),
          gte(orders.createdAt, sql`(now() AT TIME ZONE 'UTC') - interval '12 hours'`),
        ))
        .orderBy(desc(orders.createdAt))
        .limit(5);

      // Preferencia: la orden REAL del pedido (con productos). Si el Rabbitter
      // ya pidió desde la app, el POS debe vincular ESA orden y no abrir un
      // borrador en $0 — de ahí que "Desde la app" saliera en $0 y el cobro no
      // coincidiera con lo que ve el cliente.
      const candidateIds = candidates.map((c) => c.id);
      const itemRows = candidateIds.length > 0
        ? await ctx.restaurantDb
            .select({ orderId: orderItems.orderId })
            .from(orderItems)
            .where(inArray(orderItems.orderId, candidateIds))
        : [];
      const withItems = new Set(itemRows.map((r) => r.orderId));

      // 1º una comanda con productos (pedido del móvil o comanda viva).
      // Solo si `createIfMissing` se permite reutilizar un borrador vacío.
      let existing: { id: string; total: unknown } | undefined =
        candidates.find((c) => withItems.has(c.id));
      if (!existing && input.createIfMissing) {
        existing = candidates.find((c) => !withItems.has(c.id));
      }

      if (existing && !withItems.has(existing.id) && Number(existing.total || 0) > 0) {
        // Borrador con total pero sin items = dato inconsistente: no reutilizar.
        existing = undefined;
      }

      if (!existing && !input.createIfMissing) {
        // Vincular sin crear comanda: el cajero agrega productos manualmente y
        // el cobro se liga al cliente con `customerId`. Limpiamos borradores $0
        // que hayan quedado del comportamiento anterior.
        const blankIds = candidates
          .filter((c) => !withItems.has(c.id) && Number(c.total || 0) === 0)
          .map((c) => c.id);
        if (blankIds.length > 0) {
          // Un lock por orden: la limpieza de borradores también respeta la versión.
          const pendingBlanks = await ctx.restaurantDb
            .select({ id: orders.id })
            .from(orders)
            .where(and(inArray(orders.id, blankIds), eq(orders.status, "PENDING")));
          await ctx.restaurantDb.transaction(async (tx: any) => {
            for (const blank of pendingBlanks) {
              await withOrderMutation(
                tx,
                { orderId: blank.id, type: "DRAFT_RELEASED", actor: posActor(ctx) },
                async (_o: any, _c: any) => {
                  await tx
                    .update(orders)
                    .set({ status: "EXPIRED", voidReason: "DRAFT_RELEASED", updatedAt: new Date() })
                    .where(eq(orders.id, blank.id));
                },
              );
            }
          });
        }
        return { orderId: null, created: false, total: 0, hasItems: false };
      }

      if (existing) {
        // Mantener fresca la identidad del cliente vinculado (teléfono/nombre).
        await ctx.restaurantDb.transaction(async (tx: any) => {
          await withOrderMutation(
            tx,
            { orderId: existing.id, type: "CUSTOMER_UPDATED", actor: posActor(ctx) },
            async (_o: any, _c: any) => {
              await tx.update(orders).set({
                customerName: input.customerName ?? undefined,
                customerPhone: input.customerPhone ?? undefined,
                updatedAt: new Date(),
              }).where(eq(orders.id, existing.id));
            },
          );
        });
        return {
          orderId: existing.id,
          created: false,
          total: Number(existing.total || 0),
          hasItems: withItems.has(existing.id),
        };
      }

      const order = await ctx.restaurantDb.transaction(async (tx: any) =>
        withOrderCreate(tx, { actor: posActor(ctx) }, async () => {
          const [created] = await tx.insert(orders).values({
            branchId: ctx.branchId,
            tableId: input.tableId ?? null,
            orderType: input.orderType,
            customerId: input.customerId,
            customerName: input.customerName ?? null,
            customerPhone: input.customerPhone ?? null,
            subtotal: 0,
            tax: 0,
            discount: 0,
            tip: 0,
            total: 0,
            status: "PENDING",
          }).returning();
          return created;
        }),
      );
      if (!order) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No se pudo abrir la comanda del cliente" });
      bus.emit(EventTypes.ORDER_CREATED, { orderId: order.id, tableId: input.tableId });
      return { orderId: order.id, created: true, total: 0 };
    }),

  /**
   * H-PERSIST · releaseCustomerTab — suelta el borrador de vínculo cuando el
   * cajero cambia de Rabbitter o lo desvincula. Solo actúa sobre comandas
   * realmente vacías ($0, PENDING, sin items): si el cliente ya tiene productos
   * o cobros, NO se toca — se queda en Operación para cobrarse aparte.
   * Se marca EXPIRED + voidReason (auditable) en vez de borrar la fila.
   */
  releaseCustomerTab: posPermission("POS_CHARGE")
    .input(z.object({ orderId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [order] = await ctx.restaurantDb
        .select({ id: orders.id, total: orders.total, status: orders.status })
        .from(orders)
        .where(and(eq(orders.id, input.orderId), eq(orders.branchId, ctx.branchId)))
        .limit(1);
      if (!order) return { released: false, reason: "NOT_FOUND" as const };
      if (order.status !== "PENDING") return { released: false, reason: "NOT_PENDING" as const };
      if (Number(order.total || 0) > 0) return { released: false, reason: "HAS_TOTAL" as const };

      const [item] = await ctx.restaurantDb
        .select({ id: orderItems.id })
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id))
        .limit(1);
      if (item) return { released: false, reason: "HAS_ITEMS" as const };

      await ctx.restaurantDb.transaction(async (tx: any) => {
        await withOrderMutation(
          tx,
          { orderId: order.id, type: "DRAFT_RELEASED", actor: posActor(ctx) },
          async (_o: any, _c: any) => {
            await tx
              .update(orders)
              .set({ status: "EXPIRED", voidReason: "DRAFT_RELEASED", updatedAt: new Date() })
              .where(eq(orders.id, order.id));
          },
        );
      });
      return { released: true, reason: "RELEASED" as const };
    }),

  createOrder: posProcedure
    .input(
      z.object({
        tableId: z.string().optional(),
        orderType: z.enum(["DINE_IN", "TO_GO", "DELIVERY"]).default("DINE_IN"),
        customerId: z.string().optional(),
        customerName: z.string().optional(),
        customerPhone: z.string().optional(),
        /**
         * Cuenta al móvil: crea una orden de COBRO, no un pedido. No va a KDS
         * ni al seguimiento del Rabbitter; solo se usa para pagar/comprobante.
         */
        billOnly: z.boolean().default(false),
      })
    )
     .mutation(async ({ ctx, input }) => {
       const order = await ctx.restaurantDb.transaction(async (tx: any) =>
         withOrderCreate(tx, { actor: posActor(ctx) }, async () => {
           const [created] = await tx.insert(orders).values({
         branchId: ctx.branchId,
         tableId: input.billOnly ? null : (input.tableId ?? null),
         orderType: input.orderType,
         customerId: input.customerId ?? null,
         customerName: input.customerName ?? null,
         customerPhone: input.customerPhone ?? null,
         subtotal: 0,
         tax: 0,
         discount: 0,
         tip: 0,
         total: 0,
         billOnly: input.billOnly,
         status: input.billOnly ? "AWAITING_PAYMENT" : "PENDING",
           }).returning();
           return created;
         }),
       );
       if (!order) throw new Error("Error al crear la orden");
       // Una cuenta al móvil NO es un pedido: no emite ORDER_CREATED (KDS,
       // seguimiento, live activity) hasta que efectivamente se cobre.
       if (!input.billOnly) {
         bus.emit(EventTypes.ORDER_CREATED, { orderId: order.id, tableId: input.tableId });
       }
       return order;
     }),

  addToCart: posProcedure
    .input(
      z.object({
        orderId: z.string(),
        menuItemId: z.string(),
        quantity: z.number().min(1),
        modifiers: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Ítem + totales en UNA transacción: nunca queda una orden con productos
      // y total $0 si falla la actualización de totales.
      return await ctx.restaurantDb.transaction(async (tx: any) => {
        const [cartOrder] = await tx.select({ branchId: orders.branchId }).from(orders).where(eq(orders.id, input.orderId)).limit(1);
        if (!cartOrder || cartOrder.branchId !== ctx.branchId) throw new Error("Orden no encontrada");
        const [menuItem] = await tx.select().from(menuItems).where(eq(menuItems.id, input.menuItemId));
        if (!menuItem) {
          throw new Error("Producto no encontrado");
        }

        // Ítem + totales bajo el helper: bloqueo de orden, versión y bitácora.
        const { result } = await withOrderMutation(
          tx,
          { orderId: input.orderId, type: "ITEM_ADDED", actor: posActor(ctx) },
          async (_order, octx) => {
            const existingItems = await tx.select().from(orderItems).where(eq(orderItems.orderId, input.orderId));
            // Destino de preparación (ADR-023): se congela al agregar el ítem.
            const stationMap = await resolveStationsForItems(tx, ctx.branchId, [
              { menuItemId: input.menuItemId },
            ]);
            const dest = stationMap.get(input.menuItemId);
            const [orderItem] = await tx.insert(orderItems).values({
              orderId: input.orderId,
              menuItemId: input.menuItemId,
              quantity: input.quantity,
              unitPrice: menuItem.price,
              totalPrice: menuItem.price * input.quantity,
              sortOrder: existingItems.length,
              modifiers: input.modifiers ?? null,
              notes: input.notes ?? null,
              stationId: dest?.stationId ?? null,
              printerId: dest?.printerId ?? null,
              sentToStationAt: dest?.stationId ? new Date() : null,
            }).returning();
            await octx.recalcTotals();

            // Aviso en vivo al KDS de esa estación (0C-5). Sin estación no se emite.
            if (dest?.stationId) {
              // Mismo businessId que calcula el cliente (kds.realtimeChannel).
              const bizId = await resolveBusinessIdFromBranch(ctx.restaurantDb, ctx.branchId);
              await enqueueRealtimeEvent(tx, {
                businessId: bizId,
                branchId: ctx.branchId,
                channel: stationChannel(bizId, ctx.branchId, dest.stationId),
                eventType: "order.item.added",
                payload: {
                  orderId: input.orderId,
                  itemId: orderItem.id,
                  stationId: dest.stationId,
                  status: orderItem.status,
                },
                eventId: `item-added-${orderItem.id}`,
              });
            }

            return orderItem;
          },
        );
        // Push casi inmediato al KDS; si falla, el cron lo reintenta.
        drainRealtimeInBackground(ctx.restaurantDb);
        return result;
      });
    }),

  removeFromCart: posProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Transaccional: antes el borrado y el recálculo de totales iban sueltos y
      // podían dejar la orden descuadrada si fallaba a la mitad (ADR-018).
      return await ctx.restaurantDb.transaction(async (tx: any) => {
        const [item] = await tx.select().from(orderItems).where(eq(orderItems.id, input.id));
        if (!item) throw new Error("Item no encontrado");
        const [parentOrd] = await tx.select({ branchId: orders.branchId }).from(orders).where(eq(orders.id, item.orderId)).limit(1);
        if (!parentOrd || parentOrd.branchId !== ctx.branchId) throw new Error("Item no encontrado");
        if (item.status !== "PENDING") {
          throw new Error("No puedes eliminar un artículo que ya está en cocina. Usa la función de Cancelación (Void).");
        }

        const { result } = await withOrderMutation(
          tx,
          { orderId: item.orderId, type: "ITEM_REMOVED", actor: posActor(ctx) },
          async (_order, octx) => {
            const [removed] = await tx.delete(orderItems).where(eq(orderItems.id, input.id)).returning();
            if (!removed) throw new Error("Item no encontrado");
            await octx.recalcTotals();
            return removed;
          },
        );
        return result;
      });
    }),

  clearCart: posProcedure
    .input(z.object({ orderId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.restaurantDb.transaction(async (tx: any) => {
        const [cartOrd] = await tx.select({ branchId: orders.branchId }).from(orders).where(eq(orders.id, input.orderId)).limit(1);
        if (!cartOrd || cartOrd.branchId !== ctx.branchId) throw new Error("Orden no encontrada");

        await withOrderMutation(
          tx,
          { orderId: input.orderId, type: "CART_CLEARED", actor: posActor(ctx) },
          async (_order, octx) => {
            // Solo se borran los que aún no entraron a cocina.
            await tx.delete(orderItems).where(and(
              eq(orderItems.orderId, input.orderId),
              eq(orderItems.status, "PENDING")
            )).returning();
            await octx.recalcTotals();
          },
        );

        return { success: true };
      });
    }),

  // Guard multi-tenant: la orden DEBE pertenecer a la branch del ctx (evita IDOR cross-tenant)
  assertOrderInBranch: posProcedure
    .input(z.object({ orderId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [o] = await ctx.restaurantDb.select({ id: orders.id, branchId: orders.branchId }).from(orders).where(eq(orders.id, input.orderId)).limit(1);
      if (!o || o.branchId !== ctx.branchId) throw new Error("Orden no encontrada");
      return { ok: true };
    }),

  voidItem: posProcedure
    .input(z.object({
      id: z.string(),
      reason: z.string(),
      managerPin: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Import dynamically to avoid circular dependencies if any
      const { staff } = await import("@rabbitty/database-restaurant/schema");
      const { verifyPin } = await import("../services/crypto");

      // Verify manager PIN
      const managers = await ctx.restaurantDb.select().from(staff).where(
        and(
          eq(staff.branchId, ctx.branchId),
          inArray(staff.role, ["MANAGER", "ADMIN"])
        )
      );

      let authorizedStaffId = null;
      for (const s of managers) {
        if (s.pinCode && verifyPin(input.managerPin, s.pinCode)) {
          authorizedStaffId = s.id;
          break;
        }
      }

      if (!authorizedStaffId) {
        throw new Error("PIN de Manager inválido");
      }

      const [targetItem] = await ctx.restaurantDb.select({ id: orderItems.id, orderId: orderItems.orderId }).from(orderItems).where(eq(orderItems.id, input.id)).limit(1);
      if (!targetItem) throw new Error("Item no encontrado");
      const [parentOrder] = await ctx.restaurantDb.select({ branchId: orders.branchId }).from(orders).where(eq(orders.id, targetItem.orderId)).limit(1);
      if (!parentOrder || parentOrder.branchId !== ctx.branchId) throw new Error("Item no encontrado");

      // Cancelación de ítem bajo el helper: bloqueo de orden, versión y bitácora
      // (con el PIN de manager como autorizante queda registrado el actor).
      await ctx.restaurantDb.transaction(async (tx: any) => {
        await withOrderMutation(
          tx,
          { orderId: targetItem.orderId, type: "ITEM_VOIDED", actor: posActor(ctx) },
          async (_order, octx) => {
            const [voided] = await tx.update(orderItems).set({
              status: "CANCELLED",
              voidReason: input.reason,
              authorizedById: authorizedStaffId,
              voidedAt: new Date(),
              totalPrice: 0, // Un ítem anulado cuesta 0
            }).where(eq(orderItems.id, input.id)).returning();
            if (!voided) throw new Error("Item no encontrado");
            await octx.recalcTotals();
          },
        );
      });

      return { success: true };
    }),

  /**
   * @deprecated LEGACY — no cablear al helper ni usar en código nuevo.
   *
   * El POS activo usa `directCheckout` para fiat y `createPaymentIntent` para
   * Bunz. Esta ruta escribía `bunzPaid` y cobraba el saldo DESPUÉS del commit:
   * si el cobro fallaba, la orden quedaba pagada.
   *
   * Bunz ya está bloqueado aquí salvo rollback explícito
   * (`RABBITTY_LEGACY_BUNZ=true`). Plan: retirarla cuando ningún cliente la use.
   */
  payOrder: posProcedure
    // @deprecated LEGACY · no cablear al helper: esta ruta se retira.
    .input(
      z.object({
        orderId: z.string(),
        method: z.enum(["CASH", "CREDIT_CARD", "DEBIT_CARD", "BUNZ"]),
        amount: z.number(),
        discountPercent: z.number().min(0).max(100).optional(),
        reference: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.method === "CASH") {
        await assertOpenShiftForCash(ctx.restaurantDb, ctx.branchId);
      }
      // RP-2A: ruta legacy. En Bunz no verifica saldo y cobra post-commit; se
      // cierra para que todo cobro Bunz pase por el intento canónico.
      if (input.method === "BUNZ" && process.env.RABBITTY_LEGACY_BUNZ !== "true") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "LEGACY_BUNZ_DISABLED: usa el intento de pago canónico (createPaymentIntent) para cobrar con Bunz.",
        });
      }
      // P0-3: tarjeta exige referencia de terminal (no basta el cajero)
      assertCardPaymentAllowed(input.method, input.reference);

      // ── Seg. STRIX-0010: transacción + lock pesimista — la decisión de pago es
      // atómica; doble click / concurrencia jamás duplica pagos ni recompensas.
      // La llamada HTTP de lealtad sale del lock (post-commit). ──
      const result = await ctx.restaurantDb.transaction(async (tx: any) => {
        const [orderRow] = await tx
          .select()
          .from(orders)
          .where(and(eq(orders.id, input.orderId), eq(orders.branchId, ctx.branchId)))
          .for("update");
        if (!orderRow) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Orden no encontrada" });
        }
        if (isOrderPaidStatus(orderRow.status)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "La orden ya está pagada" });
        }
        // ── P0-5: no registrar BUNZ sin cliente identificado ──────────────
        // Antes, sin teléfono, la orden se completaba sin debitar nada.
        if (input.method === "BUNZ" && !orderRow.customerPhone && !orderRow.customerId) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "BUNZ_REQUIRES_CUSTOMER: vincula al cliente antes de cobrar con Bunz.",
          });
        }

        let finalAmount = r2(input.amount);
        let calculatedDiscount = orderRow.discount || 0;
        let orderNetTotal = orderRow.total;
        if (input.discountPercent && input.discountPercent > 0) {
          const gross = r2(orderRow.total + (orderRow.discount || 0));
          const net = r2(gross * (1 - input.discountPercent / 100));
          if (Math.abs(net - input.amount) > 1) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Monto de descuento inválido" });
          }
          finalAmount = net;
          calculatedDiscount = r2(gross - net);
          orderNetTotal = net;
          const t = calcTax(net);
          await tx.update(orders)
            .set({ discount: calculatedDiscount, total: t.total, subtotal: t.subtotal, tax: t.tax })
            .where(eq(orders.id, input.orderId));
        }

        const [payment] = await tx.insert(payments).values({
          orderId: input.orderId,
          method: input.method,
          amount: finalAmount,
          reference: input.reference ?? null,
          verificationMethod: isCardMethod(input.method) ? "EXTERNAL_TERMINAL" : undefined,
        }).returning();

        const existingPayments = await tx.select().from(payments).where(eq(payments.orderId, input.orderId));
        const totalPaid = existingPayments.reduce((sum: number, p: { amount: number }) => sum + p.amount, 0);

        if (input.method === "BUNZ") {
          await tx.update(orders)
            .set({ bunzPaid: (orderRow.bunzPaid || 0) + finalAmount })
            .where(eq(orders.id, input.orderId));

          // OT-1 / OT-3: intento + asientos. Idempotente y no fatal: si las tablas
          // no existen, el pago sigue (se registra el aviso). Flag apagado = no-op.
          const redemptionBizId = await resolveBusinessIdFromBranch(tx, orderRow.branchId);
          const redemptionSandbox = await isSandboxLedgerTx(
            tx,
            redemptionBizId,
            orderRow.customerId ?? orderRow.customerPhone ?? null,
          );
          await recordRedemptionBooks(tx, {
            orderId: input.orderId,
            branchId: orderRow.branchId,
            bunz: finalAmount,
            userHash: orderRow.customerId ?? orderRow.customerPhone ?? null,
            sandbox: redemptionSandbox,
            tables: { attempts: bunzRedemptionAttempts, ledger: bunzLedgerEntries },
          });
        }

        const targetPayableAmount = Math.max(0, orderNetTotal);
        if (r2(totalPaid) >= targetPayableAmount) {
          await tx.update(orders).set({ status: ORDER_STATUS.COMPLETED }).where(eq(orders.id, input.orderId));

          const paidOrderRow = await tx.select({ tableId: orders.tableId }).from(orders).where(eq(orders.id, input.orderId)).limit(1);
          if (paidOrderRow[0]?.tableId) {
            await tx.update(tableSessions).set({
              status: "CLOSED",
              closedAt: new Date(),
            }).where(and(
              eq(tableSessions.tableId, paidOrderRow[0].tableId),
              eq(tableSessions.status, "OPEN")
            ));
          }

          // INVENTORY DEDUCTION LOGIC (recursive for sub-recipes)
          const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, input.orderId));
          const deductRecipe = async (menuItemId: string, qty: number, path: Set<string>) => {
            if (path.has(menuItemId)) return;
            path.add(menuItemId);
            const ingredients = await tx
              .select()
              .from(dbSchema.menuItemIngredients)
              .where(eq(dbSchema.menuItemIngredients.menuItemId, menuItemId));
            for (const ing of ingredients) {
              if (ing.inventoryItemId) {
                const deductionAmount = ing.quantityRequired * qty;
                await tx.insert(dbSchema.inventoryMovements).values({
                  itemId: ing.inventoryItemId,
                  branchId: ctx.branchId,
                  type: "SALE_DEDUCTION",
                  quantity: deductionAmount,
                  reference: input.orderId,
                  notes: `Order ${input.orderId} completed`,
                });
                await tx.execute(sql`UPDATE inventory_items SET stock = stock - ${deductionAmount} WHERE id = ${ing.inventoryItemId}`);
              } else if (ing.subRecipeId) {
                await deductRecipe(ing.subRecipeId, ing.quantityRequired * qty, path);
              }
            }
            path.delete(menuItemId);
          };
          for (const item of items) {
            await deductRecipe(item.menuItemId, item.quantity, new Set());
          }
        } else {
          await tx.update(orders).set({ status: "PARTIAL_PAID" }).where(eq(orders.id, input.orderId));
        }

        // ── CRM Auto-segmentation (server-side, dentro de la tx) ──
        const loyaltyParams: {
          rewardPhone: string;
          loyaltyBusinessId: string;
          customerName: string;
          calculatedReward: number;
        } = {
          rewardPhone: "",
          loyaltyBusinessId: "",
          customerName: "",
          calculatedReward: 0,
        };
        if (orderRow.customerPhone) {
          const branchesTable = dbSchema.branches;
          const [branch] = await tx.select().from(branchesTable).where(eq(branchesTable.id, ctx.branchId));
          if (branch) {
            const [restaurant] = await tx.select().from(dbSchema.restaurants).where(eq(dbSchema.restaurants.id, branch.restaurantId));
            if (restaurant) {
              loyaltyParams.loyaltyBusinessId = (await resolveBusinessIdFromBranch(ctx.restaurantDb, ctx.branchId)) || ctx.branchId;
              const normalizeToPercent = (v: number | null | undefined) =>
                typeof v === "number" && v > 0 && v < 1 ? v * 100 : v;
              const [existingCustomer] = await tx.select().from(dbSchema.customers).where(
                and(eq(dbSchema.customers.restaurantId, restaurant.id), eq(dbSchema.customers.phone, orderRow.customerPhone))
              );
              if (existingCustomer) {
                const newVisits = existingCustomer.totalVisits + 1;
                let newSegment = "NEW";
                if (newVisits >= 5) newSegment = "VIP";
                else if (newVisits > 1) newSegment = "RECURRENT";
                await tx.update(dbSchema.customers).set({
                  totalVisits: newVisits,
                  totalSpent: existingCustomer.totalSpent + finalAmount,
                  lastVisitAt: new Date(),
                  segment: newSegment,
                  name: orderRow.customerName ?? existingCustomer.name,
                }).where(eq(dbSchema.customers.id, existingCustomer.id));
              } else {
                await tx.insert(dbSchema.customers).values({
                  restaurantId: restaurant.id,
                  phone: orderRow.customerPhone,
                  name: orderRow.customerName,
                  totalVisits: 1,
                  totalSpent: finalAmount,
                  lastVisitAt: new Date(),
                  segment: "NEW",
                });
              }
            }
          }
          loyaltyParams.rewardPhone = String(orderRow.customerPhone);
          loyaltyParams.customerName = String(orderRow.customerName ?? "");
        }

        bus.emit(EventTypes.BUNZ_REWARD, { customerId: orderRow.customerPhone, rewardPoints: loyaltyParams.calculatedReward });
        return {
          success: true,
          loyaltyParams,
        };
      });

      // ── Post-commit: lealtad FUERA del lock (STRIX riesgo-bajo) ──
      if (!(result as any)?.success) return result;
      const lp = (result as any).loyaltyParams as { rewardPhone: string; loyaltyBusinessId: string; customerName: string };
      // RECOMPENSA = moneda del PAÍS (México = MXN): 1 Bunz = 1 unidad local.
      // La tasa USD del admin NO altera la recompensa — solo valúa cobros
      // recibidos en dólares (turistas) y el display opcional en ticket.
      const callWithRetry = async (fnName: "chargeBunz" | "rewardBunz") => {
        const attempt = async () =>
          fnName === "chargeBunz"
            ? miniappClient.chargeBunz(lp.rewardPhone, input.amount, input.orderId, lp.loyaltyBusinessId)
            : miniappClient.rewardBunz(lp.rewardPhone, input.amount, input.orderId, lp.loyaltyBusinessId);
        try {
          return { ok: true as const, result: await attempt() };
        } catch (firstErr) {
          console.error("[POS_PAYORDER_REWARD_FAIL] orderId=" + input.orderId + " intento 1:", firstErr);
          try {
            await new Promise((r) => setTimeout(r, 800));
            return { ok: true as const, result: await attempt() };
          } catch (secondErr) {
            console.error("[POS_PAYORDER_REWARD_FAIL] orderId=" + input.orderId + " intento 2 definitivo:", secondErr);
            return { ok: false as const, result: null };
          }
        }
      };

      if (!lp.rewardPhone) {
        bus.emit(EventTypes.ORDER_PAID, { orderId: input.orderId });
        return { success: true, rewardQueued: true };
      }

      let rewardQueued = true;
      if (input.method === "BUNZ") {
        const outcome = await callWithRetry("chargeBunz");
        rewardQueued = outcome.ok;
        if (outcome.ok && outcome.result) {
          const r2 = outcome.result as { balance_remaining: number };
          try {
            await miniappClient.sendNotification({
              userId: lp.rewardPhone,
              title: "Pago con Bunz",
              message: `Pagaste $${input.amount} con Bunz en tu restaurante. Saldo restante: ${r2.balance_remaining} Bunz.`,
              type: "REWARD",
            });
          } catch {}
        }
      } else {
        // RP-2B: kill switch + lista blanca/tope antes de emitir.
        let emitControl: Awaited<ReturnType<typeof checkOperation>>;
        try {
          emitControl = await checkOperation(ctx.restaurantDb, {
            affiliateId: lp.loyaltyBusinessId,
            operation: "emission",
            amount: Number((result as any).loyaltyParams?.calculatedReward ?? input.amount),
            now: new Date(),
            tables: {
              limits: bunzEconomicLimits,
              orders,
              branches,
              restaurants,
              attempts: bunzRedemptionAttempts,
              obligations: bunzObligations,
              controlState: bunzControlState,
            },
          });
        } catch (controlError) {
          console.error(`[BUNZ_EMIT_CONTROL] orderId=${input.orderId}`, controlError);
          emitControl = { allowed: false, reason: "control de emisión no disponible" };
        }
        if (!emitControl.allowed) {
          console.warn(`[BUNZ_EMIT_BLOCKED] orderId=${input.orderId} ${emitControl.reason}`);
          rewardQueued = false;
        } else {
          const outcome = await callWithRetry("rewardBunz");
          rewardQueued = outcome.ok;
          if (outcome.ok && outcome.result) {
            const r2 = outcome.result as { userId?: string; bunz: number };
            if (r2.userId) {
              try {
                await miniappClient.sendNotification({
                  userId: r2.userId,
                  title: "¡Bunz ganados!",
                  message: `Ganaste ${r2.bunz} Bunz por tu consumo de $${input.amount}.`,
                  type: "REWARD",
                });
              } catch {}
            }
          }
        }
      }

      bus.emit(EventTypes.ORDER_PAID, { orderId: input.orderId });
      return { success: true, rewardQueued };
    }),

  linkCustomerToOrder: posProcedure
    .input(
      z.object({
        orderId: z.string(),
        customerPhone: z.string(),
        customerName: z.string().optional(),
        customerId: z.string().optional(),
        awardBunz: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Guard de sucursal ANTES de mutar (el helper bloquea por id, no por branch).
      const [ownedOrder] = await ctx.restaurantDb
        .select({ id: orders.id, branchId: orders.branchId })
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1);
      if (!ownedOrder || ownedOrder.branchId !== ctx.branchId) throw new Error("Orden no encontrada");

      const order = await ctx.restaurantDb.transaction(async (tx: any) => {
        const { order: updated } = await withOrderMutation(
          tx,
          { orderId: input.orderId, type: "CUSTOMER_LINKED", actor: posActor(ctx) },
          async (_o: any, _c: any) => {
            await tx.update(orders)
              .set({
                customerPhone: input.customerPhone,
                customerName: input.customerName ?? null,
                customerId: input.customerId ?? null,
              })
              .where(eq(orders.id, input.orderId));
          },
        );
        return updated;
      });

      // ── Asignación POST-cobro con emisión atómica e idempotente ──
      let awardedBunz = 0;
      if (input.awardBunz && input.customerId) {
        const isSettled = isOrderPaidStatus(order.status);
        const alreadyRewarded = Number((order as any).bunzReward || 0) > 0;
        if (isSettled && !alreadyRewarded) {
          const { miniappClient } = await import("../services/miniapp-client");
          try {
            const linkBizId = (await resolveBusinessIdFromBranch(ctx.restaurantDb, ctx.branchId)) || ctx.branchId;
            const res = await miniappClient.rewardBunz(
              input.customerId,
              Number(order.total || 0),
              order.id,
              linkBizId
            );
            if (res?.success) {
              awardedBunz = res.bunz || 0;
              await ctx.restaurantDb.transaction(async (tx: any) => {
                await withOrderMutation(
                  tx,
                  { orderId: order.id, type: "BUNZ_LINKED", actor: posActor(ctx) },
                  async (_o: any, _c: any) => {
                    await tx.update(orders)
                      .set({ bunzReward: awardedBunz })
                      .where(eq(orders.id, order.id));
                  },
                );
              });
              // OT-3: la recompensa se considera emitida al cobrar. Idempotente.
              await recordEmissionBooks(ctx.restaurantDb, {
                orderId: order.id,
                bunz: awardedBunz,
                sandbox: await isSandboxLedgerTx(ctx.restaurantDb, linkBizId, input.customerId),
                tables: { ledger: bunzLedgerEntries },
              });
              await ctx.restaurantDb.transaction(async (tx) =>
                recognizeActivity(tx, {
                  affiliateId: linkBizId,
                  reward: awardedBunz,
                  orderId: order.id,
                })
              );
              // OT-2: devengo de la comisión del afiliado (6%). Idempotente, no fatal.
              await accrueCommission(ctx.restaurantDb, {
                orderId: order.id,
                affiliateId: linkBizId,
                fiatAmount: Number(order.total || 0),
                tables: { obligations: bunzObligations, events: bunzObligationEvents },
              });
            }
          } catch (err) {
            console.error("[POS_REWARD_FAIL] post-assign orderId=" + order.id, err);
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "El cliente quedó vinculado, pero la recompensa Bunz no pudo acreditarse. Inténtalo de nuevo (idempotente).",
            });
          }
        }
      }
      return { ...order, awardedBunz };
    }),


/**
   * POS-caja con Stripe Connect: crea la orden PENDING con items (IVA canónico),
   * calcula el PaymentIntent en centavos (hold de Bunz si hay Rabbitter vinculado)
   * y devuelve la URL /pay/[orderId] para que el comensal pague desde su teléfono
   * (Apple Pay / tarjeta). La liquidación llega por webhook confirmPaymentIntentSettled.
   * Cancelación → cancelPaymentIntent libera el hold.
   */
  createStripeChargeIntent: posPermission("POS_CHARGE")
    .input(z.object({
      items: z.array(z.object({
        menuItemId: z.string(),
        quantity: z.number().int().min(1),
        notes: z.string().optional(),
      })).min(1),
      orderType: z.enum(["DINE_IN", "TO_GO", "DELIVERY"]).default("DINE_IN"),
      tableId: z.string().optional(),
      customerId: z.string().optional(),
      customerName: z.string().optional(),
      customerPhone: z.string().optional(),
      bunzToApply: z.number().int().min(0).default(0),
      // GAP 1: beneficios de membresía también en cobro con tarjeta / Rabbitty Pay
      entitlementIds: z.array(z.string().uuid()).max(5).optional(),
      /** Ítems del carrito que son consumo del socio (MEMBER_CONSUMPTION). */
      memberMenuItemIds: z.array(z.string()).max(50).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Compensaciones si la tx de la orden falla después de consumir beneficios
      // (las tablas de membresía viven en la DB core, fuera de esta transacción).
      const membershipCompensations: Array<() => Promise<unknown>> = [];
      /** Cuánto cubrió la membresía (para el cierre sin cobro). */
      let benefitsCovered = 0;
      try {
        // Orden + items + PaymentIntent en una transacción; precios SIEMPRE del menú server-side
        return await ctx.restaurantDb.transaction(async (tx: any) => {
          const prices = await tx.select({ id: menuItems.id, price: menuItems.price })
            .from(menuItems)
            .where(eq(menuItems.branchId, ctx.branchId));
          const priceMap = new Map(prices.map((p: any) => [p.id, Number(p.price)]));

          let itemsTotal = 0;
          const itemRows = input.items.map((it) => {
            const unit = Number(priceMap.get(it.menuItemId) ?? 0);
            if (!unit) throw new TRPCError({ code: "BAD_REQUEST", message: "Item de menú no válido para esta sucursal" });
            const lineTotal = r2(unit * it.quantity);
            itemsTotal += lineTotal;
            return { menuItemId: it.menuItemId, quantity: it.quantity, unitPrice: unit, totalPrice: lineTotal, notes: it.notes ?? null, sortOrder: 0 };
          });
          itemsTotal = r2(itemsTotal);
          const { total: calcTotal, subtotal: calcSubtotal, tax: calcTaxAmt } = calcTax(itemsTotal);

          // Todo dentro de la MISMA transacción: si el intent falla, no queda
          // orden huérfana (antes orders/orderItems se escribían fuera de tx).
          const order = await withOrderCreate(tx, { actor: posActor(ctx) }, async () => {
            const [row] = await tx.insert(orders).values({
              branchId: ctx.branchId,
              tableId: input.tableId ?? null,
              orderType: input.orderType,
              customerName: input.customerName ?? null,
              customerPhone: input.customerPhone ?? null,
              customerId: input.customerId ?? null,
              subtotal: calcSubtotal,
              tax: calcTaxAmt,
              total: calcTotal,
              status: "PENDING",
            }).returning();
            return row;
          });
          if (!order) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No se pudo crear la orden" });

          const stationDest = await resolveStationsForItems(
            tx,
            ctx.branchId,
            itemRows.map((r) => ({ menuItemId: r.menuItemId })),
          );
          for (const [i, row] of itemRows.entries()) {
            const dest = stationDest.get(row.menuItemId);
            await tx.insert(orderItems).values({
              ...row,
              sortOrder: i,
              orderId: order.id,
              stationId: dest?.stationId ?? null,
              printerId: dest?.printerId ?? null,
              sentToStationAt: dest?.stationId ? new Date() : null,
            });
          }

          // ── Beneficios de membresía (mismas reglas que el cobro directo) ──
          let orderTotal = calcTotal;
          if (input.entitlementIds && input.entitlementIds.length > 0) {
            const { applyMembershipBenefitsToOrder } = await import("../services/membershipBenefits");
            const applied = await applyMembershipBenefitsToOrder({
              coreDb: ctx.coreDb,
              restaurantDb: ctx.restaurantDb,
              branchId: ctx.branchId,
              staffId: ctx.userId ?? null,
              orderId: order.id,
              items: itemRows.map((r) => ({ menuItemId: r.menuItemId, quantity: r.quantity, unitPrice: r.unitPrice })),
              customerId: input.customerId,
              entitlementIds: input.entitlementIds,
              memberMenuItemIds: input.memberMenuItemIds,
              baseAmount: calcSubtotal,
            });
            membershipCompensations.push(...applied.compensations);
            if (applied.discount > 0) {
              const adjusted = calcTax(applied.finalAmount);
              orderTotal = adjusted.total;
              await withOrderMutation(
                tx,
                { orderId: order.id, type: "INTENT_PRICED", actor: posActor(ctx) },
                async (_o: any, _c: any) => {
                  await tx.update(orders).set({
                    subtotal: adjusted.subtotal,
                    tax: adjusted.tax,
                    discount: applied.discount,
                    total: adjusted.total,
                  }).where(eq(orders.id, order.id));
                },
              );
            }
          }

          // 3. PaymentIntent atómico (hold de Bunz si hay payer)
          const { createOrGetPaymentIntent } = await import("../services/paymentCore");
          const intent = await createOrGetPaymentIntent(tx, {
            branchId: ctx.branchId,
            orderId: order.id,
            payerUserId: input.customerId ?? undefined,
            bunzToApply: input.bunzToApply,
            tipMxn: 0,
            attemptNumber: 1,
            provider: "STRIPE",
          } as never);

          // 4. URL de pago (app admin /pay) — env primero, fallback admin.rabbitty.me
          const base = process.env.NEXT_PUBLIC_APP_URL || process.env.RABBITTY_ADMIN_URL || process.env.ADMIN_APP_URL || "https://admin.rabbitty.me";
          const payUrl = `${base}/pay/${order.id}`;

          return { orderId: order.id, intentId: (intent as any).intentId, payUrl, total: orderTotal, bunzApplied: (intent as any).bunzApplied ?? 0, netFiatCents: (intent as any).netFiatCents, expiresAt: (intent as any).expiresAt };
        });
      } catch (err) {
        for (const compensate of membershipCompensations) {
          try { await compensate(); } catch (compErr) { console.error("[membership] compensación falló:", compErr); }
        }
        throw err;
      }
    }),

  voidOrder: posProcedure
    .input(z.object({ orderId: z.string(), reason: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [orderRow] = await ctx.restaurantDb
        .select({ branchId: orders.branchId, status: orders.status })
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1);
      if (!orderRow) throw new TRPCError({ code: "NOT_FOUND", message: "Orden no encontrada" });

      // ── C-10: anular una orden cobrada exige reverso, no silencio ──
      // Antes quedaba VOIDED con el pago COMPLETED: el turno y los reportes
      // seguían contando el dinero de una orden anulada, sin asiento ni aviso.
      // Neto vivo: una orden con reembolso parcial todavía tiene dinero cobrado
      // (no se puede anular); una reembolsada al 100 % sí.
      const [charged] = await ctx.restaurantDb
        .select({ net: sql<number>`COALESCE(SUM(${payments.amount}), 0)` })
        .from(payments)
        .where(
          and(
            eq(payments.orderId, input.orderId),
            inArray(payments.status, ["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED"]),
          ),
        );
      if (Number(charged?.net ?? 0) > 0.005) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Esta orden tiene un cobro registrado: reembólsalo antes de anularla (Reembolsos → nueva devolución).",
        });
      }

      // ── Multi-tenant guard: solo staff de plataforma, dueño del negocio,
      //    o staff de la misma sucursal pueden anular la orden ──
      if (orderRow.branchId) {
        const isPlatformStaff = Boolean(ctx.staffRole);
        if (!isPlatformStaff) {
          const isBranchStaff = ctx.branchId && ctx.branchId === orderRow.branchId;
          if (!isBranchStaff) {
            const { restaurants, branches } = await import("@rabbitty/database-restaurant/schema");
            const coreOwned = await import("@rabbitty/database-core/schema").then(m => m.ownedBusinesses);
            const [branchRow] = await ctx.restaurantDb
              .select({ restaurantId: branches.restaurantId })
              .from(branches)
              .where(eq(branches.id, orderRow.branchId))
              .limit(1);
            const [restaurantRow] = branchRow
              ? await ctx.restaurantDb
                  .select({ businessId: restaurants.businessId })
                  .from(restaurants)
                  .where(eq(restaurants.id, branchRow.restaurantId))
                  .limit(1)
              : [];
            if (!restaurantRow) throw new TRPCError({ code: "NOT_FOUND", message: "Sucursal sin restaurante asociado." });
            const [owned] = await ctx.coreDb
              .select({ id: coreOwned.id })
              .from(coreOwned)
              .where(eq(coreOwned.ownerId, ctx.userId))
              .limit(1);
            if (!owned || owned.id !== restaurantRow.businessId) {
              throw new TRPCError({ code: "FORBIDDEN", message: "Esta orden no pertenece a tu negocio." });
            }
          }
        }
      }

      await ctx.restaurantDb.transaction(async (tx: any) => {
        await withOrderMutation(
          tx,
          { orderId: input.orderId, type: "ORDER_VOIDED", actor: posActor(ctx) },
          async (_o: any, _c: any) => {
            await tx.update(orders).set({
              status: "VOIDED",
              voidReason: input.reason,
            }).where(eq(orders.id, input.orderId));
          },
        );
      });
      // Fase 1 Rabbitty Score (H2): exclusión IMEDIATA del rating al anular
      await (await import("./ratings")).invalidateOrderRating(ctx.restaurantDb, input.orderId, "ORDER_VOIDED");
      bus.emit(EventTypes.ORDER_VOIDED, { orderId: input.orderId });
      return { success: true };
    }),

  generateQR: posProcedure
    .input(z.object({ tableId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [table] = await ctx.restaurantDb.select().from(tablesTable).where(eq(tablesTable.id, input.tableId));
      if (!table) {
        throw new Error("Mesa no encontrada");
      }
      const baseUrl = process.env.RABBITTY_DOMAIN || "https://rabbitty.me";
      const qrCode = `${baseUrl}/qr/table/${input.tableId}?branch=${table.branchId}`;
      await ctx.restaurantDb.update(tablesTable).set({ qrCode }).where(eq(tablesTable.id, input.tableId));
      return { qrCode };
    }),

  getTableQR: posProcedure
    .input(z.object({ tableId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [table] = await ctx.restaurantDb.select().from(tablesTable).where(eq(tablesTable.id, input.tableId));
      return { qrCode: table?.qrCode ?? null };
    }),

  verifyBunzBalance: posProcedure
    .input(z.object({ customerId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [user] = await ctx.coreDb.select().from(coreUsers).where(eq(coreUsers.id, input.customerId));
      // Balance efectivo: earned - spent - deuda pendiente (pendingDebtBunz)
      const balance = user
        ? Math.max(0, (user.totalBunzEarned ?? 0) - (user.totalBunzSpent ?? 0) - (user.pendingDebtBunz ?? 0))
        : 0;
      return { customerId: input.customerId, balance };
    }),

  /**
   * Fase 2 Complementaria: Self-Tab en Mesa por QR
   * Asocia al comensal (Rabbitter) con la mesa escaneada.
   * Si ya hay una orden PENDING en esa mesa, le asigna el customerId y sus datos.
   * Si no, abre o actualiza una tableSessions activa.
   */
  claimTableSession: posProcedure
    .input(
      z.object({
        tableId: z.string(),
        branchId: z.string().optional(),
        customerId: z.string(),
        customerName: z.string().optional(),
        customerPhone: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const isCallerStaff = Boolean(ctx.staffRole);
      const effectiveCustomerId = isCallerStaff ? input.customerId : ctx.userId;
      // Sin Rabbitter no se puede vincular la mesa. Además fija el tipo para
      // todas las consultas siguientes (evita un `undefined` silencioso).
      if (!effectiveCustomerId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Falta el Rabbitter para vincular la mesa.",
        });
      }

      // 1. Validar que la mesa exista
      const [table] = await ctx.restaurantDb
        .select()
        .from(tablesTable)
        .where(eq(tablesTable.id, input.tableId))
        .limit(1);

      if (!table) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Mesa no encontrada" });
      }

      // 1b. Tenancy: si el caller declara una branch, debe coincidir con la de la mesa
      const requestedBranchId = input.branchId || ctx.branchId;
      if (requestedBranchId && table.branchId && requestedBranchId !== table.branchId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "La mesa no pertenece a esta sucursal." });
      }

      // 1c. Carrera de reclamo: si la sesión u orden abierta ya pertenece a OTRO
      // Rabbitter, solo el staff puede reasignarla.
      const [existingClaimSession] = await ctx.restaurantDb
        .select()
        .from(tableSessions)
        .where(and(eq(tableSessions.tableId, input.tableId), eq(tableSessions.status, "OPEN")))
        .limit(1);
      const [existingClaimOrder] = await ctx.restaurantDb
        .select({ customerId: orders.customerId })
        .from(orders)
        .where(and(eq(orders.tableId, input.tableId), eq(orders.status, "PENDING")))
        .orderBy(desc(orders.createdAt))
        .limit(1);
      const alreadyClaimedBy = existingClaimSession?.customerId || existingClaimOrder?.customerId || null;
      if (alreadyClaimedBy && alreadyClaimedBy !== effectiveCustomerId && !isCallerStaff) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Esta mesa ya está vinculada a otro Rabbitter. Pide a tu mesero/ayudante que revise tu cuenta.",
        });
      }

      // 2. Buscar datos del cliente si no vinieron explícitos
      let customerName = input.customerName;
      let customerPhone = input.customerPhone;
      let customerUsername: string | null = null;

      const [coreUser] = await ctx.coreDb
        .select()
        .from(coreUsers)
        .where(eq(coreUsers.id, effectiveCustomerId))
        .limit(1);

      if (coreUser) {
        customerName = customerName || [coreUser.firstName, coreUser.lastName].filter(Boolean).join(" ") || coreUser.username || "Rabbitter";
        customerPhone = customerPhone || coreUser.phoneNumber || undefined;
        customerUsername = coreUser.username || null;
      }

      // 3. Revisar si hay una comanda PENDING abierta en esta mesa
      const [pendingOrder] = await ctx.restaurantDb
        .select()
        .from(orders)
        .where(and(eq(orders.tableId, input.tableId), eq(orders.status, "PENDING")))
        .orderBy(desc(orders.createdAt))
        .limit(1);

      if (pendingOrder) {
        await ctx.restaurantDb.transaction(async (tx: any) => {
          await withOrderMutation(
            tx,
            { orderId: pendingOrder.id, type: "TABLE_CLAIMED", actor: posActor(ctx) },
            async (_o: any, _c: any) => {
              await tx
                .update(orders)
                .set({
                  customerId: effectiveCustomerId,
                  customerName: customerName || pendingOrder.customerName,
                  customerPhone: customerPhone || pendingOrder.customerPhone,
                })
                .where(eq(orders.id, pendingOrder.id));
            },
          );
        });
      }

      // 4. Asegurar una table_session en estado OPEN para esta mesa
      const [existingSession] = await ctx.restaurantDb
        .select()
        .from(tableSessions)
        .where(and(eq(tableSessions.tableId, input.tableId), eq(tableSessions.status, "OPEN")))
        .limit(1);

      if (existingSession) {
        await ctx.restaurantDb
          .update(tableSessions)
          .set({
            customerId: effectiveCustomerId,
          })
          .where(eq(tableSessions.id, existingSession.id));
      } else {
        await ctx.restaurantDb.insert(tableSessions).values({
          tableId: input.tableId,
          branchId: table.branchId,
          customerId: effectiveCustomerId,
          status: "OPEN",
          customerCount: 1,
        });
      }

      return {
        success: true,
        tableId: table.id,
        tableNumber: table.number,
        tableLocation: table.location,
        branchId: table.branchId,
        orderId: pendingOrder?.id ?? null,
        orderTotal: pendingOrder ? Number(pendingOrder.total || 0) : 0,
        customer: {
          id: effectiveCustomerId,
          name: customerName || "Rabbitter",
          phone: customerPhone || null,
          username: customerUsername,
        },
      };
    }),


  getModifiers: posProcedure
    .input(z.object({ itemId: z.string() }))
    .query(async ({ ctx, input }) => {
      const modifiers = await ctx.restaurantDb.select().from(menuItemModifiers).where(eq(menuItemModifiers.itemId, input.itemId));
      return modifiers;
    }),

  createModifier: posProcedure
    .input(
      z.object({
        itemId: z.string(),
        name: z.string(),
        type: z.enum(["SELECT", "CHECKBOX"]).default("SELECT"),
        priceAdjust: z.number().default(0),
        maxSelect: z.number().default(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [modifier] = await ctx.restaurantDb.insert(menuItemModifiers).values(input).returning();
      return modifier;
    }),

  updateModifier: posProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        type: z.enum(["SELECT", "CHECKBOX"]).optional(),
        priceAdjust: z.number().optional(),
        maxSelect: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.restaurantDb.update(menuItemModifiers).set(input).where(eq(menuItemModifiers.id, input.id));
      return { success: true };
    }),

  directCheckout: posPermission("POS_CHARGE")
    .input(
      z.object({
        tableId: z.string().optional(),
        orderType: z.enum(["DINE_IN", "TO_GO", "DELIVERY"]).default("DINE_IN"),
        customerId: z.string().optional(),
        customerName: z.string().optional(),
        customerPhone: z.string().optional(),
        items: z.array(
          z.object({
            menuItemId: z.string(),
            quantity: z.number().min(1),
            price: z.number(),
            notes: z.string().optional(),
          })
        ),
        // MEMBERSHIP = la membresía cubre el 100%: no hay cobro, solo cierre.
        paymentMethod: z.enum(["CASH", "CREDIT_CARD", "DEBIT_CARD", "BUNZ", "MEMBERSHIP"]),
        /** P0-3: referencia/autorización de la terminal para cobros con tarjeta. */
        cardReference: z.string().trim().max(80).optional(),
        discountPercent: z.number().min(0).max(100).optional(),
        // GAP 1: beneficios de membresía a aplicar a esta venta (INCLUDED_PRODUCT,
        // DISCOUNT_PCT, CREDIT_BALANCE). El server re-verifica propiedad y cuota —
        // el POS solo puede pedir, no forzar.
        entitlementIds: z.array(z.string().uuid()).max(5).optional(),
        /** Ítems del carrito que son consumo del socio (MEMBER_CONSUMPTION). */
        memberMenuItemIds: z.array(z.string()).max(50).optional(),
        // ── Propina + split DIVIDIDA (efectivo + Bunz) ──
        tip: z.number().min(0).max(5000).optional(),
        splitCash: z.number().min(0).optional(),
        splitBunz: z.number().min(0).optional(),
        // H-PERSIST: si el cliente fue vinculado antes, la comanda ya existe
        // (PENDING, en Tabs). El cobro la REUTILIZA en vez de crear otra.
        existingOrderId: z.string().uuid().optional(),
        /** RP-2A: clave de idempotencia del cobro (reintentos no duplican). */
        idempotencyKey: z.string().min(8).max(120).optional(),
        /** Confirmación del Rabbitter (pos_charge_requests) obligatoria si hay customerId. */
        chargeApprovalId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.paymentMethod === "CASH") {
        await assertOpenShiftForCash(ctx.restaurantDb, ctx.branchId);
      }
      // P0-3: tarjeta exige referencia de terminal
      assertCardPaymentAllowed(input.paymentMethod, input.cardReference);

      // RP-2A/RP-2B: split efectivo + Bunz sobre el motor canónico.
      // La parte Bunz se captura con paymentCore (saldo + capacidad + libro);
      // nada se cobra fuera de transacción ni se registra CASH en silencio.
      const isSplit = pendingSplit(input);
      if (isSplit) {
        if (!(Number(input.splitCash) > 0) || !(Number(input.splitBunz) > 0)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "SPLIT_INVALID: indica un monto de efectivo y otro de Bunz mayores a 0.",
          });
        }
        if (!input.customerId) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "SPLIT_REQUIRES_CUSTOMER: vincula al Rabbitter para cobrar la parte Bunz.",
          });
        }
        if ((input.discountPercent ?? 0) > 0 || (input.entitlementIds?.length ?? 0) > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "SPLIT_NO_DISCOUNT: no combines cuenta dividida con descuento o membresía.",
          });
        }
      }

      // RP-2A: idempotencia de request. Un reintento devuelve el mismo cobro.
      if (input.idempotencyKey) {
        const [prior] = await ctx.restaurantDb
          .select()
          .from(orders)
          .where(eq(orders.idempotencyKey, input.idempotencyKey))
          .limit(1);
        if (prior) {
          if (prior.status === ORDER_STATUS.COMPLETED) {
            return completedCheckoutResponse(prior, ctx.branchId);
          }
          throw new TRPCError({
            code: "CONFLICT",
            message: "Ya hay un cobro en proceso con esta clave. Espera un momento y reintenta.",
          });
        }
      }

      // 1. Orden: reutiliza la comanda persistente del cliente si existe
      //    (H-PERSIST) — así vincular no deja un borrador huérfano en Tabs.
      let order: typeof orders.$inferSelect;
      if (input.existingOrderId) {
        const [reusedOrder] = await ctx.restaurantDb
          .select({ status: orders.status })
          .from(orders)
          .where(and(eq(orders.id, input.existingOrderId), eq(orders.branchId, ctx.branchId)))
          .limit(1);
        // El helper bloquea por id, no por sucursal: la pertenencia se valida aquí
        // ANTES de mutar (si no, se podría tocar una orden de otro tenant).
        if (!reusedOrder) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "La comanda abierta del cliente ya no está disponible. Vuelve a vincularlo.",
          });
        }
        if (!isOrderPayableStatus(reusedOrder.status)) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `La orden existente no admite cobros (estado ${reusedOrder.status}).`,
          });
        }
        const reused = await ctx.restaurantDb.transaction(async (tx: any) => {
          const { order: updated } = await withOrderMutation(
            tx,
            {
              orderId: input.existingOrderId!,
              type: "CHECKOUT_REUSED_ORDER",
              actor: posActor(ctx),
              allowedStatuses: [ORDER_STATUS.PENDING, ORDER_STATUS.CASH_REQUESTED],
            },
            async (_o: any, _c: any) => {
              await tx
                .update(orders)
                .set({
                  tableId: input.tableId ?? null,
                  orderType: input.orderType,
                  customerId: input.customerId ?? null,
                  customerName: input.customerName ?? null,
                  customerPhone: input.customerPhone ?? null,
                  updatedAt: new Date(),
                })
                .where(eq(orders.id, input.existingOrderId!));
            },
          );
          return updated;
        });
        if (!reused) {
          throw new TRPCError({ code: "NOT_FOUND", message: "La comanda abierta del cliente ya no está disponible. Vuelve a vincularlo." });
        }
        order = reused;
        // La comanda debe seguir siendo un BORRADOR. Si alguien ya le agregó
        // productos (p. ej. desde Operación), NO se borran: se aborta para no
        // perder el pedido del cliente — se cobra desde Operación.
        const [draftItem] = await ctx.restaurantDb
          .select({ id: orderItems.id })
          .from(orderItems)
          .where(eq(orderItems.orderId, order.id))
          .limit(1);
        if (draftItem) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Esa comanda ya tiene productos. Cóbrala desde Operación para no duplicarla ni borrar el pedido del cliente.",
          });
        }
      } else {
        const created = await ctx.restaurantDb.transaction(async (tx: any) =>
          withOrderCreate(tx, { actor: posActor(ctx), idempotencyKey: input.idempotencyKey }, async () => {
            const [row] = await tx
              .insert(orders)
              .values({
                branchId: ctx.branchId,
                tableId: input.tableId ?? null,
                orderType: input.orderType,
                customerId: input.customerId ?? null,
                customerName: input.customerName ?? null,
                customerPhone: input.customerPhone ?? null,
                subtotal: 0,
                tax: 0,
                discount: 0,
                tip: 0,
                total: 0,
                status: "PENDING",
                idempotencyKey: input.idempotencyKey ?? null,
              })
              .onConflictDoNothing({ target: orders.idempotencyKey })
              .returning();
            return row;
          }),
        );
        if (!created) {
          // Carrera: otra petición con la misma clave ganó el insert.
          const [prior] = input.idempotencyKey
            ? await ctx.restaurantDb
                .select()
                .from(orders)
                .where(eq(orders.idempotencyKey, input.idempotencyKey))
                .limit(1)
            : [];
          if (prior && prior.status === ORDER_STATUS.COMPLETED) {
            return completedCheckoutResponse(prior, ctx.branchId);
          }
          throw new TRPCError({
            code: "CONFLICT",
            message: "Ya hay un cobro en proceso con esta clave. Espera un momento y reintenta.",
          });
        }
        order = created;
      }

      if (!order) throw new Error("No se pudo crear la orden en base de datos");

      // 2. Insert items and sum subtotal
      let calculatedSubtotal = 0;
      // Destino de preparación por ítem (ADR-023), resuelto en 3 consultas.
      const checkoutDest = await resolveStationsForItems(ctx.restaurantDb, ctx.branchId, input.items);
      for (const [i, item] of input.items.entries()) {
        const totalPrice = item.price * item.quantity;
        calculatedSubtotal += totalPrice;
        const dest = checkoutDest.get(item.menuItemId);

        await ctx.restaurantDb.insert(orderItems).values({
          orderId: order.id,
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          unitPrice: item.price,
          totalPrice,
          sortOrder: i,
          notes: item.notes ?? null,
          stationId: dest?.stationId ?? null,
          printerId: dest?.printerId ?? null,
          sentToStationAt: dest?.stationId ? new Date() : null,
        });
      }

      // Precios de menú en México tienen el IVA incluido (precios redondos)
      let originalTotal = r2(calculatedSubtotal);
      let calculatedDiscount = 0;
      let finalAmount = originalTotal;

      if (input.discountPercent && input.discountPercent > 0) {
        calculatedDiscount = r2((input.discountPercent / 100) * originalTotal);
        finalAmount = r2(Math.max(0, originalTotal - calculatedDiscount));
      }

      // ── GAP 1: beneficios de membresía aplicados a la venta ──
      // La lógica vive en membershipBenefits.ts (la misma que usa Rabbitty Pay):
      // INCLUDED_PRODUCT, DISCOUNT_PCT, CREDIT_BALANCE y MEMBER_CONSUMPTION.
      let creditApplied = 0;
      // RP-2A: si el cierre atómico falla, se devuelven los beneficios ya
      // consumidos (crédito/cuota) para no cobrarle al cliente dos veces.
      const membershipCompensations: Array<() => Promise<unknown>> = [];
      /** Cuánto cubrió la membresía (para el cierre sin cobro). */
      let benefitsCovered = 0;
      if (input.entitlementIds && input.entitlementIds.length > 0) {
        if (!input.customerId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Vincula al Rabbitter antes de aplicar su beneficio de membresía." });
        }
        const { applyMembershipBenefitsToOrder } = await import("../services/membershipBenefits");
        const applied = await applyMembershipBenefitsToOrder({
          coreDb: ctx.coreDb,
          restaurantDb: ctx.restaurantDb,
          branchId: ctx.branchId,
          staffId: ctx.userId ?? null,
          orderId: order.id,
          items: input.items.map((i) => ({
            menuItemId: i.menuItemId,
            quantity: i.quantity,
            unitPrice: i.price,
          })),
          customerId: input.customerId,
          entitlementIds: input.entitlementIds,
          memberMenuItemIds: input.memberMenuItemIds,
          baseAmount: finalAmount,
        });
        membershipCompensations.push(...applied.compensations);
        creditApplied = applied.creditApplied;
        calculatedDiscount = r2(calculatedDiscount + applied.discount);
        finalAmount = applied.finalAmount;
        benefitsCovered = applied.discount;
      }
      // fin GAP 1

      // Desglose fiscal canónico: subtotal + tax = total (sin discrepancias)
      const { total: calcTotal, subtotal: calcSubtotal, tax: calcTaxAmt } = calcTax(finalAmount);

      const posTip = Math.max(0, Math.round(Number(input.tip || 0) * 100) / 100);

      // ── Cierre cubierto por membresía (content-aware) ──
      // Si la membresía deja el ticket en cero no hay nada que cobrar: no se
      // pide propina (sería una venta sin medio de pago), no hay split y el
      // cobro se completa sin movimiento de caja ni de banco.
      if (input.paymentMethod === "MEMBERSHIP") {
        if (calcTotal > 0.005) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `MEMBERSHIP_REQUIRES_ZERO_TOTAL: el ticket queda en ${calcTotal.toFixed(2)}; cobra el resto con un método real.`,
          });
        }
        if (benefitsCovered <= 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "MEMBERSHIP_REQUIRES_BENEFIT: no hay beneficios de membresía aplicados a esta orden.",
          });
        }
        if (posTip > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Una orden cubierta por membresía no lleva propina (no hay cobro).",
          });
        }
        if (input.splitCash || input.splitBunz) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Una orden cubierta por membresía no se divide." });
        }
      } else if (calcTotal <= 0.005) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "ZERO_TOTAL: esta orden no tiene monto a cobrar; ciérrala como MEMBERSHIP.",
        });
      }

      // ── Gratificaciones voluntarias (H10) — server guard INDEPENDIENTE del
      // medio de pago. Sin opt-in: legacy cap 15% (no rompe lo existente).
      // Con opt-in POS/BOTH: el monto DEBE corresponder a UNA de las fracciones
      // del catálogo del negocio (nunca monto arbitrario ni preseleccionado) ──
      if (posTip > 0) {
        const [tipBranch] = await ctx.restaurantDb
          .select({ restaurantId: branches.restaurantId })
          .from(branches)
          .where(eq(branches.id, ctx.branchId))
          .limit(1);
        let mode = "OFF";
        let pcts: number[] = [];
        if (tipBranch?.restaurantId) {
          const [tipRest] = await ctx.restaurantDb
            .select({ gratuityMode: restaurants.gratuityMode, gratuityPcts: restaurants.gratuityPcts })
            .from(restaurants)
            .where(eq(restaurants.id, tipBranch.restaurantId))
            .limit(1);
          mode = String(tipRest?.gratuityMode || "OFF");
          pcts = parseGratuityPcts(tipRest?.gratuityPcts);
        }
        const verdict = validateGratuity(posTip, calcTotal);
        if (!verdict.ok) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Gratificación inválida para esta orden." });
        }
        if (mode === "POS" || mode === "BOTH") {
          const matchesCatalog = pcts.some(
            (p) => Math.abs(posTip - Math.round(r2(calcTotal) * (p / 100) * 100) / 100) <= 0.05
          );
          if (!matchesCatalog) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "La gratificación debe ser una de las opciones publicadas por el negocio (sin montos arbitrarios ni por canal de pago).",
            });
          }
        }
      }

      // ── Confirmación del Rabbitter OBLIGATORIA (server-side) ──
      // Un POS con bundle viejo (sin el paso de confirmación) no puede cobrar
      // a un Rabbitter vinculado: debe actualizar y pedir la autorización.
      if (input.customerId && input.paymentMethod !== "MEMBERSHIP") {
        if (!input.chargeApprovalId) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "CHARGE_APPROVAL_REQUIRED: actualiza el POS (recarga) y pide la confirmación del Rabbitter antes de cobrar.",
          });
        }
        const [approval] = await ctx.restaurantDb
          .select()
          .from(posChargeRequests)
          .where(and(
            eq(posChargeRequests.id, input.chargeApprovalId),
            eq(posChargeRequests.branchId, ctx.branchId),
            eq(posChargeRequests.customerId, input.customerId),
          ))
          .limit(1);
        if (!approval || approval.status !== "APPROVED") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: approval?.status === "CHARGED"
              ? "CHARGE_APPROVAL_USED: esta autorización ya se usó."
              : "CHARGE_APPROVAL_REQUIRED: el Rabbitter debe autorizar el cobro en su app.",
          });
        }
        if (new Date(approval.expiresAt) < new Date()) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "CHARGE_APPROVAL_EXPIRED: la autorización expiró. Genera el cobro de nuevo.",
          });
        }
        if (r2(calcTotal + Number(posTip || 0)) > Number(approval.amount) + 0.01) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "CHARGE_APPROVAL_MISMATCH: el monto autorizado no cubre el cobro.",
          });
        }
      }

      // ── Cobro 100% Bunz del Rabbitter ya vinculado (sin QR) ──
      // Reutiliza el motor canónico: reserva, captura, libro, capacidad y
      // comprobante. Solo procede si el cajero escaneó/vinculó al cliente.
      if (input.paymentMethod === "BUNZ") {
        if (!input.customerId) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "BUNZ_REQUIRES_CUSTOMER: vincula al Rabbitter antes de cobrar con Bunz.",
          });
        }
        try {
          // Los totales deben estar escritos antes de crear el intent.
          await ctx.restaurantDb.transaction(async (tx: any) => {
            await withOrderMutation(
              tx,
              { orderId: order.id, type: "CHECKOUT_PRICED", actor: posActor(ctx) },
              async (_o: any, _c: any) => {
                await tx
                  .update(orders)
                  .set({
                    subtotal: calcSubtotal,
                    tax: calcTaxAmt,
                    discount: calculatedDiscount,
                    total: calcTotal,
                    tip: posTip,
                  })
                  .where(eq(orders.id, order.id));
              },
            );
          });

          const { createOrGetPaymentIntent, confirmPaymentIntentSettled } = await import("../services/paymentCore");
          const intent = await createOrGetPaymentIntent(ctx.restaurantDb, {
            branchId: ctx.branchId,
            orderId: order.id,
            payerUserId: input.customerId,
            bunzToApply: r2(calcTotal + posTip),
            tipMxn: posTip,
            provider: "BUNZ_ONLY",
          });
          if (Number(intent.netFiatCents) > 0) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: "BUNZ_INSUFFICIENT_FUNDS: el saldo Bunz del Rabbitter no cubre la cuenta.",
            });
          }
          const settled = await confirmPaymentIntentSettled(ctx.restaurantDb, {
            paymentIntentId: intent.intentId,
            verifiedMethod: "BUNZ_ONLY",
            expectedAmountCents: 0,
            expectedCurrency: "MXN",
            expectedBranchId: ctx.branchId,
            paidAtExternal: new Date(),
          });
          if (!settled.success || settled.recoveryHold) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: settled.recoveryHold
                ? "BUNZ_BACKING_INSUFFICIENT: el negocio no tiene capacidad para esta redención."
                : "BUNZ_SETTLE_FAILED",
            });
          }

          if (input.chargeApprovalId) {
            await ctx.restaurantDb
              .update(posChargeRequests)
              .set({ status: "CHARGED", orderId: order.id, updatedAt: new Date() })
              .where(eq(posChargeRequests.id, input.chargeApprovalId));
          }

          return {
            orderId: order.id,
            orderNumber: order.id.slice(-4).toUpperCase(),
            total: calcTotal,
            subtotal: calcSubtotal,
            tax: calcTaxAmt,
            customerName: input.customerName || null,
            awardedBunz: 0,
            rewardQueued: false,
            claimToken: null,
          };
        } catch (err) {
          // Si el cobro Bunz falla, se devuelven los beneficios de membresía.
          for (const compensate of membershipCompensations) {
            try { await compensate(); } catch (compErr) { console.error("[membership] compensación Bunz falló:", compErr); }
          }
          throw err;
        }
      }

      // ── RP-2A · cierre atómico ──────────────────────────────────────────
      // Totales, pago, estado COMPLETED, cierre de mesa y stock se confirman
      // juntos. Si algo falla, no queda una orden pagada sin inventario ni
      // inventario descontado sin pago.
      // Opt-in: el descuento es atómico siempre; bloquear por stock es política
      // aparte (actívala con RABBITTY_STOCK_STRICT=true cuando el inventario sea fiable).
      const strictStock = process.env.RABBITTY_STOCK_STRICT === "true";
      const createdNew = !input.existingOrderId;

      const splitCashPart = isSplit ? r2(Number(input.splitCash)) : 0;
      const splitBunzPart = isSplit ? r2(Number(input.splitBunz)) : 0;
      if (isSplit && Math.abs(splitCashPart + splitBunzPart - calcTotal) > 0.01) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `SPLIT_MISMATCH: efectivo ${splitCashPart} + Bunz ${splitBunzPart} ≠ total ${calcTotal}.`,
        });
      }

      // El intent de Bunz necesita el total de la orden ya escrito.
      if (isSplit) {
        await ctx.restaurantDb.transaction(async (tx: any) => {
          await withOrderMutation(
            tx,
            { orderId: order.id, type: "CHECKOUT_PRICED", actor: posActor(ctx) },
            async (_o: any, _c: any) => {
              await tx
                .update(orders)
                .set({
                  subtotal: calcSubtotal,
                  tax: calcTaxAmt,
                  discount: calculatedDiscount,
                  total: calcTotal,
                  tip: posTip,
                })
                .where(eq(orders.id, order.id));
            },
          );
        });
      }

      // 1) Capturar la parte Bunz con el motor canónico (antes del efectivo).
      let splitBunzPaymentId: string | null = null;
      if (isSplit) {
        const { createOrGetPaymentIntent, confirmPaymentIntentSettled } = await import(
          "../services/paymentCore"
        );
        const intent = await createOrGetPaymentIntent(ctx.restaurantDb, {
          orderId: order.id,
          branchId: ctx.branchId,
          bunzToApply: splitBunzPart,
          payerUserId: input.customerId!,
          tipMxn: 0,
        });
        const settled = await confirmPaymentIntentSettled(ctx.restaurantDb, {
          paymentIntentId: intent.intentId,
          verifiedMethod: "BUNZ_ONLY",
          expectedBranchId: ctx.branchId,
        });
        if (!settled.success || settled.recoveryHold) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: settled.recoveryHold
              ? "SPLIT_BUNZ_FAILED: el afiliado no tiene capacidad para la parte Bunz; no se cobró nada."
              : "SPLIT_BUNZ_FAILED: no se pudo capturar la parte Bunz.",
          });
        }
        const [bunzPayment] = await ctx.restaurantDb
          .select()
          .from(payments)
          .where(
            and(
              eq(payments.orderId, order.id),
              eq(payments.method, "BUNZ"),
              eq(payments.status, "COMPLETED")
            )
          )
          .orderBy(desc(payments.createdAt))
          .limit(1);
        splitBunzPaymentId = bunzPayment?.id ?? null;
      }

      const mainPaymentAmount = isSplit ? splitCashPart : r2(Math.max(0, calcTotal - creditApplied));

      try {
        await ctx.restaurantDb.transaction(async (tx: any) => {
          // Cobro bajo el helper: lock de la orden, versión y bitácora.
          // Todo lo que sigue (totales, pagos, cierre, stock) ocurre con la
          // orden bloqueada, así que dos terminales no pueden cobrarla a la vez.
          await withOrderMutation(
            tx,
            { orderId: order.id, type: "CHECKOUT_PAID", actor: posActor(ctx) },
            async (_o: any, _c: any) => {
          await tx.update(orders).set({
            subtotal: calcSubtotal,
            tax: calcTaxAmt,
            discount: calculatedDiscount,
            total: calcTotal,
            tip: posTip,
          }).where(eq(orders.id, order.id));

          await tx.insert(payments).values({
            orderId: order.id,
            method: input.paymentMethod,
            amount: mainPaymentAmount,
            tipAmount: posTip,
            reference: isCardMethod(input.paymentMethod) ? input.cardReference : undefined,
            verificationMethod: isCardMethod(input.paymentMethod)
              ? "EXTERNAL_TERMINAL"
              : "CASHIER_CONFIRMED",
          });

          if (creditApplied > 0) {
            await tx.insert(payments).values({
              orderId: order.id,
              method: "MEMBERSHIP_CREDIT",
              amount: creditApplied,
              status: "COMPLETED",
              verificationMethod: "MEMBERSHIP_PASS",
            });
          }

          const [paidSum] = await tx
            .select({ total: sql<number>`coalesce(sum(${payments.amount}), 0)` })
            .from(payments)
            .where(and(eq(payments.orderId, order.id), eq(payments.status, "COMPLETED")));
          if (Number(paidSum?.total) + 0.01 < calcTotal) {
            throw new TRPCError({
              code: "CONFLICT",
              message: `SPLIT_INCOMPLETE: pagado ${Number(paidSum?.total).toFixed(2)} de ${calcTotal.toFixed(2)}.`,
            });
          }

          await tx.update(orders).set({ status: ORDER_STATUS.COMPLETED }).where(eq(orders.id, order.id));

          // Liberar la mesa: cerrar la sesión activa de la tabla para que el
          // próximo comensal pueda reclamarla (409 anti-robo no se convierte en DoS).
          if (order.tableId) {
            await tx.update(tableSessions).set({
              status: "CLOSED",
              closedAt: new Date(),
            }).where(and(
              eq(tableSessions.tableId, order.tableId),
              eq(tableSessions.status, "OPEN")
            ));
          }

          // Deducción de stock con guarda atómica: no se vende lo que no hay.
          const deductRecipe = async (menuItemId: string, qty: number, path: Set<string>) => {
            if (path.has(menuItemId)) return;
            path.add(menuItemId);
            const ingredients = await tx.select()
              .from(dbSchema.menuItemIngredients)
              .where(eq(dbSchema.menuItemIngredients.menuItemId, menuItemId));

            for (const ing of ingredients) {
              if (ing.inventoryItemId) {
                const deductionAmount = ing.quantityRequired * qty;
                if (!(deductionAmount > 0)) continue;
                const updated = await tx
                  .update(dbSchema.inventoryItems)
                  .set({ stock: sql`${dbSchema.inventoryItems.stock} - ${deductionAmount}` })
                  .where(and(
                    eq(dbSchema.inventoryItems.id, ing.inventoryItemId),
                    gte(dbSchema.inventoryItems.stock, deductionAmount)
                  ))
                  .returning({ id: dbSchema.inventoryItems.id });

                if (updated.length === 0) {
                  if (strictStock) {
                    throw new TRPCError({
                      code: "CONFLICT",
                      message: `INSUFFICIENT_STOCK:${ing.inventoryItemId}`,
                    });
                  }
                  // Opt-out explícito (RABBITTY_STOCK_STRICT=false): negativo.
                  await tx
                    .update(dbSchema.inventoryItems)
                    .set({ stock: sql`${dbSchema.inventoryItems.stock} - ${deductionAmount}` })
                    .where(eq(dbSchema.inventoryItems.id, ing.inventoryItemId));
                }

                await tx.insert(dbSchema.inventoryMovements).values({
                  itemId: ing.inventoryItemId,
                  branchId: ctx.branchId,
                  type: "SALE_DEDUCTION",
                  quantity: deductionAmount,
                  reference: order.id,
                  notes: `Order ${order.id} completed via Direct POS`,
                });
              } else if (ing.subRecipeId) {
                await deductRecipe(ing.subRecipeId, ing.quantityRequired * qty, path);
              }
            }
            path.delete(menuItemId);
          };

          for (const item of input.items) {
            await deductRecipe(item.menuItemId, item.quantity, new Set());
          }
            },
          );
        });
      } catch (err) {
        // Si la parte Bunz ya se capturó y el cierre falla, se devuelve.
        if (splitBunzPaymentId) {
          try {
            const { refundBunzPayment } = await import("../services/paymentCore");
            await refundBunzPayment(ctx.restaurantDb, {
              paymentId: splitBunzPaymentId,
              amountMxn: splitBunzPart,
              reason: "split: falló el cierre en efectivo",
            });
          } catch (refundError) {
            console.error("[CHECKOUT_SPLIT_REFUND]", refundError);
          }
        }
        // Compensación: devolver beneficios de membresía ya consumidos.
        for (const undo of membershipCompensations) {
          try {
            await undo();
          } catch (compensationError) {
            console.error("[CHECKOUT_COMPENSATION]", compensationError);
          }
        }
        // Si la orden era nueva, no dejar un borrador huérfano.
        // `withOrderRollback` rechaza el borrado si ya hay un pago aplicado:
        // nunca se borra una orden cobrada (ADR-022, riesgo R-A).
        if (createdNew) {
          try {
            await ctx.restaurantDb.transaction(async (tx: any) => {
              await withOrderRollback(
                tx,
                { orderId: order.id, reason: "CHECKOUT_FAILED" },
                async () => {
                  await tx.delete(orderItems).where(eq(orderItems.orderId, order.id));
                  await tx.delete(orders).where(eq(orders.id, order.id));
                },
              );
            });
          } catch (cleanupError) {
            console.error("[CHECKOUT_CLEANUP]", cleanupError);
          }
        } else if (input.idempotencyKey) {
          // Orden reutilizada: liberar la clave para permitir reintento.
          try {
            await ctx.restaurantDb.transaction(async (tx: any) => {
              await withOrderMutation(
                tx,
                { orderId: order.id, type: "CHECKOUT_KEY_RELEASED", actor: posActor(ctx) },
                async (_o: any, _c: any) => {
                  await tx
                    .update(orders)
                    .set({ idempotencyKey: null })
                    .where(eq(orders.id, order.id));
                },
              );
            });
          } catch (cleanupError) {
            console.error("[CHECKOUT_CLEANUP_KEY]", cleanupError);
          }
        }
        throw err;
      }

      // CRM Auto-segmentation & Bunz Minting
      let totalAwardedBunz = 0;
      const [branch] = await ctx.restaurantDb.select().from(dbSchema.branches).where(eq(dbSchema.branches.id, ctx.branchId));
      if (branch) {
        const [restaurant] = await ctx.restaurantDb.select().from(restaurants).where(eq(restaurants.id, branch.restaurantId));
        if (restaurant && input.customerPhone) {
          const [existingCustomer] = await ctx.restaurantDb.select().from(dbSchema.customers).where(
            and(
              eq(dbSchema.customers.restaurantId, restaurant.id),
              eq(dbSchema.customers.phone, input.customerPhone)
            )
          );

          let newVisits = 1;
          let newSpent = finalAmount;
          if (existingCustomer) {
            newVisits = existingCustomer.totalVisits + 1;
            newSpent = existingCustomer.totalSpent + finalAmount;
            let newSegment = newVisits >= 5 ? "VIP" : newVisits > 1 ? "RECURRENT" : "NEW";
            await ctx.restaurantDb.update(dbSchema.customers).set({
              totalVisits: newVisits,
              totalSpent: newSpent,
              lastVisitAt: new Date(),
              segment: newSegment,
            }).where(eq(dbSchema.customers.id, existingCustomer.id));
          } else {
            await ctx.restaurantDb.insert(dbSchema.customers).values({
              restaurantId: restaurant.id,
              phone: input.customerPhone,
              name: input.customerName,
              totalVisits: 1,
              totalSpent: finalAmount,
              lastVisitAt: new Date(),
              segment: "NEW",
            });
          }

          // Mint Bunz si hay cliente identificado (por ID o por teléfono)
          const targetRecipient = input.customerPhone || input.customerId;

          if (targetRecipient) {
            // Self-heal con 1 reintento: la llamada es idempotente por ledger key
            // pos_rwd_${orderId}; un reintento jamás doble-otorga. Si ambos
            // intentos fallan, awardedBunz queda en 0 y el ticket imprime el
            // QR de claim para que el cliente recupere sus Bunz por su boleto.
            // El costo de entrega no genera cashback (hasta tener Rabbitty Ride).
            const deliveryFee = Number((order as { deliveryFee?: number }).deliveryFee ?? 0);
            const rewardBase = Math.max(0, finalAmount - deliveryFee);
            const attemptReward = async (): Promise<{ success: boolean; bunz?: number } | null> => {
              const directBizId = (await resolveBusinessIdFromBranch(ctx.restaurantDb, ctx.branchId)) || ctx.branchId;
              // RP-2B: kill switch de emisión + lista blanca/tope del piloto.
              const expectedReward = Math.floor(
                rewardBase * ((restaurant.defaultRewardRate ?? 20) / 100)
              );
              let emitControl: Awaited<ReturnType<typeof checkOperation>>;
              try {
                emitControl = await checkOperation(ctx.restaurantDb, {
                  affiliateId: restaurant.businessId,
                  operation: "emission",
                  amount: expectedReward,
                  now: new Date(),
                  tables: {
                    limits: bunzEconomicLimits,
                    orders,
                    branches,
                    restaurants,
                    attempts: bunzRedemptionAttempts,
                    obligations: bunzObligations,
                    controlState: bunzControlState,
                  },
                });
              } catch (controlError) {
                // La venta ya está cobrada: un fallo del control no la rompe.
                console.error(`[BUNZ_EMIT_CONTROL] orderId=${order.id}`, controlError);
                return null;
              }
              if (!emitControl.allowed) {
                console.warn(`[BUNZ_EMIT_BLOCKED] orderId=${order.id} ${emitControl.reason}`);
                return null;
              }
              // Recompensa en la moneda del país (MXN) — la tasa USD es solo
              // para valuación de cobros en dólares, no altera el mint.
              try {
              return await miniappClient.rewardBunz(targetRecipient, rewardBase, order.id, directBizId);
              } catch (firstErr) {
                console.error("[POS_REWARD_FAIL] orderId=" + order.id + " intento 1:", firstErr);
                try {
                  await new Promise((r) => setTimeout(r, 800));
                  return await miniappClient.rewardBunz(targetRecipient, rewardBase, order.id, directBizId);
                } catch (secondErr) {
                  console.error("[POS_REWARD_FAIL] orderId=" + order.id + " intento 2 definitivo:", secondErr);
                  return null;
                }
              }
            };

            const res = await attemptReward();
            if (res?.success) {
              totalAwardedBunz = res.bunz || Math.floor(finalAmount * ((restaurant.defaultRewardRate ?? 20) / 100));
              // Guardar Bunz otorgados en la orden para auditoría.
              // Post-commit del cobro: mutación protegida para no pisar una versión ajena.
              await ctx.restaurantDb.transaction(async (tx: any) => {
                await withOrderMutation(
                  tx,
                  { orderId: order.id, type: "BUNZ_REWARD_RECORDED", actor: posActor(ctx) },
                  async (_o: any, _c: any) => {
                    await tx.update(orders).set({ bunzReward: totalAwardedBunz }).where(eq(orders.id, order.id));
                  },
                );
              });
              await recordEmissionBooks(ctx.restaurantDb, {
                orderId: order.id,
                bunz: totalAwardedBunz,
                sandbox: await isSandboxLedgerTx(ctx.restaurantDb, restaurant.businessId, targetRecipient),
                tables: { ledger: bunzLedgerEntries },
              });
              await ctx.restaurantDb.transaction(async (tx) =>
                recognizeActivity(tx, {
                  affiliateId: restaurant.businessId,
                  reward: totalAwardedBunz,
                  orderId: order.id,
                })
              );
              await accrueCommission(ctx.restaurantDb, {
                orderId: order.id,
                affiliateId: restaurant.businessId,
                fiatAmount: finalAmount,
                tables: { obligations: bunzObligations, events: bunzObligationEvents },
              });
            }
          }
        }
      }

      bus.emit(EventTypes.ORDER_CREATED, { orderId: order.id, tableId: input.tableId });
      bus.emit(EventTypes.ORDER_PAID, { orderId: order.id });

      const claimToken = generateTicketClaimToken(order.id, calcTotal, ctx.branchId);

      if (input.chargeApprovalId) {
        await ctx.restaurantDb
          .update(posChargeRequests)
          .set({ status: "CHARGED", orderId: order.id, updatedAt: new Date() })
          .where(eq(posChargeRequests.id, input.chargeApprovalId));
      }

      return {
        success: true,
        orderId: order.id,
        orderNumber: order.id.slice(-4).toUpperCase(),
        total: calcTotal,
        subtotal: calcSubtotal,
        tax: calcTaxAmt,
        customerName: input.customerName || null,
        awardedBunz: totalAwardedBunz || (order as any)?.bunzReward || 0,
        rewardQueued: (totalAwardedBunz > 0) || Boolean((order as any)?.bunzReward && (order as any).bunzReward > 0),
        claimToken,
      };
    }),

  createPaymentIntent: posProcedure
    .input(
      z.object({
        tableId: z.string().optional(),
        orderType: z.enum(["DINE_IN", "TO_GO", "DELIVERY"]).default("DINE_IN"),
        customerName: z.string().optional(),
        customerPhone: z.string().optional(),
        items: z.array(
          z.object({
            menuItemId: z.string(),
            quantity: z.number().min(1),
            price: z.number(),
            notes: z.string().optional(),
          })
        ),
        discountPercent: z.number().min(0).max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Create order
      const order = await ctx.restaurantDb.transaction(async (tx: any) =>
        withOrderCreate(tx, { actor: posActor(ctx) }, async () => {
          const [row] = await tx.insert(orders).values({
            branchId: ctx.branchId,
            tableId: input.tableId ?? null,
            orderType: input.orderType,
            customerName: input.customerName ?? null,
            customerPhone: input.customerPhone ?? null,
            subtotal: 0,
            tax: 0,
            discount: 0,
            tip: 0,
            total: 0,
            status: "PENDING_PAYMENT",
          }).returning();
          return row;
        }),
      );

      if (!order) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Error al crear la orden" });

      // 2. Insert items and sum subtotal
      let calculatedSubtotal = 0;
      const intentDest = await resolveStationsForItems(ctx.restaurantDb, ctx.branchId, input.items);
      for (const [i, item] of input.items.entries()) {
        const totalPrice = item.price * item.quantity;
        calculatedSubtotal += totalPrice;
        const dest = intentDest.get(item.menuItemId);

        await ctx.restaurantDb.insert(orderItems).values({
          orderId: order.id,
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          unitPrice: item.price,
          totalPrice,
          sortOrder: i,
          notes: item.notes ?? null,
          stationId: dest?.stationId ?? null,
          printerId: dest?.printerId ?? null,
          sentToStationAt: dest?.stationId ? new Date() : null,
        });
      }

      // Precios con IVA incluido: el total es la suma exacta (sin centavos de IVA añadido)
      const originalTotal = r2(calculatedSubtotal);
      let finalAmount = originalTotal;
      let calculatedDiscount = 0;

      if (input.discountPercent && input.discountPercent > 0) {
        calculatedDiscount = r2((input.discountPercent / 100) * originalTotal);
        finalAmount = r2(Math.max(0, originalTotal - calculatedDiscount));
      }

      const { total: intentTotal, subtotal: intentBase, tax: intentTax } = calcTax(finalAmount);

      await ctx.restaurantDb.transaction(async (tx: any) => {
        await withOrderMutation(
          tx,
          { orderId: order.id, type: "INTENT_PRICED", actor: posActor(ctx) },
          async (_o: any, _c: any) => {
            await tx.update(orders).set({
              subtotal: intentBase,
              tax: intentTax,
              discount: calculatedDiscount,
              total: intentTotal,
            }).where(eq(orders.id, order.id));
          },
        );
      });

      // 3. Create Payment Intent
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 5); // 5 minutes TTL

      // 1 Bunz = 1 MXN (V1 Fixed Redemption Rate)
      const BUNZ_REDEMPTION_RATE_MXN = 1.00;
      const bunzAmount = finalAmount / BUNZ_REDEMPTION_RATE_MXN;

      const [intent] = await ctx.restaurantDb.insert(dbSchema.paymentIntents).values({
        orderId: order.id,
        merchantId: ctx.branchId,
        amountMxn: finalAmount,
        bunzAmount: bunzAmount,
        status: "PENDING_PAYMENT",
        expiresAt,
      }).returning();

      if (!intent) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Error al crear payment intent" });

      return {
        success: true,
        paymentIntentId: intent.id,
        orderId: order.id,
        expiresAt: intent.expiresAt,
        bunzAmount: intent.bunzAmount,
      };
    }),

  pollPaymentIntent: posProcedure
    .input(z.object({ paymentIntentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [intent] = await ctx.restaurantDb.select().from(dbSchema.paymentIntents)
        .where(eq(dbSchema.paymentIntents.id, input.paymentIntentId));

      if (!intent) throw new TRPCError({ code: "NOT_FOUND", message: "Intent no encontrado" });

      // Check TTL
      if (intent.status === "PENDING_PAYMENT" && new Date() > intent.expiresAt) {
        // ── P0-2: cancelar en Stripe ANTES de expirar ────────────────────
        // Si Stripe ya cobró, no se expira: se reconcilia y se liquida.
        if (
          intent.provider === "STRIPE" &&
          intent.externalIntentId &&
          process.env.STRIPE_SECRET_KEY
        ) {
          try {
            const { cancelStripePaymentIntent, retrieveStripePaymentIntent } = await import(
              "../services/stripeConnect"
            );
            const cancelResult = await cancelStripePaymentIntent(intent.externalIntentId);

            if (cancelResult === "succeeded") {
              const pi = await retrieveStripePaymentIntent(intent.externalIntentId);
              const { confirmPaymentIntentSettled } = await import("../services/paymentCore");
              try {
                const settled = await confirmPaymentIntentSettled(ctx.restaurantDb, {
                  paymentIntentId: intent.id,
                  externalTransactionId: pi.latestCharge,
                  verifiedMethod: "STRIPE_CARD",
                  expectedAmountCents: pi.amount,
                  expectedCurrency: pi.currency ? pi.currency.toUpperCase() : undefined,
                  expectedStripeAccountId: pi.destination,
                  paidAtExternal: pi.succeededAt,
                });
                return { status: settled.status, reconciled: true };
              } catch (settleErr) {
                console.error(
                  "[pollPaymentIntent] Stripe cobró pero no se pudo liquidar:",
                  settleErr
                );
                return { status: "DISCREPANCY", reconciled: false };
              }
            }
            // canceled / already_canceled / not_found → seguro expirar
          } catch (remoteErr) {
            // Error de comunicación/credenciales: NO expirar (evita perder un cobro)
            console.error(
              "[pollPaymentIntent] No se pudo verificar Stripe; no se expira:",
              remoteErr
            );
            return { status: intent.status, pendingRemoteCancel: true };
          }
        }

        // Expire it
        await ctx.restaurantDb.update(dbSchema.paymentIntents).set({ status: "EXPIRED" })
          .where(eq(dbSchema.paymentIntents.id, intent.id));
        
        const expiredOrderId = String(intent.orderId ?? "");
        if (expiredOrderId) {
          await ctx.restaurantDb.transaction(async (tx: any) => {
            await withOrderMutation(
              tx,
              { orderId: expiredOrderId, type: "INTENT_EXPIRED", actor: posActor(ctx) },
              async (_o: any, _c: any) => {
                await tx.update(orders).set({ status: "EXPIRED" }).where(eq(orders.id, expiredOrderId));
              },
            );
          });
          // Fase 1 Rabbitty Score: exclusión inmediata del rating (intent expirado)
          await (await import("./ratings")).invalidateOrderRating(ctx.restaurantDb, expiredOrderId, "INTENT_EXPIRED");
        }

        // Liberar el hold de Bunz reservado (sin esto el saldo queda bloqueado para siempre)
        try {
          const { releasePaymentIntentHold } = await import("../services/paymentCore");
          await releasePaymentIntentHold(ctx.restaurantDb, {
            paymentIntentId: intent.id,
            reason: "INTENT_EXPIRED",
          });
        } catch (releaseErr) {
          console.error("[pollPaymentIntent] Error liberando hold:", releaseErr);
        }

        return { status: "EXPIRED" };
      }

      return { status: intent.status }; // PENDING_PAYMENT, PAYMENT_VERIFIED, EXPIRED
    }),

  /**
   * Fase 3: Rabbitty Tabs & Comandas activas en tienda / mesa.
   * Obtiene todas las mesas ocupadas con órdenes abiertas y clientes identificados.
   */
  getActiveTabs: posProcedure.query(async ({ ctx }) => {
    // Auto-limpieza: tabs huérfanas (nunca pagadas ni ejecutadas) fuera del feed
    const { expireStaleOrders } = await import("../services/tabsSweep");
    await expireStaleOrders(ctx.restaurantDb, ctx.branchId);

    // 1. Obtener todas las mesas de la sucursal
    const allTables = await ctx.restaurantDb
      .select()
      .from(tablesTable)
      .where(eq(tablesTable.branchId, ctx.branchId))
      .orderBy(asc(tablesTable.number));

    // 2. Obtener sesiones de mesa abiertas
    const openSessions = await ctx.restaurantDb
      .select()
      .from(tableSessions)
      .where(and(eq(tableSessions.branchId, ctx.branchId), eq(tableSessions.status, "OPEN")));

    // 3. Obtener órdenes PENDING o CASH_PAYMENT_REQUESTED de la sucursal
    const pendingOrders = await ctx.restaurantDb
      .select()
      .from(orders)
      .where(and(
        eq(orders.branchId, ctx.branchId),
        // Un borrador en $0 (sin productos) no es un pedido: no debe ocupar
        // un tab ni la cola "Desde la App".
        gt(orders.total, 0),
        // PAID incluido: los pedidos pagados con Bunz en la app llegan igual
        // a la cola del POS (antes se quedaban fuera y nunca se preparaban).
        or(
          inArray(orders.status, [ORDER_STATUS.PENDING, ORDER_STATUS.PAID, ORDER_STATUS.CASH_REQUESTED]),
          // PENDING_PAYMENT de local (con mesa) se prepara y se cobra al final.
          // Los pedidos desde casa (sin mesa) NO entran hasta estar pagados.
          and(eq(orders.status, ORDER_STATUS.PENDING_PAYMENT), isNotNull(orders.tableId))
        )
      ))
      .orderBy(desc(orders.createdAt));

    // 4. Productos de las órdenes pendientes — la comanda del Rabbitter
    // (pedida desde la app) debe verse completa en el POS con lo que pidió.
    const orderIds = pendingOrders.map((o) => o.id);
    const deliveriesByOrder = new Map<string, {
      id: string;
      provider: string;
      status: string;
      courierName: string | null;
      courierPhone: string | null;
      trackingUrl: string | null;
      feeCents: number | null;
    }>();
    if (orderIds.length > 0) {
      const rows = await ctx.restaurantDb
        .select({
          orderId: deliveries.orderId,
          id: deliveries.id,
          provider: deliveries.provider,
          status: deliveries.status,
          courierName: deliveries.courierName,
          courierPhone: deliveries.courierPhone,
          trackingUrl: deliveries.trackingUrl,
          feeCents: deliveries.feeCents,
        })
        .from(deliveries)
        .where(inArray(deliveries.orderId, orderIds));
      for (const row of rows) {
        const { orderId, ...rest } = row;
        deliveriesByOrder.set(orderId, rest);
      }
    }

    const itemsByOrder = new Map<string, { name: string; quantity: number; unitPrice: number; notes: string | null; status: string | null }[]>();
    if (orderIds.length > 0) {
      const itemRows = await ctx.restaurantDb
        .select({
          orderId: orderItems.orderId,
          name: menuItems.name,
          quantity: orderItems.quantity,
          unitPrice: orderItems.unitPrice,
          notes: orderItems.notes,
          status: orderItems.status,
        })
        .from(orderItems)
        .leftJoin(menuItems, eq(orderItems.menuItemId, menuItems.id))
        .where(and(inArray(orderItems.orderId, orderIds), sql`${orderItems.voidedAt} IS NULL`));
      for (const row of itemRows) {
        const list = itemsByOrder.get(row.orderId) ?? [];
        list.push({ name: row.name ?? "Producto", quantity: row.quantity, unitPrice: Number(row.unitPrice), notes: row.notes, status: row.status });
        itemsByOrder.set(row.orderId, list);
      }
    }

    // 5. Si hay órdenes con customerId, buscar datos de usuario en coreDb
    const customerIds = Array.from(new Set(
      pendingOrders
        .map((o) => o.customerId)
        .concat(openSessions.map((s) => s.customerId))
        .filter((id): id is string => Boolean(id))
    ));

    let usersMap = new Map<string, { id: string; name: string; phone?: string | null; username?: string | null }>();
    if (customerIds.length > 0) {
      const matchedUsers = await ctx.coreDb
        .select({
          id: coreUsers.id,
          firstName: coreUsers.firstName,
          lastName: coreUsers.lastName,
          username: coreUsers.username,
          phoneNumber: coreUsers.phoneNumber,
        })
        .from(coreUsers)
        .where(inArray(coreUsers.id, customerIds));

      for (const u of matchedUsers) {
        usersMap.set(u.id, {
          id: u.id,
          name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "Rabbitter",
          phone: u.phoneNumber,
          username: u.username,
        });
      }
    }

    // 6. Ensamblar lista de Tabs activos vinculando mesa, orden y cliente
    // H-TRACK: además etapa derivada (contrato compartido con el móvil) y
    // flag de origen (fromApp = pedido desde la app móvil sin mesa — la cola
    // de toma de orden del POS).
    const activeTabs = pendingOrders.map((ord) => {
      const table = allTables.find((t) => t.id === ord.tableId);
      const session = openSessions.find((s) => s.tableId === ord.tableId);
      const resolvedCustomerId = ord.customerId || session?.customerId || null;
      const user = resolvedCustomerId ? usersMap.get(resolvedCustomerId) : null;

      const items = itemsByOrder.get(ord.id) ?? [];
      const stage = deriveOrderStage({
        order: { status: ord.status },
        items: items.map((it) => ({ status: it.status })),
      });
      // PENDING_PAYMENT solo lo crea el checkout de la app; un pedido de mesa
      // de la app también debe entrar a la cola/alert del POS.
      const fromApp = Boolean(resolvedCustomerId) &&
        (ord.status === ORDER_STATUS.PENDING_PAYMENT || !ord.tableId);

      return {
        orderId: ord.id,
        tableId: ord.tableId,
        tableNumber: table?.number ?? null,
        tableLocation: table?.location ?? null,
        orderType: ord.orderType,
        status: ord.status,
        cashRequested: isCashPaymentRequested(ord.status),
        total: Number(ord.total || 0),
        createdAt: ord.createdAt,
        items,
        stage,
        delivery: deliveriesByOrder.get(ord.id) ?? null,
        etaMinutes: ord.etaMinutes ?? null,
        etaAt: ord.etaAt ?? null,
        prepEtaMinutes: ord.prepEtaMinutes ?? null,
        prepEtaAt: ord.prepEtaAt ?? null,
        deliveryAddress: ord.deliveryAddress ?? null,
        fromApp,
        customer: user
          ? {
              id: user.id,
              name: ord.customerName || user.name,
              phone: ord.customerPhone || user.phone,
              username: user.username,
            }
          : ord.customerName || ord.customerPhone
          ? {
              id: resolvedCustomerId,
              name: ord.customerName || "Rabbitter",
              phone: ord.customerPhone || null,
              username: null,
            }
          : null,
      };
    });

    return {
      activeTabs,
      totalActiveCount: activeTabs.length,
    };
  }),

  /**
   * H-TRACK · setOrderStage — el personal mueve la ETAPA del pedido (y el
   * móvil lo ve en su tarjeta de seguimiento). Mapea la etapa a estatus de
   * order_items (lo que ya usa KDS/kitchen) — sin columnas nuevas:
   *   RECEIVED   → items PENDING
   *   PREPARING  → items IN_PROGRESS (mínimo el primero; si ya hay, no rompe)
   *   READY      → todos los items READY
   *   DONE       → items SERVED + orders.status COMPLETED (entrega confirmada
   *                por el personal en el POS).
   * Guard: la orden debe pertenecer a la sucursal de la sesión.
   */
  setOrderStage: posProcedure
    .input(z.object({
      orderId: z.string(),
      stage: z.enum(["RECEIVED", "PREPARING", "READY", "DONE"]),
      /** Minutos que el local promete para tenerlo listo (solo PREPARING). */
      etaMinutes: z.number().int().min(1).max(240).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [order] = await ctx.restaurantDb
        .select({
          id: orders.id,
          branchId: orders.branchId,
          status: orders.status,
          customerId: orders.customerId,
          total: orders.total,
          orderType: orders.orderType,
          deliveryAddress: orders.deliveryAddress,
        })
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Orden no encontrada" });
      if (order.branchId !== ctx.branchId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Orden de otra sucursal" });
      }

      const itemStatusByStage: Record<string, string> = {
        RECEIVED: "PENDING",
        PREPARING: "IN_PROGRESS",
        READY: "READY",
        DONE: "SERVED",
      };
      const itemStatus = itemStatusByStage[input.stage];

      const etaMinutes =
        input.stage === "PREPARING" && input.etaMinutes ? input.etaMinutes : null;

      // Etapa + ítems en una sola mutación protegida: lock, versión y bitácora.
      await ctx.restaurantDb.transaction(async (tx: any) => {
        await withOrderMutation(
          tx,
          { orderId: input.orderId, type: "STAGE_CHANGED", actor: posActor(ctx) },
          async (_o: any, _c: any) => {
            if (etaMinutes) {
              const prepEtaAt = new Date(Date.now() + etaMinutes * 60_000);
              // Si ya hay repartidor (p. ej. Uber), el ETA del cliente lo manda la
              // entrega: aquí solo se guarda el tiempo de cocina para no pisarlo.
              const [hasDelivery] = await tx
                .select({ id: deliveries.id })
                .from(deliveries)
                .where(eq(deliveries.orderId, input.orderId))
                .limit(1);
              await tx
                .update(orders)
                .set({
                  prepEtaMinutes: etaMinutes,
                  prepEtaAt,
                  ...(hasDelivery ? {} : { etaMinutes, etaAt: prepEtaAt }),
                  updatedAt: new Date(),
                })
                .where(eq(orders.id, input.orderId));
            }

            if (input.stage === "DONE") {
              // Entrega confirmada por el personal: la orden se cierra operativamente.
              await tx
                .update(orders)
                .set({ status: "COMPLETED", updatedAt: new Date() })
                .where(eq(orders.id, input.orderId));
            }

            // Items: movimiento BULK de KDS en la etapa; PREPARING no pisa items
            // READY previos (item-level fino lo hace la página de cocina).
            if (input.stage === "PREPARING") {
              await tx
                .update(orderItems)
                .set({ status: "IN_PROGRESS" })
                .where(and(
                  eq(orderItems.orderId, input.orderId),
                  eq(orderItems.status, "PENDING"),
                ));
            } else {
              await tx
                .update(orderItems)
                .set({ status: itemStatus })
                .where(eq(orderItems.orderId, input.orderId));
            }
          },
        );
      });

      // Si el pedido tiene repartidor asignado y el POS marca "listo/en camino",
      // la entrega avanza con la etapa para que el seguimiento no se contradiga.
      if (input.stage === "READY") {
        try {
          await ctx.restaurantDb
            .update(deliveries)
            .set({ status: "PICKED_UP", updatedAt: new Date() })
            .where(and(eq(deliveries.orderId, input.orderId), eq(deliveries.status, "ASSIGNED")));
        } catch { /* la entrega es opcional */ }
      }

      try {
        bus.emit(EventTypes.KDS_ITEM_UPDATED, { orderId: input.orderId, stage: input.stage });
      } catch { /* best-effort */ }

      // Notificar al cliente (si viene de la app): la etapa cambió — outbox de
      // la miniapp vía S2S (idempotente por dedupeKey cuando el stage repite).
      if (order.customerId && input.stage !== "RECEIVED") {
        try {
          // Contexto legible: negocio + qué incluye (sin los dígitos del id).
          const [branchRow] = await ctx.restaurantDb
            .select({ restaurantId: branches.restaurantId })
            .from(branches)
            .where(eq(branches.id, order.branchId))
            .limit(1);
          const [restaurantRow] = branchRow
            ? await ctx.restaurantDb
                .select({ name: restaurants.name })
                .from(restaurants)
                .where(eq(restaurants.id, branchRow.restaurantId))
                .limit(1)
            : [];
          const businessName = restaurantRow?.name || "tu negocio";

          const orderedItems = await ctx.restaurantDb
            .select({ name: menuItems.name, qty: orderItems.quantity })
            .from(orderItems)
            .innerJoin(menuItems, eq(orderItems.menuItemId, menuItems.id))
            .where(eq(orderItems.orderId, input.orderId))
            .limit(6);
          const itemsSummary = orderedItems
            .map((it) => `${it.qty}× ${it.name}`)
            .join(" · ");
          const detail = itemsSummary ? `: ${itemsSummary}` : "";

          const stageCopy: Record<string, { title: string; message: string }> = {
            PREPARING: {
              title: "🔥 Tu pedido está en preparación",
              message: etaMinutes
                ? `Ya estamos preparando tu pedido en ${businessName}${detail}. El local calcula ~${etaMinutes} min.`
                : `Ya estamos preparando tu pedido en ${businessName}${detail}. Te avisamos cuando esté listo.`,
            },
            READY: {
              title: order.orderType === "DELIVERY" ? "🛵 Tu pedido va en camino" : "✅ ¡Pedido listo!",
              message:
                order.orderType === "DELIVERY"
                  ? `Tu pedido de ${businessName} salió a entrega${detail}.${
                      order.deliveryAddress ? ` Destino: ${order.deliveryAddress}.` : ""
                    }`
                  : `Tu pedido en ${businessName} está listo${detail}.`,
            },
            DONE: {
              title: "🎉 Pedido entregado",
              message: `¡Buen provecho! Tu pedido en ${businessName} se entregó y tu cashback Bunz se acredita con la venta.`,
            },
          };
          const copy = stageCopy[input.stage];
          if (copy) {
            const stageKey = `order_stage:${input.orderId}:${input.stage}`;
            await miniappClient.sendNotification({
              userId: order.customerId,
              title: copy.title,
              message: copy.message,
              type: "SYSTEM",
              route: `/track/${input.orderId}`,
              dedupeKey: stageKey,
              // Seguimiento de pedido = aviso "vivo": prioridad alta para que
              // llegue con la pantalla bloqueada y atraviese Focus (iOS).
              priority: "high",
            });

            // ── Live Activity (iOS): la tarjeta de bloqueo cambia de etapa
            // aunque la app esté cerrada (push dirigido al token de la actividad).
            await miniappClient.updateLiveActivity({
              orderId: input.orderId,
              event: input.stage === "DONE" ? "end" : "update",
              contentState: {
                stage: input.stage,
                stageLabel:
                  input.stage === "PREPARING"
                    ? etaMinutes
                      ? `En preparación · ~${etaMinutes} min`
                      : "En preparación"
                    : input.stage === "READY"
                      ? order.orderType === "DELIVERY"
                        ? "En camino"
                        : "Listo para recoger"
                      : input.stage === "DONE"
                        ? "Entregado"
                        : "Pedido recibido",
                step: orderStageStepIndex(input.stage as OrderStage),
                stepCount: 4,
                total: Number(order.total ?? 0),
                itemsSummary: "",
              },
            });
          }
        } catch (noticeErr) {
          console.warn('[setOrderStage] notify cliente falló (no fatal):', noticeErr);
        }
      }

      return { success: true, stage: input.stage };
    }),

  /** Cotiza con Uber Direct (no crea nada todavía). */
  quoteUberDelivery: posProcedure
    .input(z.object({ orderId: z.string(), address: uberAddressSchema.optional() }))
    .mutation(async ({ ctx, input }) => {
      if (!uberDirectConfigured()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Uber Direct no está configurado" });
      }
      const c = await loadDeliveryContext(
        ctx.restaurantDb,
        ctx.coreDb,
        ctx.branchId,
        input.orderId,
        input.address as UberAddress | undefined,
      );
      const quote = await uberQuote({ pickup: c.pickup, dropoff: c.dropoff });
      return { ...quote, orderId: c.order.id };
    }),

  /** Solicita el repartidor a Uber Direct con la cotización aceptada. */
  createUberDelivery: posProcedure
    .input(
      z.object({
        orderId: z.string(),
        quoteId: z.string().min(4),
        feeCents: z.number().int().nonnegative().optional(),
        feePaidBy: z.enum(["BUSINESS", "CUSTOMER"]).default("CUSTOMER"),
        /** ETA de la cotización (fallback si Uber no devuelve dropoff_eta). */
        etaMinutes: z.number().int().min(1).max(600).optional(),
        address: uberAddressSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!uberDirectConfigured()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Uber Direct no está configurado" });
      }
      const c = await loadDeliveryContext(
        ctx.restaurantDb,
        ctx.coreDb,
        ctx.branchId,
        input.orderId,
        input.address as UberAddress | undefined,
      );
      const feeAbsorbedByBusiness = input.feePaidBy === "CUSTOMER" && c.order.status !== "PENDING";
      const effectiveFeePaidBy = feeAbsorbedByBusiness ? "BUSINESS" : input.feePaidBy;

      // Evita solicitar dos veces la misma entrega (doble clic / reintento).
      const [existing] = await ctx.restaurantDb
        .select({ id: deliveries.id, providerDeliveryId: deliveries.providerDeliveryId, trackingUrl: deliveries.trackingUrl })
        .from(deliveries)
        .where(and(eq(deliveries.orderId, c.order.id), eq(deliveries.provider, "UBER_DIRECT")))
        .limit(1);
      if (existing?.providerDeliveryId) {
        return {
          success: true,
          delivery: existing,
          trackingUrl: existing.trackingUrl,
          alreadyRequested: true,
          feeAbsorbedByBusiness: false,
        };
      }

      const created = await uberCreateDelivery({
        quoteId: input.quoteId,
        pickup: c.pickup,
        dropoff: c.dropoff,
        manifestItems: c.items.length > 0 ? c.items : [{ name: "Pedido Rabbitty", quantity: 1 }],
        externalId: c.order.id,
      });
      if (!created.id) {
        throw new TRPCError({ code: "BAD_GATEWAY", message: "Uber no devolvió el id de la entrega" });
      }

      const now = new Date();
      const status = mapUberStatus(created.status);
      // Tiempo estimado de Uber → se refleja en el pedido (y en /track).
      const rawDropoffEta =
        typeof created.raw.dropoff_eta === "string" ? new Date(created.raw.dropoff_eta) : null;
      const quoteEtaAt = input.etaMinutes ? new Date(now.getTime() + input.etaMinutes * 60_000) : null;
      const etaAt =
        rawDropoffEta && !Number.isNaN(rawDropoffEta.getTime()) ? rawDropoffEta : quoteEtaAt;
      const etaMinutes = etaAt
        ? Math.max(1, Math.round((etaAt.getTime() - now.getTime()) / 60000))
        : null;
      const values = {
        provider: "UBER_DIRECT",
        providerDeliveryId: created.id,
        status,
        trackingUrl: created.trackingUrl,
        feeCents: input.feeCents ?? created.feeCents ?? null,
        feePaidBy: effectiveFeePaidBy,
        externalPayload: created.raw as unknown as Record<string, unknown>,
        updatedAt: now,
      };

      const [delivery] = await ctx.restaurantDb
        .insert(deliveries)
        .values({
          id: crypto.randomUUID(),
          orderId: c.order.id,
          branchId: c.order.branchId,
          currency: "MXN",
          ...values,
        })
        .onConflictDoUpdate({ target: deliveries.orderId, set: values })
        .returning();

      // Igual que en MANUAL: si el cliente paga la entrega, se suma una vez.
      const fee = Math.round(Number(values.feeCents ?? 0)) / 100;
      const alreadyCharged = Number(c.order.deliveryFee ?? 0) > 0;
      const shouldCharge =
        values.feePaidBy === "CUSTOMER" && fee > 0 && !alreadyCharged && c.order.status === "PENDING";
      const capturedAddress = input.address;
      const capturedText = capturedAddress
        ? [
            capturedAddress.street1,
            capturedAddress.street2,
            capturedAddress.neighborhood ? `Col. ${capturedAddress.neighborhood}` : "",
            `${capturedAddress.city}, ${capturedAddress.state} ${capturedAddress.zip}`,
          ]
            .filter(Boolean)
            .join(", ")
        : null;

      await ctx.restaurantDb.transaction(async (tx: any) => {
        await withOrderMutation(
          tx,
          { orderId: c.order.id, type: "DELIVERY_CREATED", actor: posActor(ctx) },
          async (_o: any, _c: any) => {
            await tx
              .update(orders)
              .set({
                externalProvider: "UBER_DIRECT",
                externalId: created.id,
                ...(shouldCharge ? { deliveryFee: fee } : {}),
                ...(etaAt ? { etaAt, etaMinutes } : {}),
                ...(capturedAddress
                  ? { deliveryAddress: capturedText, deliveryAddressData: capturedAddress }
                  : {}),
                updatedAt: now,
              })
              .where(eq(orders.id, c.order.id));
          },
        );
      });

      if (c.order.customerId) {
        try {
          await miniappClient.sendNotification({
            userId: c.order.customerId,
            title: "🛵 Repartidor asignado",
            message: "Uber ya asignó a tu repartidor. Puedes seguir tu pedido en tiempo real.",
            type: "SYSTEM",
            route: `/track/${c.order.id}`,
            dedupeKey: `delivery:${c.order.id}:ASSIGNED`,
            priority: "high",
          });
        } catch (notifyErr) {
          console.warn("[createUberDelivery] notificar cliente falló:", notifyErr);
        }
      }

      return { success: true, delivery, trackingUrl: created.trackingUrl, feeAbsorbedByBusiness };
    }),

  /** Cancela la entrega en Uber Direct y localmente. */
  cancelUberDelivery: posProcedure
    .input(z.object({ orderId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [delivery] = await ctx.restaurantDb
        .select({ id: deliveries.id, provider: deliveries.provider, providerDeliveryId: deliveries.providerDeliveryId })
        .from(deliveries)
        .where(eq(deliveries.orderId, input.orderId))
        .limit(1);
      if (!delivery) throw new TRPCError({ code: "NOT_FOUND", message: "Sin entrega para cancelar" });
      if (delivery.provider === "UBER_DIRECT" && delivery.providerDeliveryId) {
        try {
          await uberCancelDelivery(delivery.providerDeliveryId);
        } catch (err) {
          const [row] = await ctx.restaurantDb
            .select({ status: deliveries.status })
            .from(deliveries)
            .where(eq(deliveries.id, delivery.id))
            .limit(1);
          // Si el courier ya la recogió, Uber no permite cancelar: no mentimos
          // localmente; el negocio debe gestionarlo con Uber.
          if (row?.status === "PICKED_UP" || row?.status === "DELIVERED") {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: "Uber ya recogió el pedido; no se puede cancelar desde Rabbitty.",
            });
          }
          console.warn("[cancelUberDelivery] Uber cancel falló (se marca local):", err);
        }
      }
      const [updated] = await ctx.restaurantDb
        .update(deliveries)
        .set({ status: "CANCELLED", updatedAt: new Date() })
        .where(eq(deliveries.id, delivery.id))
        .returning();
      return { success: true, delivery: updated };
    }),

  /** Proveedores de entrega disponibles en este entorno (capacidades reales). */
  deliveryProviders: posProcedure.query(async () => DELIVERY_PROVIDERS),

  /**
   * Asigna un repartidor al pedido (Fase 0: asignación manual).
   * Crea/actualiza la entrega y avisa al cliente con quién lleva su pedido.
   */
  assignDelivery: posProcedure
    .input(
      z.object({
        orderId: z.string(),
        provider: z.enum(["MANUAL", "UBER_DIRECT", "RABBITTY_RIDE"]).default("MANUAL"),
        courierName: z.string().max(80).optional(),
        courierPhone: z.string().max(30).optional(),
        trackingUrl: z.string().url().max(500).optional(),
        feeCents: z.number().int().min(0).max(100000).optional(),
        /** Quién paga la entrega: el negocio la absorbe o se le suma al cliente. */
        feePaidBy: z.enum(["BUSINESS", "CUSTOMER"]).default("BUSINESS"),
        notes: z.string().max(300).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const provider = getProvider(input.provider);
      if (!provider?.available) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: provider?.unavailableReason || "Proveedor de entrega no disponible",
        });
      }
      if (!provider.capabilities.createDelivery) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Este proveedor no puede crear entregas" });
      }

      const [order] = await ctx.restaurantDb
        .select({
          id: orders.id,
          branchId: orders.branchId,
          customerId: orders.customerId,
          orderType: orders.orderType,
          deliveryAddress: orders.deliveryAddress,
          status: orders.status,
          total: orders.total,
          deliveryFee: orders.deliveryFee,
        })
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Orden no encontrada" });
      if (order.branchId !== ctx.branchId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Orden de otra sucursal" });
      }

      const [uberExisting] = await ctx.restaurantDb
        .select({ provider: deliveries.provider, providerDeliveryId: deliveries.providerDeliveryId })
        .from(deliveries)
        .where(eq(deliveries.orderId, input.orderId))
        .limit(1);
      if (uberExisting?.provider === "UBER_DIRECT" && uberExisting.providerDeliveryId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Este pedido ya tiene una entrega de Uber Direct. Cancélala antes de asignar a mano.",
        });
      }

      // Si la orden ya se pagó, no hay forma de cobrarle la entrega al cliente:
      // se registra como absorbida por el negocio (sin bloquear la operación).
      const feeAbsorbedByBusiness = input.feePaidBy === "CUSTOMER" && order.status !== "PENDING";
      const effectiveFeePaidBy = feeAbsorbedByBusiness ? "BUSINESS" : input.feePaidBy;

      const now = new Date();
      const courierName = input.courierName?.trim() || null;
      const courierPhone = input.courierPhone?.trim() || null;
      const values = {
        provider: provider.id,
        providerDeliveryId: null as string | null,
        status: "ASSIGNED",
        courierName,
        courierPhone,
        trackingUrl: input.trackingUrl || null,
        feeCents: input.feeCents ?? null,
        feePaidBy: effectiveFeePaidBy,
        notes: input.notes?.trim() || null,
        updatedAt: now,
      };

      const [delivery] = await ctx.restaurantDb
        .insert(deliveries)
        .values({
          id: crypto.randomUUID(),
          orderId: order.id,
          branchId: order.branchId,
          currency: "MXN",
          ...values,
        })
        .onConflictDoUpdate({ target: deliveries.orderId, set: values })
        .returning();

      // Si el cliente paga la entrega, se suma UNA sola vez y solo si la
      // orden aún no está pagada (si ya se cobró, se registra aparte).
      const fee = Math.round(Number(input.feeCents ?? 0)) / 100;
      const alreadyCharged = Number(order.deliveryFee ?? 0) > 0;
      const shouldCharge =
        effectiveFeePaidBy === "CUSTOMER" && fee > 0 && !alreadyCharged && order.status === "PENDING";
      await ctx.restaurantDb.transaction(async (tx: any) => {
        await withOrderMutation(
          tx,
          { orderId: order.id, type: "DELIVERY_ASSIGNED", actor: posActor(ctx) },
          async (_o: any, _c: any) => {
            await tx
              .update(orders)
              .set({
                externalProvider: provider.id,
                ...(shouldCharge ? { deliveryFee: fee, total: Number(order.total ?? 0) + fee } : {}),
                updatedAt: now,
              })
              .where(eq(orders.id, order.id));
          },
        );
      });

      if (order.customerId) {
        try {
          await miniappClient.sendNotification({
            userId: order.customerId,
            title: "🛵 Repartidor asignado",
            message: courierName
              ? `${courierName} llevará tu pedido. Te avisamos cuando salga.`
              : "Tu pedido ya tiene repartidor asignado. Te avisamos cuando salga.",
            type: "SYSTEM",
            route: `/track/${input.orderId}`,
            dedupeKey: `delivery:${order.id}:ASSIGNED`,
            priority: "high",
          });
        } catch (notifyErr) {
          console.warn("[assignDelivery] notificar cliente falló (no fatal):", notifyErr);
        }
      }

      return { success: true, delivery, feeAbsorbedByBusiness };
    }),

  /** Avanza el estado de la entrega (recogido / entregado / cancelado). */
  advanceDelivery: posProcedure
    .input(
      z.object({
        orderId: z.string(),
        status: z.enum(["PICKED_UP", "DELIVERED", "CANCELLED", "FAILED", "NEEDS_MANUAL_ACTION"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [order] = await ctx.restaurantDb
        .select({ id: orders.id, branchId: orders.branchId, customerId: orders.customerId, etaAt: orders.etaAt })
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Orden no encontrada" });
      if (order.branchId !== ctx.branchId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Orden de otra sucursal" });
      }

      const [current] = await ctx.restaurantDb
        .select({ id: deliveries.id, status: deliveries.status, provider: deliveries.provider })
        .from(deliveries)
        .where(eq(deliveries.orderId, order.id))
        .limit(1);
      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Este pedido no tiene entrega asignada" });
      if (current.provider === "UBER_DIRECT") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "El estado lo actualiza Uber Direct; usa el seguimiento o cancela la entrega.",
        });
      }
      if (!canTransition(current.status, input.status as DeliveryStatus)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `No se puede pasar de ${current.status} a ${input.status}`,
        });
      }

      const [delivery] = await ctx.restaurantDb
        .update(deliveries)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(deliveries.orderId, order.id))
        .returning();

      if (order.customerId) {
        const copy: Record<string, { title: string; message: string }> = {
          PICKED_UP: {
            title: "🛵 Tu pedido va en camino",
            message: order.etaAt
              ? `El repartidor ya recogió tu pedido y llega aproximadamente a las ${new Date(order.etaAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}.`
              : "El repartidor ya recogió tu pedido y va hacia tu dirección.",
          },
          DELIVERED: {
            title: "✅ Pedido entregado",
            message: "¡Buen provecho! Tu pedido se entregó. Tu cashback Bunz se acredita con la venta.",
          },
          CANCELLED: {
            title: "❌ Entrega cancelada",
            message: "La entrega de tu pedido se canceló. El local se pondrá en contacto contigo.",
          },
          FAILED: {
            title: "⚠️ Problema con la entrega",
            message: "La entrega no se pudo completar. El local revisará tu pedido.",
          },
        };
        const notice = copy[input.status];
        if (notice) {
          try {
            await miniappClient.sendNotification({
              userId: order.customerId,
              title: notice.title,
              message: notice.message,
              type: "SYSTEM",
              route: `/track/${input.orderId}`,
              dedupeKey: `delivery:${order.id}:${input.status}`,
              priority: "high",
            });
          } catch (notifyErr) {
            console.warn("[advanceDelivery] notificar cliente falló (no fatal):", notifyErr);
          }
        }
      }

      return { success: true, delivery };
    }),

  /**
   * Fase 3: Envío directo de la cuenta digital al móvil del Rabbitter.
   * Despacha enlace de pago (/pay/[orderId]) vía Push nativo (APNs/in-app) o WhatsApp deep-link.
   */
  sendBillToCustomer: posProcedure
    .input(
      z.object({
        orderId: z.string(),
        customerId: z.string().optional(),
        phone: z.string().optional(),
        customerName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Obtener la orden
      const [order] = await ctx.restaurantDb
        .select()
        .from(orders)
        .where(and(eq(orders.id, input.orderId), eq(orders.branchId, ctx.branchId)))
        .limit(1);

      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Orden no encontrada en esta sucursal" });
      }

      // 2. Obtener datos de la sucursal y restaurante para el mensaje
      const [branch] = await ctx.restaurantDb
        .select()
        .from(branches)
        .where(eq(branches.id, ctx.branchId))
        .limit(1);

      const [restaurant] = branch
        ? await ctx.restaurantDb
            .select()
            .from(restaurants)
            .where(eq(restaurants.id, branch.restaurantId))
            .limit(1)
        : [null];

      const businessName = restaurant?.name || "Rabbitty";
      const totalFormatted = `$${Number(order.total || 0).toFixed(2)}`;
      const webBillUrl = `https://admin.rabbitty.me/pay/${order.id}`;

      // 3. Vincular cliente a la orden si no estaba vinculado
      if (input.customerId || input.customerName || input.phone) {
        await ctx.restaurantDb.transaction(async (tx: any) => {
          await withOrderMutation(
            tx,
            { orderId: order.id, type: "BILL_CUSTOMER_LINKED", actor: posActor(ctx) },
            async (_o: any, _c: any) => {
              await tx
                .update(orders)
                .set({
                  customerId: input.customerId || order.customerId,
                  customerName: input.customerName || order.customerName,
                  customerPhone: input.phone || order.customerPhone,
                })
                .where(eq(orders.id, order.id));
            },
          );
        });
      }

      let pushSent = false;
      const targetUserId = input.customerId || order.customerId;

      // 4. Si el cliente tiene cuenta de usuario (UUID), enviar Push Notification
      // CON route: al tocarla abre la página de pago in-app (/pay/[orderId])
      // donde puede pagar con tarjeta, Apple Pay (web) o pedir cuenta en caja.
      if (targetUserId) {
        try {
          await miniappClient.sendNotification({
            userId: targetUserId,
            title: `🧾 Cuenta lista en ${businessName} (${totalFormatted})`,
            message: `Tu cuenta de ${totalFormatted} está lista. Toca aquí para ver el detalle y pagar con Apple Pay, Tarjeta o Bunz.`,
            // Aviso de cuenta/pago: categoría ORDERS y no silenciable.
            type: "ACCOUNT_BILL_SENT",
            route: `/pay/${order.id}`,
          });
          pushSent = true;
        } catch (pushErr) {
          console.warn("[SEND_BILL] Push notification error:", pushErr);
        }
      }

      // 5. Preparar deep-link de WhatsApp para entrega omnicanal
      const targetPhone = input.phone || order.customerPhone;
      let whatsappUrl: string | null = null;
      if (targetPhone) {
        const cleanPhone = targetPhone.replace(/\D/g, "");
        const formattedPhone = cleanPhone.length === 10 ? `52${cleanPhone}` : cleanPhone;
        const msg =
          `¡Hola ${input.customerName || order.customerName || ""}! 🐰\n\n` +
          `Tu cuenta en *${businessName}* por *${totalFormatted}* está lista.\n\n` +
          `Puedes revisarla y pagarla directamente desde tu móvil aquí:\n` +
          `${webBillUrl}\n\n` +
          `¡Acumula Bunz en cada visita! ✨`;
        whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`;
      }

      return {
        success: true,
        orderId: order.id,
        webBillUrl,
        pushSent,
        whatsappUrl,
        total: Number(order.total || 0),
        customerName: input.customerName || order.customerName || "Rabbitter",
      };
    }),
  /**
   * OT-1: registra un intento de redención RECHAZADO con su motivo.
   * El motivo es obligatorio (catálogo cerrado). Idempotente por `idempotencyKey`.
   * No es fatal: si la tabla no existe, devuelve `{ ok: false }` sin romper el POS.
   */
  recordRedemptionAttempt: posProcedure
    .input(
      z.object({
        orderId: z.string().optional(),
        bunz: z.number().positive(),
        reasons: z.array(z.enum(REDEMPTION_REASONS)).min(1),
        status: z.enum(["unfulfilled", "cancelled", "fraud", "duplicate"]).default("unfulfilled"),
        waitSeconds: z.number().int().min(0).optional(),
        userRef: z.string().max(120).optional(),
        idempotencyKey: z.string().max(120).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const key = input.idempotencyKey ?? crypto.randomUUID();
      try {
        await ctx.restaurantDb
          .insert(bunzRedemptionAttempts)
          .values({
            id: key,
            userHash: input.userRef ?? "walkin",
            branchId: ctx.branchId,
            orderId: input.orderId ?? null,
            rewardId: null,
            bunzRequested: input.bunz,
            bunzFulfilled: 0,
            status: input.status,
            reasons: JSON.stringify(input.reasons),
            waitSeconds: input.waitSeconds ?? null,
            idempotencyKey: key,
          })
          .onConflictDoNothing();
        return { ok: true };
      } catch (e) {
        console.warn(`[pos] intento de redención ${key} no registrado: ${e instanceof Error ? e.message : e}`);
        return { ok: false, error: "no se pudo registrar el motivo" };
      }
    }),

});
