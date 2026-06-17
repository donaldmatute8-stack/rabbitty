import { z } from "zod";
import { and, eq, desc, sql } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { campaigns, customers } from "@rabbitty/database-restaurant/schema";
import { referrals, levels, users } from "@rabbitty/database-core";

export const loyaltyRouter = router({
  getLevels: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.coreDb.select().from(levels).orderBy(levels.requiredHops);
  }),

  getReferralStats: protectedProcedure.query(async ({ ctx }) => {
    const allReferrals = await ctx.coreDb.select().from(referrals);
    const totalInviters = new Set(allReferrals.map((r) => r.inviterId)).size;
    const totalInvited = new Set(allReferrals.map((r) => r.invitedId)).size;
    
    const successfulReferrals = allReferrals.filter(r => r.status === "COMPLETED");
    const totalRewards = successfulReferrals.reduce((sum, r) => sum + r.rewardAmount, 0);

    return { 
      referrals: allReferrals, 
      totalInviters, 
      totalInvited,
      successfulCount: successfulReferrals.length,
      totalRewards
    };
  }),

  listCampaigns: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.restaurantDb
      .select()
      .from(campaigns)
      .where(eq(campaigns.branchId, ctx.branchId))
      .orderBy(desc(campaigns.createdAt));
  }),

  createCampaign: protectedProcedure
    .input(z.object({
      name: z.string(),
      targetSegment: z.string(),
      message: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [campaign] = await ctx.restaurantDb.insert(campaigns).values({
        branchId: ctx.branchId,
        name: input.name,
        targetSegment: input.targetSegment,
        message: input.message,
        status: "DRAFT",
      }).returning();
      return campaign;
    }),

  getUpcomingBirthdays: protectedProcedure.query(async ({ ctx }) => {
    // This is a simplified fetch; in production we might query by month/day.
    // For now we return customers that have a birthDate, ordered by name or date.
    return await ctx.restaurantDb
      .select()
      .from(customers)
      .where(sql`${customers.birthDate} IS NOT NULL`)
      .orderBy(customers.birthDate)
      .limit(50);
  }),
});
