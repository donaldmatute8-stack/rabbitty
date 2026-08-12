import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { router, protectedProcedure, adminOnlyProcedure } from "../trpc";
import { campaigns, customers, restaurants } from "@rabbitty/database-restaurant";
import { TRPCError } from "@trpc/server";
import { enqueueCampaignDelivery } from "../services/queue";

export const campaignsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const branchScope = ctx.staffRole ? eq(campaigns.branchId, ctx.staffBranchId as string) : undefined;
    return branchScope
      ? await ctx.restaurantDb.select().from(campaigns).where(branchScope).orderBy(campaigns.createdAt)
      : await ctx.restaurantDb.select().from(campaigns).orderBy(campaigns.createdAt);
  }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      targetSegment: z.enum(["ALL", "VIP", "RECURRENT", "NEW", "CHURN_RISK"]),
      message: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const [campaign] = await ctx.restaurantDb.insert(campaigns).values({
        branchId: ctx.branchId,
        name: input.name,
        targetSegment: input.targetSegment,
        message: input.message,
        status: "DRAFT",
      }).returning();

      if (!campaign) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create campaign" });
      }

      return campaign;
    }),

  send: adminOnlyProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const branchScope = ctx.staffRole ? eq(campaigns.branchId, ctx.staffBranchId as string) : undefined;
      const [campaign] = await ctx.restaurantDb.select().from(campaigns).where(
        branchScope ? and(eq(campaigns.id, input.id), branchScope) : eq(campaigns.id, input.id)
      );
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });

      if (campaign.status === "SENT") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Campaign already sent" });
      }

      const [restaurant] = await ctx.restaurantDb.select().from(restaurants).limit(1);
      if (!restaurant) throw new TRPCError({ code: "NOT_FOUND", message: "No restaurant found" });

      let targetCustomers: any[];
      if (campaign.targetSegment === "ALL") {
        targetCustomers = await ctx.restaurantDb.select().from(customers)
          .where(eq(customers.restaurantId, restaurant.id));
      } else {
        targetCustomers = await ctx.restaurantDb.select().from(customers)
          .where(and(eq(customers.restaurantId, restaurant.id), eq(customers.segment, campaign.targetSegment)));
      }

      const phones = targetCustomers.map((c: any) => c.phone).filter(Boolean) as string[];

      enqueueCampaignDelivery({
        campaignId: campaign.id,
        name: campaign.name,
        message: campaign.message,
        customerPhones: phones,
      });

      await ctx.restaurantDb.update(campaigns).set({
        status: "SENT",
        sentAt: new Date(),
      }).where(eq(campaigns.id, input.id));

      return { success: true, deliveredTo: phones.length };
    }),
});

