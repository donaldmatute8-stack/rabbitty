import { z } from "zod";
import { and, eq, inArray, gte, lt, sql, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { assertCardPaymentAllowed, isCardMethod } from "../services/cardGuard";
import { router, posProcedure, posPermission, publicLimitedProcedure, resolveBranchId } from "../trpc";
import { orders, payments, paymentIntents, tables, tableSessions, orderItems, menuItems } from "@rabbitty/database-restaurant/schema";
import { bus, EventTypes } from "@rabbitty/events";
import { assertOpenShiftForCash, findStaffByPin, CASHIER_ROLES } from "../services/cashShift";
import { buildShadowReport, getRecentShadowDiffs } from "../services/payments/shadow";
import { validateBunzCoreSettlement } from "../services/payments/bunzParity";

export const paymentsRouter = router({
  /**
   * RP-0.3: liquidar un intent 100% Bunz creado por paymentCore.
   * Solo el pagador autenticado puede liquidarlo.
   */
  settleBunzIntent: posProcedure
    .input(z.object({ intentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Sesión requerida." });
      }

      const [intent] = await ctx.restaurantDb
        .select()
        .from(paymentIntents)
        .where(eq(paymentIntents.id, input.intentId))
        .limit(1);

      if (!intent) throw new TRPCError({ code: "NOT_FOUND", message: "Intent no encontrado." });
      if (intent.provider !== "BUNZ_ONLY" || Number(intent.netFiatCents) !== 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Solo se liquidan intents 100% Bunz por esta vía.",
        });
      }
      if (intent.payerSubjectId && intent.payerSubjectId !== ctx.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "El intento pertenece a otra sesión." });
      }
      if (!intent.orderId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "El intento no tiene orden asociada." });
      }

      const [order] = await ctx.restaurantDb
        .select({ branchId: orders.branchId })
        .from(orders)
        .where(eq(orders.id, intent.orderId))
        .limit(1);
      if (!order || order.branchId !== intent.merchantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "La orden no corresponde a la sucursal del intent." });
      }

      // RP-0.4: paridad exacta (Bunz aplicado = monto del intent, sin fiat)
      const parity = validateBunzCoreSettlement({
        owedMxn: Number(intent.amountCents || 0) / 100,
        netFiatCents: Number(intent.netFiatCents || 0),
        bunzApplied: Number(intent.bunzAmount || 0),
      });
      if (!parity.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            parity.error === "INSUFFICIENT_STOCK"
              ? "El negocio no tiene stock suficiente para esta redención."
              : "El intent no cubre la cuenta completa con Bunz.",
        });
      }

      const { confirmPaymentIntentSettled } = await import("../services/paymentCore");
      return await confirmPaymentIntentSettled(ctx.restaurantDb, {
        paymentIntentId: intent.id,
        verifiedMethod: "BUNZ_ONLY",
        expectedAmountCents: 0,
        expectedCurrency: intent.currency,
        expectedBranchId: intent.merchantId,
        paidAtExternal: new Date(),
      });
    }),

  /**
   * RP-0.7: estado canónico de una orden (lectura, sin cambios de estado).
   * Permite que la UI/POS consulten el predicado nuevo antes de cablearlo.
   */
  getOrderPaymentState: posProcedure
    .input(z.object({ orderId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [order] = await ctx.restaurantDb
        .select()
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Orden no encontrada." });
      if (order.branchId !== ctx.branchId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "La orden no pertenece a esta sucursal." });
      }

      const paymentRows = await ctx.restaurantDb
        .select()
        .from(payments)
        .where(eq(payments.orderId, order.id));

      const report = buildShadowReport({ order, payments: paymentRows });
      return {
        orderId: order.id,
        orderStatus: order.status,
        totalMinor: report.totalMinor,
        legacy: report.legacy,
        canonical: report.canonical,
        matches: report.matches,
      };
    }),

  /**
   * RP-0.7: qué motor de Bunz está configurado (read-only, para staging).
   */
  diagnosticsEngine: posProcedure.query(() => ({
    bunzPayEngine: process.env.RABBITTY_PAY_ENGINE_V2 === "1" ? "core_v2" : "legacy_domain",
    shadowEnabled: true,
  })),

  /**
   * RP-0.2: diagnóstico shadow (read-only).
   * Compara el predicado legacy con el canónico sin cambiar estados ni dinero.
   */
  diagnosticsShadow: posProcedure
    .input(z.object({ orderId: z.string().optional(), intentId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      if (!input.orderId && !input.intentId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Indica orderId o intentId." });
      }

      let intent: typeof paymentIntents.$inferSelect | null = null;
      let orderId = input.orderId;

      if (input.intentId) {
        const [row] = await ctx.restaurantDb
          .select()
          .from(paymentIntents)
          .where(eq(paymentIntents.id, input.intentId))
          .limit(1);
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Intent no encontrado." });
        intent = row;
        orderId = row.orderId ?? orderId;
      }

      if (!orderId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "El intent no tiene orden asociada." });
      }

      const [order] = await ctx.restaurantDb
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Orden no encontrada." });
      if (order.branchId !== ctx.branchId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "La orden no pertenece a esta sucursal." });
      }

      const paymentRows = await ctx.restaurantDb
        .select()
        .from(payments)
        .where(eq(payments.orderId, orderId));

      const report = buildShadowReport({ order, payments: paymentRows, intent });

      return {
        report,
        recent: getRecentShadowDiffs().slice(0, 20),
      };
    }),

  refund: posPermission("POS_REFUND")
    .input(z.object({
      paymentId: z.string(),
      amount: z.number().positive(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [payment] = await ctx.restaurantDb.select().from(payments).where(eq(payments.id, input.paymentId)).limit(1);
      if (!payment) throw new Error("Pago no encontrado");
      if (payment.orderId) {
        const [pOrder] = await ctx.restaurantDb.select({ branchId: orders.branchId }).from(orders).where(eq(orders.id, payment.orderId)).limit(1);
        if (!pOrder || pOrder.branchId !== ctx.branchId) throw new TRPCError({ code: "FORBIDDEN", message: "Pago no pertenece a esta sucursal" });
      }
      if (payment.status === "REFUNDED") throw new Error("El pago ya fue reembolsado");

      const original = Math.abs(Number(payment.amount || 0));
      const refundAmount = Math.abs(Number(input.amount));
      if (refundAmount > original + 0.01) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "El reembolso supera el monto del pago." });
      }

      // ── P0-7: reembolso real en Stripe (tarjeta) ──────────────────────
      if (isCardMethod(payment.method)) {
        const rawRef = String(payment.reference ?? "");
        let chargeId: string | undefined = rawRef.startsWith("ch_") ? rawRef : undefined;
        const { getStripeClient } = await import("../services/stripeConnect");
        const stripe = getStripeClient();

        if (!chargeId && rawRef.startsWith("pi_")) {
          const pi = await stripe.paymentIntents.retrieve(rawRef);
          chargeId = typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge?.id;
        }
        if (!chargeId) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "REFUND_REQUIRES_STRIPE_REFERENCE: no hay cargo de Stripe asociado a este pago.",
          });
        }

        await stripe.refunds.create({
          charge: chargeId,
          amount: Math.round(refundAmount * 100),
          reverse_transfer: true,
          refund_application_fee: true,
          metadata: {
            rabbittyPaymentId: payment.id,
            orderId: payment.orderId ?? "",
            reason: input.reason ?? "Rabbitty refund",
          },
        });
      }

      // Bunz: reverso real (saldo del usuario + stock del afiliado)
      if (String(payment.method).toUpperCase() === "BUNZ") {
        const { refundBunzPayment } = await import("../services/paymentCore");
        const result = await refundBunzPayment(ctx.restaurantDb, {
          paymentId: payment.id,
          amountMxn: refundAmount,
          reason: input.reason,
        });
        bus.emit(EventTypes.PAYMENT_PROCESSED, {
          paymentId: payment.id,
          orderId: payment.orderId,
          type: "REFUND",
        });
        return { success: true, method: "BUNZ", ...result };
      }

      const [refund] = await ctx.restaurantDb.insert(payments).values({
        orderId: payment.orderId,
        method: payment.method,
        amount: -refundAmount,
        reference: `Refund: ${input.reason || "Sin razón"}`,
        status: "REFUNDED",
      }).returning();

      const isFull = Math.abs(refundAmount - original) < 0.01;
      await ctx.restaurantDb
        .update(payments)
        .set({ status: isFull ? "REFUNDED" : "PARTIALLY_REFUNDED" })
        .where(eq(payments.id, input.paymentId));

      // OT-3: reembolso total ⇒ revertir la recompensa emitida (clawback).
      if (isFull && payment.orderId) {
        const { reverseOrderLedger } = await import("../services/paymentCore");
        await reverseOrderLedger(ctx.restaurantDb, { orderId: payment.orderId, types: ["reward"] });
      }

      bus.emit(EventTypes.PAYMENT_PROCESSED, { paymentId: refund!.id, orderId: payment.orderId, type: "REFUND" });
      return refund;
    }),

  /**
   * P0-7: resolver una discrepancia de liquidación.
   * - REFUND: reembolsa el cargo en Stripe.
   * - RECONCILE / EXCEPTION: cierra el caso con nota.
   */
  resolveDiscrepancy: posPermission("POS_REFUND")
    .input(z.object({
      eventId: z.string(),
      action: z.enum(["REFUND", "RECONCILE", "EXCEPTION"]),
      note: z.string().max(300).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { paymentProviderEvents } = await import("@rabbitty/database-restaurant/schema");
      const [ev] = await ctx.restaurantDb
        .select()
        .from(paymentProviderEvents)
        .where(eq(paymentProviderEvents.eventId, input.eventId))
        .limit(1);

      if (!ev) throw new TRPCError({ code: "NOT_FOUND", message: "Evento no encontrado." });
      if (ev.status !== "DISCREPANCY") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `El evento está en estado ${ev.status}; solo se resuelven discrepancias.`,
        });
      }

      const { resolveProviderWebhookDiscrepancy } = await import("../services/paymentCore");

      if (input.action === "REFUND") {
        const payload = ev.payload as unknown as {
          data?: { object?: { latest_charge?: string | { id?: string } } };
        };
        const rawCharge = payload?.data?.object?.latest_charge;
        const chargeId = typeof rawCharge === "string" ? rawCharge : rawCharge?.id;
        if (!chargeId) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "El evento no contiene un cargo de Stripe para reembolsar.",
          });
        }
        const { getStripeClient } = await import("../services/stripeConnect");
        await getStripeClient().refunds.create({
          charge: chargeId,
          reverse_transfer: true,
          refund_application_fee: true,
          metadata: {
            rabbittyEventId: ev.eventId,
            reason: input.note ?? "discrepancy",
          },
        });
        await resolveProviderWebhookDiscrepancy(ctx.restaurantDb, {
          eventId: ev.eventId,
          status: "REFUNDED",
          note: input.note,
        });
        return { success: true, status: "REFUNDED" };
      }

      const status = input.action === "RECONCILE" ? "RECONCILED" : "RESOLVED_WITH_EXCEPTION";
      await resolveProviderWebhookDiscrepancy(ctx.restaurantDb, {
        eventId: ev.eventId,
        status,
        note: input.note,
      });
      return { success: true, status };
    }),

  processPayment: posPermission("POS_CHARGE")
    .input(
      z.object({
        orderId: z.string(),
        method: z.enum(["CASH", "CREDIT_CARD", "DEBIT_CARD", "BUNZ"]),
        amount: z.number(),
        reference: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.method === "CASH") {
        await assertOpenShiftForCash(ctx.restaurantDb, ctx.branchId);
      }
      // P0-3: tarjeta exige referencia de terminal
      assertCardPaymentAllowed(input.method, input.reference);
      const order = await ctx.restaurantDb.select().from(orders).where(eq(orders.id, input.orderId));
      if (!order) throw new Error("Orden no encontrada");

      const [payment] = await ctx.restaurantDb.insert(payments).values({
        orderId: input.orderId,
        method: input.method,
        amount: input.amount,
        reference: input.reference ?? null,
        verificationMethod: isCardMethod(input.method) ? "EXTERNAL_TERMINAL" : undefined,
      }).returning();

      if (!payment) throw new Error("Error al procesar el pago");

      bus.emit(EventTypes.PAYMENT_PROCESSED, { paymentId: payment.id, orderId: input.orderId });
      return payment;
    }),

  splitBill: posPermission("POS_CHARGE")
    .input(z.object({
      orderId: z.string(),
      splits: z.array(z.object({
        customerName: z.string().optional(),
        amount: z.number().min(1),
        method: z.enum(["CASH", "CREDIT_CARD", "DEBIT_CARD", "BUNZ"]),
      })).min(2),
    }))
    .mutation(async ({ ctx, input }) => {
      const [order] = await ctx.restaurantDb.select().from(orders).where(eq(orders.id, input.orderId));
      if (!order) throw new Error("Orden no encontrada");

      const totalSplit = input.splits.reduce((s, p) => s + p.amount, 0);
      if (Math.abs(totalSplit - order.total) > 0.01) {
        throw new Error("La suma de los splits no coincide con el total de la orden");
      }

      const results = [];
      for (const split of input.splits) {
        if (split.method === "CASH") {
          await assertOpenShiftForCash(ctx.restaurantDb, ctx.branchId);
        }
        const [payment] = await ctx.restaurantDb.insert(payments).values({
          orderId: input.orderId,
          method: split.method,
          amount: split.amount,
          reference: split.customerName ? `Split: ${split.customerName}` : "Split bill",
        }).returning();
        if (payment) results.push(payment);
      }

      bus.emit(EventTypes.PAYMENT_PROCESSED, { orderId: input.orderId, splitCount: results.length });
      return { success: true, payments: results };
    }),

  addTip: posPermission("POS_CHARGE")
    .input(z.object({
      orderId: z.string(),
      tip: z.number().min(0),
      method: z.enum(["CASH", "CREDIT_CARD", "DEBIT_CARD"]).default("CASH"),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.tip <= 0) throw new Error("La propina debe ser mayor a 0");
      if (input.method === "CASH") {
        await assertOpenShiftForCash(ctx.restaurantDb, ctx.branchId);
      }

      const [payment] = await ctx.restaurantDb.insert(payments).values({
        orderId: input.orderId,
        method: input.method,
        amount: input.tip,
        reference: "Tip",
      }).returning();

      await ctx.restaurantDb.update(orders).set({
        tip: sql`${orders.tip} + ${input.tip}`,
      }).where(eq(orders.id, input.orderId));

      return payment;
    }),

  list: posProcedure
    .input(z.object({
      branchId: z.string().optional(),
      limit: z.number().default(50),
      offset: z.number().default(0),
      status: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [];
      const branchId = ctx.staffRole ? ctx.staffBranchId : input.branchId;
      if (branchId) conditions.push(eq(orders.branchId, branchId));
      if (input.status) conditions.push(eq(payments.status, input.status));

      const query = ctx.restaurantDb.select({
        payment: payments,
        order: { id: orders.id, total: orders.total, status: orders.status, customerName: orders.customerName, branchId: orders.branchId },
      })
        .from(payments)
        .leftJoin(orders, eq(payments.orderId, orders.id))
        .orderBy(sql`${payments.createdAt} DESC`)
        .limit(input.limit)
        .offset(input.offset);

      const where = conditions.length > 0 ? and(...conditions) : undefined;
      return where ? await query.where(where) : await query;
    }),

  getByOrder: posProcedure
    .input(z.object({ orderId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.restaurantDb.select().from(payments).where(eq(payments.orderId, input.orderId));
    }),

  getTotals: posProcedure
    .input(z.object({ startDate: z.string(), endDate: z.string() }))
    .query(async ({ ctx, input }) => {
      const start = input.startDate ? new Date(input.startDate) : new Date(0);
      const end = input.endDate ? new Date(input.endDate) : new Date();
      end.setDate(end.getDate() + 1);

      const [cashPayments, cardPayments, bunzPayments] = await Promise.all([
        ctx.restaurantDb.select().from(payments).where(
          and(eq(payments.method, "CASH"), gte(payments.createdAt, start), lt(payments.createdAt, end))
        ),
        ctx.restaurantDb.select().from(payments).where(
          and(inArray(payments.method, ["CREDIT_CARD", "DEBIT_CARD"]), gte(payments.createdAt, start), lt(payments.createdAt, end))
        ),
        ctx.restaurantDb.select().from(payments).where(
          and(eq(payments.method, "BUNZ"), gte(payments.createdAt, start), lt(payments.createdAt, end))
        ),
      ]);
      return {
        cash: cashPayments.reduce((sum, p) => sum + p.amount, 0),
        card: cardPayments.reduce((sum, p) => sum + p.amount, 0),
        bunz: bunzPayments.reduce((sum, p) => sum + p.amount, 0),
        total: cashPayments.reduce((sum, p) => sum + p.amount, 0) + cardPayments.reduce((sum, p) => sum + p.amount, 0) + bunzPayments.reduce((sum, p) => sum + p.amount, 0),
      };
    }),

  // Public procedure for in-table QR payment
  getOrderForPayment: publicLimitedProcedure
    .input(z.object({ orderId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [order] = await ctx.restaurantDb.select().from(orders).where(eq(orders.id, input.orderId));
      if (!order) throw new Error("Orden no encontrada");
      if (order.status === "PAID" || order.status === "VOID") throw new Error("Orden ya pagada o cancelada");

      const items = await ctx.restaurantDb.select().from(orderItems).where(eq(orderItems.orderId, input.orderId));
      // Nombre del producto para el ticket del comensal (evita mostrar UUIDs)
      const itemNames = new Map<string, string>();
      for (const it of items) {
        if (itemNames.has(it.menuItemId)) continue;
        const [mi] = await ctx.restaurantDb.select({ name: menuItems.name }).from(menuItems).where(eq(menuItems.id, it.menuItemId)).limit(1);
        if (mi?.name) itemNames.set(it.menuItemId, mi.name);
      }
      const itemsWithName = items.map((it) => ({ ...it, name: itemNames.get(it.menuItemId) ?? it.menuItemId }));
      const table = order.tableId
        ? await ctx.restaurantDb.select().from(tables).where(eq(tables.id, order.tableId))
        : null;

      return {
        order,
        items: itemsWithName,
        tableNumber: table?.[0]?.number ?? null,
      };
    }),

  // ==========================================
  // Rabbitty Pay Phase 1: Core Engine Endpoints
  // ==========================================
  createPaymentIntent: publicLimitedProcedure
    .input(z.object({
      orderId: z.string(),
      bunzAmount: z.number().min(0).default(0),
      tipAmount: z.number().min(0).default(0),
      attemptNumber: z.number().int().min(1).default(1),
      customerId: z.string().optional(),
      provider: z.enum(["STRIPE", "CASH", "BUNZ_ONLY"]).default("STRIPE"),
    }))
    .mutation(async ({ ctx, input }) => {
      const [order] = await ctx.restaurantDb.select().from(orders).where(eq(orders.id, input.orderId));
      if (!order) throw new Error("Orden no encontrada");

      // P0-6: el pagador SIEMPRE es la sesión autenticada. `customerId` del
      // body no puede reservar Bunz de un tercero.
      const effectiveUserId = ctx.userId ?? undefined;
      if (input.bunzAmount > 0 && !effectiveUserId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "BUNZ_REQUIRES_AUTH: inicia sesión para pagar con Bunz.",
        });
      }

      const { createOrGetPaymentIntent } = await import("../services/paymentCore");

      return await createOrGetPaymentIntent(ctx.restaurantDb, {
        branchId: order.branchId,
        orderId: input.orderId,
        payerUserId: effectiveUserId,
        bunzToApply: Math.floor(input.bunzAmount),
        tipMxn: input.tipAmount,
        attemptNumber: input.attemptNumber,
        provider: input.provider,
      });
    }),

  getPaymentIntent: publicLimitedProcedure
    .input(z.object({ intentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { paymentIntents } = await import("@rabbitty/database-restaurant/schema");
      const [intent] = await ctx.restaurantDb.select().from(paymentIntents).where(eq(paymentIntents.id, input.intentId));
      if (!intent) throw new Error("Intento de pago no encontrado");

      // Scoping de lectura: Si el intento tiene un payerSubjectId y el llamante está autenticado con otra cuenta
      if (ctx.userId && intent.payerSubjectId && intent.payerSubjectId !== ctx.userId && !ctx.staffRole) {
        throw new Error("Acceso denegado a este intento de pago");
      }

      return intent;
    }),

  /**
   * ÚLTIMO intent de una ORDEN (H8): el POS rastrea por ORDEN, no por intent —
   * así el modal detecta el pago aunque el intent rastreado fue cancelado y el
   * comensal pagó el intent regenerado (p.ej. vía link de cuenta / /pay).
   * Solo campos no-sensibles, scoping del staff por sucursal.
   */
  latestIntentForOrder: posProcedure
    .input(z.object({ orderId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { paymentIntents, orders } = await import("@rabbitty/database-restaurant/schema");
      const [row] = await ctx.restaurantDb
        .select({
          id: paymentIntents.id,
          status: paymentIntents.status,
          amountMxn: paymentIntents.amountMxn,
          paidAt: paymentIntents.paidAt,
        })
        .from(paymentIntents)
        .innerJoin(orders, eq(orders.id, paymentIntents.orderId))
        .where(and(
          eq(paymentIntents.orderId, input.orderId),
          eq(orders.branchId, ctx.branchId)
        ))
        .orderBy(desc(paymentIntents.createdAt))
        .limit(1);
      return row || null;
    }),

  /**
   * H14-Watch: último intent liquidado para ORDENES de la branch (90s ventana).
   * El POS mira SIEMPRE (no solo con modal abierto): cuando el comensal paga
   * por otro lado (link de cuenta / re-cobro), el operador lo confirma al toque.
   */
  recentSettledForBranch: posProcedure
    .input(z.object({ windowSec: z.number().int().min(60).max(3600).default(900) }))
    .query(async ({ ctx, input }) => {
      const { paymentIntents, orders } = await import("@rabbitty/database-restaurant/schema");
      const rows = await ctx.restaurantDb
        .select({
          intentId: paymentIntents.id,
          orderId: paymentIntents.orderId,
          amountMxn: paymentIntents.amountMxn,
          paidAt: paymentIntents.paidAt,
        })
        .from(paymentIntents)
        .innerJoin(orders, eq(orders.id, paymentIntents.orderId))
        .where(and(
          inArray(paymentIntents.status, ["SUCCEEDED", "SETTLED"]),
          eq(orders.branchId, ctx.branchId),
          gte(paymentIntents.createdAt, new Date(Date.now() - input.windowSec * 1000))
        ))
        .orderBy(desc(paymentIntents.paidAt))
        .limit(10);
      return rows.map((r) => ({
        intentId: r.intentId,
        orderId: r.orderId,
        amount: Number(r.amountMxn || 0),
        paidAt: r.paidAt,
      }));
    }),

  cancelPaymentIntent: publicLimitedProcedure
    .input(z.object({
      intentId: z.string(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { releasePaymentIntentHold } = await import("../services/paymentCore");
      return await releasePaymentIntentHold(ctx.restaurantDb, {
        paymentIntentId: input.intentId,
        reason: input.reason ?? "USER_CANCELLED",
        callerUserId: ctx.staffRole ? undefined : (ctx.userId ?? undefined),
      });
    }),

  // ==========================================
  // Rabbitty Pay Phase 2: Stripe Connect & Secrets
  // ==========================================
  createStripePaymentSecret: publicLimitedProcedure
    .input(z.object({
      intentId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { paymentIntents } = await import("@rabbitty/database-restaurant/schema");
      const [intent] = await ctx.restaurantDb
        .select()
        .from(paymentIntents)
        .where(eq(paymentIntents.id, input.intentId))
        .limit(1);

      if (!intent) {
        throw new Error("Intento de pago no encontrado.");
      }

      // Scoping de seguridad: si el intento ya tiene un payerSubjectId y el llamante está autenticado con otra cuenta
      if (ctx.userId && intent.payerSubjectId && intent.payerSubjectId !== ctx.userId && !ctx.staffRole) {
        throw new Error("Acceso denegado: este intento de pago pertenece a otra sesión.");
      }

      const { createStripePaymentIntent } = await import("../services/stripeConnect");
      return await createStripePaymentIntent({
        db: ctx.restaurantDb,
        intentId: input.intentId,
      });
    }),

  // ==========================================
  // Rabbitty Pay: reconciliación server-side de Stripe
  // ==========================================
  // Consulta a Stripe el estado real del PaymentIntent y — solo si succeeded,
  // monto/moneda/metadata coinciden EXACTAMENTE — liquida con el mismo
  // motor idempotente del webhook (confirmPaymentIntentSettled, FOR UPDATE).
  // Cobertura para sandbox/pruebas sin webhook o si el webhook demora:
  // el cliente llama esto tras confirmar; nunca duplica (intento SUCCEEDED → early return).
  verifyStripePaymentIntent: publicLimitedProcedure
    .input(z.object({ intentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { paymentIntents } = await import("@rabbitty/database-restaurant/schema");
      const [intent] = await ctx.restaurantDb
        .select()
        .from(paymentIntents)
        .where(eq(paymentIntents.id, input.intentId))
        .limit(1);

      if (!intent) throw new Error("Intento de pago no encontrado.");

      // Mismo scoping que getPaymentIntent / createStripePaymentSecret
      if (ctx.userId && intent.payerSubjectId && intent.payerSubjectId !== ctx.userId && !ctx.staffRole) {
        throw new Error("Acceso denegado: este intento de pago pertenece a otra sesión.");
      }

      if (intent.status === "SUCCEEDED") {
        return { success: true, status: "SUCCEEDED", orderId: intent.orderId, settled: true };
      }
      if (intent.provider !== "STRIPE" || !intent.externalIntentId) {
        return { success: false, status: intent.status, orderId: intent.orderId, settled: false };
      }

      const { getStripeClient } = await import("../services/stripeConnect");
      let pi;
      try {
        pi = await getStripeClient().paymentIntents.retrieve(intent.externalIntentId, {
          expand: ["latest_charge"],
        });
      } catch (err: any) {
        // Sin acceso a Stripe (key/permiso) → respondemos sin liquidar; el webhook sigue siendo backstop.
        console.error("[verifyStripePaymentIntent] retrieve falló:", err?.message || err);
        return { success: false, status: intent.status, orderId: intent.orderId, settled: false, reason: "STRIPE_RETRIEVE_FAILED" };
      }

      if (pi.status !== "succeeded") {
        return { success: false, status: intent.status, providerStatus: String(pi.status), orderId: intent.orderId, settled: false };
      }

      // Validaciones estrictas ANTES de liquidar
      if (pi.amount !== intent.netFiatCents) {
        console.error("[verifyStripePaymentIntent] monto NO coincide:", pi.amount, "vs", intent.netFiatCents);
        return { success: false, status: intent.status, orderId: intent.orderId, settled: false, reason: "AMOUNT_MISMATCH" };
      }
      if (String(pi.currency || "").toUpperCase() !== String(intent.currency || "MXN")) {
        console.error("[verifyStripePaymentIntent] moneda NO coincide:", pi.currency, "vs", intent.currency);
        return { success: false, status: intent.status, orderId: intent.orderId, settled: false, reason: "CURRENCY_MISMATCH" };
      }
      const metaIntentId = (pi.metadata as Record<string, string> | undefined)?.rabbittyIntentId;
      if (metaIntentId && metaIntentId !== intent.id) {
        console.error("[verifyStripePaymentIntent] metadata.rabbittyIntentId no coincide:", metaIntentId, "vs", intent.id);
        return { success: false, status: intent.status, orderId: intent.orderId, settled: false, reason: "INTENT_MISMATCH" };
      }
      const metaBranch = (pi.metadata as Record<string, string> | undefined)?.branchId;
      if (metaBranch && metaBranch !== intent.merchantId) {
        console.error("[verifyStripePaymentIntent] metadata.branchId no coincide:", metaBranch, "vs", intent.merchantId);
        return { success: false, status: intent.status, orderId: intent.orderId, settled: false, reason: "BRANCH_MISMATCH" };
      }

      const latestChargeId: string | undefined =
        typeof (pi as any).latest_charge === "string" ? (pi as any).latest_charge : ((pi as any).latest_charge?.id);
      const { confirmPaymentIntentSettled } = await import("../services/paymentCore");
      const transitions = (pi as unknown as {
        status_transitions?: { succeeded_at?: number | null };
      }).status_transitions;
      const destination = (pi as unknown as {
        transfer_data?: { destination?: string | { id?: string } };
      }).transfer_data?.destination;
      const destinationId =
        typeof destination === "string" ? destination : destination?.id;

      const result = await confirmPaymentIntentSettled(ctx.restaurantDb, {
        paymentIntentId: intent.id,
        externalTransactionId: latestChargeId,
        verifiedMethod: "STRIPE_CARD",
        expectedAmountCents: intent.netFiatCents,
        expectedCurrency: intent.currency,
        expectedStripeAccountId: destinationId,
        paidAtExternal: transitions?.succeeded_at
          ? new Date(transitions.succeeded_at * 1000)
          : undefined,
      });
      return { success: result.success, status: result.status, orderId: result.orderId, settled: result.success };
    }),

  // Fase D: publishable key pública para Stripe Elements in-app (miniapp).
  // Dato público por diseño; evita hardcodearla en otra app.
  getPublishableKey: publicLimitedProcedure
    .query(async () => {
      const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
      // H24: `_test` cubre sk_test_/rk_test_/pk_test_. Antes solo se miraba
      // `sk_test`, así que una llave restringida de prueba (rk_test_) se
      // reportaba como "live" — riesgo de creer que se cobra dinero real.
      const secretKey = process.env.STRIPE_SECRET_KEY || "";
      const isTest = secretKey.includes("_test_") || pk.includes("_test_");
      return { publishableKey: pk, ready: Boolean(pk), mode: isTest ? "test" : "live" };
    }),

  getStripeAccountStatus: posProcedure
    .input(z.object({
      branchId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const branchId = await resolveBranchId(ctx, input.branchId);
      const { syncStripeAccountStatus } = await import("../services/stripeConnect");
      return await syncStripeAccountStatus({
        db: ctx.restaurantDb,
        branchId,
      });
    }),

  createStripeConnectLink: posPermission("POS_SETTINGS")
    .input(z.object({
      branchId: z.string().optional(),
      refreshUrl: z.string().url(),
      returnUrl: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      const branchId = await resolveBranchId(ctx, input.branchId);

      // ── Multi-tenant guard: la sucursal debe pertenecer al negocio del caller ──
      const { restaurants, branches } = await import("@rabbitty/database-restaurant/schema");
      const coreOwned = await import("@rabbitty/database-core/schema").then(m => m.ownedBusinesses);
      const [branchRow] = await ctx.restaurantDb.select({ restaurantId: branches.restaurantId }).from(branches).where(eq(branches.id, branchId)).limit(1);
      const [restaurantRow] = branchRow
        ? await ctx.restaurantDb.select({ businessId: restaurants.businessId, name: restaurants.name }).from(restaurants).where(eq(restaurants.id, branchRow.restaurantId)).limit(1)
        : [];
      if (!restaurantRow) throw new TRPCError({ code: "NOT_FOUND", message: "Sucursal sin restaurante asociado." });

      const isPlatformStaff = Boolean(ctx.staffRole);
      if (!isPlatformStaff) {
        if (!ctx.userId) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Se requiere una sesión de usuario." });
        }
        const [owned] = await ctx.coreDb.select({ id: coreOwned.id }).from(coreOwned).where(eq(coreOwned.ownerId, ctx.userId)).limit(1);
        if (!owned || owned.id !== restaurantRow.businessId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Esta sucursal no pertenece a tu negocio." });
        }
      }

      const { createStripeConnectOnboardingLink } = await import("../services/stripeConnect");
      return await createStripeConnectOnboardingLink({
        db: ctx.restaurantDb,
        branchId,
        refreshUrl: input.refreshUrl,
        returnUrl: input.returnUrl,
        email: ctx.user?.email ?? undefined,
        businessName: restaurantRow.name ?? undefined,
      });
    }),

  // ==========================================
  // Rabbitty Pay Phase 3: Efectivo Coordinado con POS
  // ==========================================
  requestCashPayment: publicLimitedProcedure
    .input(z.object({
      orderId: z.string(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [order] = await ctx.restaurantDb
        .select()
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1);

      if (!order) throw new Error("Orden no encontrada");
      if (order.status === "COMPLETED" || order.status === "VOID") {
        throw new Error("La orden ya fue liquidada o cancelada.");
      }

      await ctx.restaurantDb
        .update(orders)
        .set({
          status: "CASH_PAYMENT_REQUESTED",
          notes: input.notes ? `${order.notes ? order.notes + " | " : ""}${input.notes}` : order.notes,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, input.orderId));

      bus.emit(EventTypes.CASH_PAYMENT_REQUESTED, {
        orderId: order.id,
        tableId: order.tableId,
        branchId: order.branchId,
        total: order.total,
      });

      return { success: true, status: "CASH_PAYMENT_REQUESTED" };
    }),

  confirmCashPaymentWithPin: posProcedure
    .input(z.object({
      orderId: z.string(),
      pin: z.string().length(4),
      amount: z.number().min(0),
      tip: z.number().min(0).default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      // 1. Validar que la caja tenga turno abierto
      await assertOpenShiftForCash(ctx.restaurantDb, ctx.branchId);

      // 2. Verificar PIN de cajero / staff con hash scrypt y lockout
      const matchedStaff = await findStaffByPin(
        ctx.restaurantDb,
        ctx.branchId,
        input.pin,
        CASHIER_ROLES,
        "PIN de cajero o supervisor incorrecto"
      );

      // 3. Bloqueo transaccional y liquidación
      const [order] = await ctx.restaurantDb
        .select()
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1);

      if (!order) throw new Error("Orden no encontrada");
      if (order.status === "COMPLETED" || order.status === "VOID") {
        throw new Error("La orden ya se encuentra liquidada.");
      }

      // 4. Registrar pago en efectivo
      const [payment] = await ctx.restaurantDb.insert(payments).values({
        orderId: order.id,
        method: "CASH",
        amount: input.amount,
        reference: `Efectivo en caja (Autorizado por ${matchedStaff.name})`,
        status: "COMPLETED",
      }).returning();

      // 5. Cierre de orden y liberación de mesa
      await ctx.restaurantDb.update(orders).set({
        status: "COMPLETED",
        tip: sql`${orders.tip} + ${input.tip}`,
        updatedAt: new Date(),
      }).where(eq(orders.id, order.id));

      if (order.tableId) {
        await ctx.restaurantDb.update(tableSessions).set({
          status: "CLOSED",
          closedAt: new Date(),
        }).where(and(
          eq(tableSessions.tableId, order.tableId),
          eq(tableSessions.status, "OPEN")
        ));
      }

      bus.emit(EventTypes.ORDER_PAID, {
        orderId: order.id,
        branchId: ctx.branchId,
        paymentId: payment?.id,
        method: "CASH",
        amount: input.amount,
      });

      return {
        success: true,
        orderId: order.id,
        cashier: matchedStaff.name,
      };
    }),

  // ==========================================
  // Rabbitty Pay Phase 4: Conciliación Financiera SaaS
  // ==========================================
  getFinancialReconciliation: posProcedure
    .input(z.object({
      branchId: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const branchId = await resolveBranchId(ctx, input.branchId);
      const start = input.startDate ? new Date(input.startDate) : new Date(Date.now() - 30 * 24 * 3600 * 1000);
      const end = input.endDate ? new Date(input.endDate) : new Date();
      end.setDate(end.getDate() + 1);

      const { paymentIntents, bunzReserves } = await import("@rabbitty/database-restaurant/schema");

      const intents = await ctx.restaurantDb
        .select()
        .from(paymentIntents)
        .where(
          and(
            eq(paymentIntents.merchantId, branchId),
            gte(paymentIntents.createdAt, start),
            lt(paymentIntents.createdAt, end)
          )
        );

      let grossOrderCents = 0;
      let netFiatCents = 0;
      let platformFeeCents = 0;
      let bunzDiscountCents = 0;
      let succeededCount = 0;
      let pendingCount = 0;
      let cancelledCount = 0;

      for (const pi of intents) {
        if (pi.status === "SUCCEEDED") {
          succeededCount++;
          grossOrderCents += pi.amountCents || Math.round(Number(pi.amountMxn || 0) * 100);
          netFiatCents += pi.netFiatCents || 0;
          platformFeeCents += pi.platformFeeCents || 0;
          bunzDiscountCents += Math.round(Number(pi.bunzAmount || 0) * 100);
        } else if (pi.status === "CANCELLED" || pi.status === "EXPIRED" || pi.status === "FAILED") {
          cancelledCount++;
        } else {
          pendingCount++;
        }
      }

      // Estimación de procesador Stripe (2.9% + 2.50 MXN)
      const estimatedProcessorFeeCents = Math.round(netFiatCents * 0.029) + (succeededCount * 250);
      const netSettledToMerchantCents = Math.max(0, netFiatCents - platformFeeCents - estimatedProcessorFeeCents);

      return {
        summary: {
          grossOrderTotalMxn: grossOrderCents / 100,
          netFiatMxn: netFiatCents / 100,
          bunzDiscountMxn: bunzDiscountCents / 100,
          platformFeeMxn: platformFeeCents / 100,
          estimatedProcessorFeeMxn: estimatedProcessorFeeCents / 100,
          netSettledToMerchantMxn: netSettledToMerchantCents / 100,
          succeededCount,
          pendingCount,
          cancelledCount,
          totalIntentsCount: intents.length,
        },
        records: intents.map((pi: any) => ({
          id: pi.id,
          orderId: pi.orderId,
          createdAt: pi.createdAt,
          status: pi.status,
          provider: pi.provider,
          grossMxn: (pi.amountCents || 0) / 100,
          netFiatMxn: (pi.netFiatCents || 0) / 100,
          platformFeeMxn: (pi.platformFeeCents || 0) / 100,
          bunzApplied: pi.bunzAmount || 0,
        })),
      };
    }),

  // ==========================================
  // Rabbitty Pay — QR BUNZ (puerto del api-server, vivo en producción vía este appRouter)
  // El POS crea el intent; el cliente lo aprueba desde su app (con gate biométrico);
  // el settle hace débito + ledger + cashback (tasa real) + completa la orden.
  // ==========================================

  /** POS: crea un intent de pago BUNZ para la branch del contexto. */
  createIntent: posProcedure
    .input(z.object({
      amountMxn: z.number().positive(),
      tenantId: z.string().optional(),   // compat: se ignora — tenant = ctx.branchId
      orderId: z.string().optional(),
      idempotencyKey: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // En terminal no hay userId: el intent queda a nombre del empleado en
      // turno o del propio dispositivo (es solo trazabilidad del creador).
      const creatorSubjectId =
        ctx.userId ?? ctx.posOperator?.staffId ?? ctx.posAuth?.terminalId ?? null;
      if (!creatorSubjectId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "No se pudo identificar quién crea el cobro." });
      }

      const { PaymentIntentService } = await import("../services/paymentIntentDomain");
      const intent = await PaymentIntentService.createIntent({
        tenantId: ctx.branchId,
        creatorSubjectId,
        amountMxn: input.amountMxn,
        orderId: input.orderId,
        idempotencyKey: input.idempotencyKey,
      });
      // Shape compatible con el api-server (id/tenantId/amountMxn/bunzAmount/status/expiresAt)
      return intent;
    }),

  /** POS + Miniapp: lee el intent sin PII. */
  getIntent: posProcedure
    .input(z.object({ intentId: z.string() }))
    .query(async ({ input }) => {
      const { PaymentIntentService } = await import("../services/paymentIntentDomain");
      const intent = await PaymentIntentService.getIntent(input.intentId);
      if (!intent) throw new TRPCError({ code: "NOT_FOUND", message: "INTENT_NOT_FOUND" });
      return {
        id: intent.id,
        tenantId: intent.tenantId,
        orderId: intent.orderId,
        amountMxn: intent.amountMxn,
        bunzAmount: intent.bunzAmount,
        currency: intent.currency,
        status: intent.status,
        expiresAt: intent.expiresAt,
        createdAt: intent.createdAt,
      };
    }),

  /** Miniapp: el cliente aprueba el pago con SUS bunz (settles atómico con cashback real). */
  approveIntent: posProcedure
    .input(z.object({ intentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { PaymentIntentService } = await import("../services/paymentIntentDomain");
      try {
        // El payer es la SESIÓN autenticada (identidad del que paga, inmutable server-side)
        return await PaymentIntentService.approveIntent(input.intentId, ctx.userId as string);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // D-13: el respaldo del afiliado es una regla ECONÓMICA, no un fallo técnico.
        // Se devuelve un error de negocio legible en vez de un 500 opaco.
        if (msg.startsWith("BUNZ_PILOT_BLOCKED")) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: msg.replace("BUNZ_PILOT_BLOCKED: ", ""),
          });
        }
        if (msg === "BUNZ_BACKING_INSUFFICIENT") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "El negocio no tiene respaldo suficiente para esta redención en este momento. El pago con Bunz no se completó y tus Bunz siguen intactos.",
          });
        }
        if (msg === "BUNZ_BACKING_UNRESOLVED") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "No se pudo resolver el negocio del cobro para consumir el respaldo Bunz.",
          });
        }
        throw err;
      }
    }),
});
