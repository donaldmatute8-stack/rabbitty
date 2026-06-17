import { z } from "zod";
import { eq, sql, desc } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { invoices, orders, branches } from "@rabbitty/database-restaurant";

export const invoicesRouter = router({
  list: protectedProcedure
    .input(z.object({
      branchId: z.string().optional(),
      status: z.string().optional(),
      search: z.string().optional(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [];

      if (input.branchId) {
        conditions.push(eq(invoices.branchId, input.branchId));
      }
      if (input.status) {
        conditions.push(eq(invoices.status, input.status));
      }
      if (input.search) {
        conditions.push(
          sql`(${invoices.rfc} ILIKE ${'%' + input.search + '%'} OR ${invoices.legalName} ILIKE ${'%' + input.search + '%'})`
        );
      }

      const query = ctx.restaurantDb.select({
        invoice: invoices,
        order: {
          id: orders.id,
          subtotal: orders.subtotal,
          tax: orders.tax,
          total: orders.total,
          status: orders.status,
          customerName: orders.customerName,
          createdAt: orders.createdAt,
        },
        branch: {
          id: branches.id,
          name: branches.name,
        },
      })
        .from(invoices)
        .leftJoin(orders, eq(invoices.orderId, orders.id))
        .leftJoin(branches, eq(invoices.branchId, branches.id))
        .orderBy(desc(invoices.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const where = conditions.length > 0 ? sql`${conditions.reduce((a, b) => sql`${a} AND ${b}`)}` : undefined;

      const result = where ? await query.where(where) : await query;

      const [{ count }] = await ctx.restaurantDb
        .select({ count: sql<number>`count(*)` })
        .from(invoices);

      return {
        items: result.map(r => ({
          ...r.invoice,
          order: r.order || undefined,
          branch: r.branch?.name || undefined,
        })),
        total: Number(count),
      };
    }),

  getByOrder: protectedProcedure
    .input(z.object({ orderId: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.restaurantDb
        .select()
        .from(invoices)
        .where(eq(invoices.orderId, input.orderId));

      // Also return order info
      const [order] = await ctx.restaurantDb
        .select()
        .from(orders)
        .where(eq(orders.id, input.orderId));

      return {
        invoices: result,
        order: order || null,
      };
    }),

  cancel: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [invoice] = await ctx.restaurantDb
        .select()
        .from(invoices)
        .where(eq(invoices.id, input.id));

      if (!invoice) throw new Error("Factura no encontrada");
      if (invoice.status === "CANCELLED") throw new Error("Esta factura ya está cancelada");

      const [updated] = await ctx.restaurantDb
        .update(invoices)
        .set({
          status: "CANCELLED",
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, input.id))
        .returning();

      // Also update the order's cfdiStatus back to NONE
      await ctx.restaurantDb
        .update(orders)
        .set({ cfdiStatus: "NONE", cfdiUrl: null })
        .where(eq(orders.id, invoice.orderId));

      return updated;
    }),

  stats: protectedProcedure
    .input(z.object({ branchId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const conditions = input.branchId ? [eq(invoices.branchId, input.branchId)] : [];

      const where = conditions.length > 0
        ? sql`${conditions.reduce((a, b) => sql`${a} AND ${b}`)}`
        : undefined;

      const totalInvoiced = ctx.restaurantDb
        .select({
          count: sql<number>`count(*)`,
          totalAmount: sql<number>`coalesce(sum(${invoices.total}), 0)`,
          totalTax: sql<number>`coalesce(sum(${invoices.tax}), 0)`,
        })
        .from(invoices);

      const invoiced = ctx.restaurantDb
        .select({
          count: sql<number>`count(*)`,
          totalAmount: sql<number>`coalesce(sum(${invoices.total}), 0)`,
        })
        .from(invoices)
        .where(eq(invoices.status, "INVOICED"));

      const cancelled = ctx.restaurantDb
        .select({
          count: sql<number>`count(*)`,
        })
        .from(invoices)
        .where(eq(invoices.status, "CANCELLED"));

      const [totalResult, invoicedResult, cancelledResult] = await Promise.all([
        where ? (await totalInvoiced.where(where)) : (await totalInvoiced),
        await invoiced,
        await cancelled,
      ]);

      return {
        total: Number(totalResult[0]?.count || 0),
        totalAmount: Number(totalResult[0]?.totalAmount || 0),
        totalTax: Number(totalResult[0]?.totalTax || 0),
        invoiced: Number(invoicedResult[0]?.count || 0),
        invoicedAmount: Number(invoicedResult[0]?.totalAmount || 0),
        cancelled: Number(cancelledResult[0]?.count || 0),
      };
    }),
});
