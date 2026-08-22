import { z } from "zod";
import { and, eq, inArray, gte, lt, sql } from "drizzle-orm";
import { router, protectedProcedure, publicLimitedProcedure, resolveBranchId } from "../trpc";
import { orders, payments, tables, orderItems } from "@rabbitty/database-restaurant/schema";
import { bus, EventTypes } from "@rabbitty/events";

export const paymentsRouter = router({
  refund: protectedProcedure
    .input(z.object({
      paymentId: z.string(),
      amount: z.number(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [payment] = await ctx.restaurantDb.select().from(payments).where(eq(payments.id, input.paymentId));
      if (!payment) throw new Error("Pago no encontrado");
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
        method: z.enum(["CASH", "CREDIT_CARD", "DEBIT_CARD", "BUNZ"]).default("CASH"),
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
});
