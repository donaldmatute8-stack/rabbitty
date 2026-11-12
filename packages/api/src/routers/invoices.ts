import { z } from "zod";
import { eq, sql, desc, and } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { invoices, orders, branches } from "@rabbitty/database-restaurant";
import { cancelInvoice } from "../services/cfdi";

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

      const branchId = ctx.staffRole ? ctx.staffBranchId : input.branchId;
      if (branchId) {
        conditions.push(eq(invoices.branchId, branchId));
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

      const [countResult] = await ctx.restaurantDb
        .select({ count: sql<number>`count(*)` })
        .from(invoices);

      return {
        items: result.map(r => ({
          ...r.invoice,
          order: r.order || undefined,
          branch: r.branch?.name || undefined,
        })),
        total: Number(countResult?.count ?? 0),
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

  /**
   * Cancela una factura. Si está timbrada, primero se cancela en el PAC del
   * negocio (motivo SAT) y solo si el PAC confirma se marca aquí. Antes esto
   * solo cambiaba el estado local y el CFDI seguía vigente ante el SAT.
   */
  cancel: protectedProcedure
    .input(z.object({
      id: z.string(),
      motive: z.enum(["01", "02", "03", "04"]).default("02"),
      replacementUuid: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [invoice] = await ctx.restaurantDb
        .select({ id: invoices.id })
        .from(invoices)
        .where(and(eq(invoices.id, input.id), eq(invoices.branchId, ctx.branchId)))
        .limit(1);

      if (!invoice) throw new Error("Factura no encontrada");

      const result = await cancelInvoice({
        db: ctx.restaurantDb,
        invoiceId: invoice.id,
        motive: input.motive,
        replacementUuid: input.replacementUuid,
        actor: {
          staffId: ctx.posOperator?.staffId ?? null,
          terminalId: ctx.posAuth?.terminalId ?? null,
        },
      });

      if (!result.success) throw new Error(result.error ?? "El PAC rechazó la cancelación");
      return result;
    }),

  stats: protectedProcedure
    .input(z.object({ branchId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const branchId = ctx.staffRole ? ctx.staffBranchId : input.branchId;
      const conditions = branchId ? [eq(invoices.branchId, branchId)] : [];

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
