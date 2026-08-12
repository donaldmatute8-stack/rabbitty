import { z } from "zod";
import { router, protectedProcedure, adminOnlyProcedure } from "../trpc";
import { eq, desc } from "drizzle-orm";
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
