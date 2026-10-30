import { z } from "zod";
import { and, eq, inArray, gte, lt, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicLimitedProcedure, resolveBranchId } from "../trpc";
import { orders, payments, tables, tableSessions, orderItems } from "@rabbitty/database-restaurant/schema";
import { bus, EventTypes } from "@rabbitty/events";
import { assertOpenShiftForCash, findStaffByPin, CASHIER_ROLES } from "../services/cashShift";

export const paymentsRouter = router({
  refund: protectedProcedure
    .input(z.object({
      paymentId: z.string(),
      amount: z.number(),
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

      const [refund] = await ctx.restaurantDb.insert(payments).values({
        orderId: payment.orderId,
        method: payment.method,
        amount: -Math.abs(input.amount),
        reference: `Refund: ${input.reason || "Sin razón"}`,
        status: "REFUNDED",
      }).returning();

      await ctx.restaurantDb.update(payments).set({ status: "REFUNDED" }).where(eq(payments.id, input.paymentId));

      bus.emit(EventTypes.PAYMENT_PROCESSED, { paymentId: refund!.id, orderId: payment.orderId, type: "REFUND" });
      return refund;
    }),

  processPayment: protectedProcedure
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
      const order = await ctx.restaurantDb.select().from(orders).where(eq(orders.id, input.orderId));
      if (!order) throw new Error("Orden no encontrada");

      const [payment] = await ctx.restaurantDb.insert(payments).values({
        orderId: input.orderId,
        method: input.method,
        amount: input.amount,
        reference: input.reference ?? null,
      }).returning();

      if (!payment) throw new Error("Error al procesar el pago");

      bus.emit(EventTypes.PAYMENT_PROCESSED, { paymentId: payment.id, orderId: input.orderId });
      return payment;
    }),

  splitBill: protectedProcedure
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

  addTip: protectedProcedure
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

  list: protectedProcedure
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

  getByOrder: protectedProcedure
    .input(z.object({ orderId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.restaurantDb.select().from(payments).where(eq(payments.orderId, input.orderId));
    }),

  getTotals: protectedProcedure
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
      const table = order.tableId
        ? await ctx.restaurantDb.select().from(tables).where(eq(tables.id, order.tableId))
        : null;

      return {
        order,
        items,
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

      // Scoping: Si el usuario está autenticado, no permitir atribuir la deducción de Bunz a un tercero ajeno
      const effectiveUserId = ctx.userId ?? input.customerId ?? undefined;

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

  getStripeAccountStatus: protectedProcedure
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

  createStripeConnectLink: protectedProcedure
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

  confirmCashPaymentWithPin: protectedProcedure
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
  getFinancialReconciliation: protectedProcedure
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
});

