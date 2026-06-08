import { z } from "zod";
import { and, eq, inArray, sql } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import * as dbSchema from "@rabbitty/database-restaurant";
import { bus, EventTypes } from "@rabbitty/events";
import { orders, payments } from "@rabbitty/database-restaurant/schema";



export const paymentsRouter = router({
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
      if (!order) {
        throw new Error("Orden no encontrada");
      }
       const [payment] = await ctx.restaurantDb.insert(payments).values({
         orderId: input.orderId,
         method: input.method,
         amount: input.amount,
         reference: input.reference ?? null,
       }).returning();
       bus.emit(EventTypes.PAYMENT_PROCESSED, { paymentId: payment.id, orderId: input.orderId });
       return payment;
    }),

  refund: protectedProcedure
    .input(
      z.object({
        paymentId: z.string(),
        amount: z.number(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const payment = await ctx.restaurantDb.select().from(payments).where(eq(payments.id, input.paymentId));
      if (!payment) {
        throw new Error("Pago no encontrado");
      }
      await ctx.restaurantDb.update(payments).set({
        status: "REFUNDED",
      }).where(eq(payments.id, input.paymentId));
      return { success: true };
    }),

  getByOrder: protectedProcedure
    .input(z.object({ orderId: z.string() }))
    .query(async ({ ctx, input }) => {
      const results = await ctx.restaurantDb.select().from(payments).where(eq(payments.orderId, input.orderId));
      return results;
    }),

  getTotals: protectedProcedure
    .input(z.object({ startDate: z.string(), endDate: z.string() }))
    .query(async ({ ctx, input }) => {
      const [cashPayments, cardPayments, bunzPayments] = await Promise.all([
        ctx.restaurantDb.select().from(payments).where(
          and(
            eq(payments.method, "CASH"),
            sql`${payments.createdAt} BETWEEN ${input.startDate} AND ${input.endDate}`
          )
        ),
        ctx.restaurantDb.select().from(payments).where(
          and(
            inArray(payments.method, ["CREDIT_CARD", "DEBIT_CARD"]),
            sql`${payments.createdAt} BETWEEN ${input.startDate} AND ${input.endDate}`
          )
        ),
        ctx.restaurantDb.select().from(payments).where(
          and(
            eq(payments.method, "BUNZ"),
            sql`${payments.createdAt} BETWEEN ${input.startDate} AND ${input.endDate}`
          )
        ),
      ]);
      return {
        cash: cashPayments.reduce((sum, p) => sum + p.amount, 0),
        card: cardPayments.reduce((sum, p) => sum + p.amount, 0),
        bunz: bunzPayments.reduce((sum, p) => sum + p.amount, 0),
        total: cashPayments.reduce((sum, p) => sum + p.amount, 0) + cardPayments.reduce((sum, p) => sum + p.amount, 0) + bunzPayments.reduce((sum, p) => sum + p.amount, 0),
      };
    }),
});
