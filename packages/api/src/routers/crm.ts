import { z } from "zod";
import { router, protectedProcedure, adminOnlyProcedure } from "../trpc";
import { eq, desc, sql, inArray } from "drizzle-orm";
import { customers, branches } from "@rabbitty/database-restaurant/schema";

export const crmRouter = router({
  getCustomers: adminOnlyProcedure.query(async ({ ctx }) => {
    const [branch] = await ctx.restaurantDb
      .select()
      .from(branches)
      .where(eq(branches.id, ctx.branchId));
    if (!branch) return [];

    const list = await ctx.restaurantDb
      .select()
      .from(customers)
      .where(eq(customers.restaurantId, branch.restaurantId))
      .orderBy(desc(customers.totalSpent));
    return list;
  }),


  /**
   * Merchant-safe: métricas de audiencia de SU restaurante(s) (total + segmentos).
   * Segmentos del schema: VIP | RECURRENT | NEW | CHURN_RISK.
   */
  getMyAudienceCounts: protectedProcedure.query(async ({ ctx }) => {
    const { resolveMerchantContext } = await import("../services/merchantContext");
    const mctx = await resolveMerchantContext(ctx);
    const empty = { total: 0, vip: 0, recurrent: 0, new: 0, churnRisk: 0, marketingConsents: 0 };
    if (mctx.restaurantIds.length === 0) return empty;
    const [agg] = await ctx.restaurantDb
      .select({
        total: sql<number>`count(*)::int`,
        vip: sql<number>`count(*) FILTER (WHERE ${customers.segment} = 'VIP')::int`,
        recurrent: sql<number>`count(*) FILTER (WHERE ${customers.segment} = 'RECURRENT')::int`,
        new: sql<number>`count(*) FILTER (WHERE ${customers.segment} = 'NEW')::int`,
        churnRisk: sql<number>`count(*) FILTER (WHERE ${customers.segment} = 'CHURN_RISK')::int`,
        marketingConsents: sql<number>`count(*) FILTER (WHERE ${customers.marketingConsent} = true)::int`,
      })
      .from(customers)
      .where(inArray(customers.restaurantId, mctx.restaurantIds));
    return {
      total: Number(agg?.total ?? 0),
      vip: Number(agg?.vip ?? 0),
      recurrent: Number(agg?.recurrent ?? 0),
      new: Number(agg?.new ?? 0),
      churnRisk: Number(agg?.churnRisk ?? 0),
      marketingConsents: Number(agg?.marketingConsents ?? 0),
    };
  }),

  updateCustomerSegment: adminOnlyProcedure
    .input(
      z.object({
        customerId: z.string(),
        segment: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.restaurantDb
        .update(customers)
        .set({ segment: input.segment })
        .where(eq(customers.id, input.customerId));
      return { success: true };
    }),
});
