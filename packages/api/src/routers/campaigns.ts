import { z } from "zod";
import { and, eq, desc, sql, gte } from "drizzle-orm";
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

  /**
   * List affiliate growth campaigns scoped to the user's business
   */
  affiliateList: protectedProcedure.query(async ({ ctx }) => {
    const { affiliateCampaigns, ownedBusinesses } = await import("@rabbitty/database-core/schema");
    
    // Find businesses owned by the authenticated user
    const userBusinesses = await ctx.coreDb.select({ id: ownedBusinesses.id })
      .from(ownedBusinesses)
      .where(eq(ownedBusinesses.ownerId, ctx.userId));

    if (userBusinesses.length === 0) {
      return [];
    }

    const businessIds = userBusinesses.map(b => b.id);
    return await ctx.coreDb.select()
      .from(affiliateCampaigns)
      .where(sql`${affiliateCampaigns.businessId} IN ${businessIds}`)
      .orderBy(desc(affiliateCampaigns.createdAt));
  }),

  /**
   * Real Growth Signals for affiliate merchant with strict k-anonymity (>= 5)
   */
  growthSignals: protectedProcedure.query(async ({ ctx }) => {
    const { ownedBusinesses, transactions } = await import("@rabbitty/database-core/schema");

    // Fetch the business owned by the calling merchant
    const [business] = await ctx.coreDb.select().from(ownedBusinesses)
      .where(eq(ownedBusinesses.ownerId, ctx.userId))
      .limit(1);

    if (!business) {
      return { totalCustomers: 0, opportunities: [] };
    }

    // Query real transactions for this business
    const txHistory = await ctx.coreDb.select({
      userId: transactions.userId,
      count: sql<number>`count(*)`,
      lastTx: sql<string>`max(${transactions.createdAt})`,
    }).from(transactions)
      .where(and(
        eq(transactions.businessId, business.id),
        eq(transactions.status, "COMPLETED")
      ))
      .groupBy(transactions.userId);

    const now = Date.now();
    const MS_25_DAYS = 25 * 24 * 60 * 60 * 1000;

    let inactiveCount = 0;
    let vipCount = 0;

    for (const customer of txHistory) {
      const visits = Number(customer.count);
      const lastDate = customer.lastTx ? new Date(customer.lastTx).getTime() : 0;

      if (now - lastDate > MS_25_DAYS) {
        inactiveCount++;
      }
      if (visits >= 5) {
        vipCount++;
      }
    }

    const opportunities = [];

    // Opportunity A: Winback Inactive Customers (Strict k-anonymity >= 5)
    if (inactiveCount >= 5) {
      opportunities.push({
        id: "opp_winback",
        type: "WINBACK_INACTIVE",
        headline: `Tienes ${inactiveCount} clientes sin visita en los últimos 25 días`,
        explanation: "Clientes que ya conocen tu negocio pero no han regresado este mes. Una reactivación con incentivo temporal suele tener la mayor tasa de retorno.",
        targetCount: inactiveCount,
        suggestedAction: {
          campaignType: "WINBACK_DIRECT",
          rewardPercentage: Math.min(business.rewardPercentage + 10, 35),
          maxBudgetBunz: inactiveCount * 15,
          validityHours: 48,
        },
      });
    }

    // Opportunity B: Off-Peak calculation comparing current hour against 3-week historical window
    const currentHour = new Date().getHours();
    const dayOfWeek = new Date().getDay();
    const threeWeeksAgo = new Date(now - 21 * 24 * 60 * 60 * 1000);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const historicalTxs = await ctx.coreDb.select({
      createdAt: transactions.createdAt,
    }).from(transactions)
      .where(and(
        eq(transactions.businessId, business.id),
        eq(transactions.status, "COMPLETED"),
        gte(transactions.createdAt, threeWeeksAgo)
      ));

    let matchingHourCount = 0;
    for (const tx of historicalTxs) {
      if (!tx.createdAt) continue;
      const d = new Date(tx.createdAt);
      if (d.getDay() === dayOfWeek && d < startOfToday && d.getHours() === currentHour) {
        matchingHourCount++;
      }
    }
    const avgHistoricalHourlyTxs = matchingHourCount / 3;

    const startOfCurrentHour = new Date();
    startOfCurrentHour.setMinutes(0, 0, 0);
    const todayHourTxs = historicalTxs.filter(tx => tx.createdAt && new Date(tx.createdAt) >= startOfCurrentHour).length;

    const isStatisticallyOffPeak = (avgHistoricalHourlyTxs <= 1) || (todayHourTxs < avgHistoricalHourlyTxs * 0.6);

    if (isStatisticallyOffPeak) {
      opportunities.push({
        id: "opp_off_peak",
        type: "OFF_PEAK_BOOST",
        headline: `Franja de baja afluencia detectada (${currentHour}:00 hrs)`,
        explanation: `Históricamente este horario registra un promedio de ${avgHistoricalHourlyTxs.toFixed(1)} consumos/hora. Un Flash Boost temporal de cashback incentiva visitas de consumo inmediato sin comprometer márgenes permanentes.`,
        targetCount: 1,
        suggestedAction: {
          campaignType: "FLASH_BOOST",
          rewardPercentage: Math.min(business.rewardPercentage + 10, 40),
          maxBudgetBunz: 150,
          validityHours: 2,
        },
      });
    }

    // Opportunity C: VIP Loyalty (Strict k-anonymity >= 5)
    if (vipCount >= 5) {
      opportunities.push({
        id: "opp_vip",
        type: "VIP_LOYALTY_APPRECIATION",
        headline: `${vipCount} clientes habituales con alta fidelidad`,
        explanation: "Clientes recurrentes (más de 5 visitas) que sustentan la mayor parte del ingreso recurrente del negocio.",
        targetCount: vipCount,
        suggestedAction: {
          campaignType: "VIP_REWARD",
          rewardPercentage: Math.min(business.rewardPercentage + 15, 50),
          maxBudgetBunz: vipCount * 25,
          validityHours: 72,
        },
      });
    }

    return {
      totalCustomers: txHistory.length,
      opportunities,
    };
  }),

  /**
   * Manage affiliate growth campaign state with strict state machine and owner verification
   */
  manageAffiliateCampaign: adminOnlyProcedure
    .input(z.object({
      campaignId: z.string(),
      action: z.enum(["APPROVE_AND_ACTIVATE", "PAUSE", "RESUME", "CANCEL"]),
      idempotencyKey: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { affiliateCampaigns, ownedBusinesses } = await import("@rabbitty/database-core/schema");
      const [campaign] = await ctx.coreDb.select().from(affiliateCampaigns)
        .where(eq(affiliateCampaigns.id, input.campaignId))
        .limit(1);

      if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campaña no encontrada" });

      // Verify business ownership
      const [business] = await ctx.coreDb.select().from(ownedBusinesses)
        .where(and(
          eq(ownedBusinesses.id, campaign.businessId),
          eq(ownedBusinesses.ownerId, ctx.userId)
        ))
        .limit(1);

      if (!business && ctx.staffRole !== "ADMIN") {
        throw new TRPCError({ code: "FORBIDDEN", message: "No autorizado para modificar esta campaña" });
      }

      const now = new Date();
      if (campaign.expiresAt < now && campaign.status !== "EXPIRED" && campaign.status !== "CANCELLED") {
        await ctx.coreDb.update(affiliateCampaigns)
          .set({ status: "EXPIRED", updatedAt: now })
          .where(eq(affiliateCampaigns.id, campaign.id));
        throw new TRPCError({ code: "BAD_REQUEST", message: "La campaña ha expirado" });
      }

      let nextStatus = campaign.status;
      const updateFields: Record<string, unknown> = { updatedAt: now };

      switch (input.action) {
        case "APPROVE_AND_ACTIVATE":
          if (campaign.status === "ACTIVE") {
            return { success: true, campaign };
          }
          if (campaign.status !== "DRAFT" && campaign.status !== "PENDING_APPROVAL") {
            throw new TRPCError({ code: "BAD_REQUEST", message: `No se puede activar una campaña en estado ${campaign.status}` });
          }
          nextStatus = "ACTIVE";
          updateFields.approvedBy = ctx.userId;
          updateFields.approvedAt = now;
          break;

        case "PAUSE":
          if (campaign.status === "PAUSED") {
            return { success: true, campaign };
          }
          if (campaign.status !== "ACTIVE") {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Solo se pueden pausar campañas activas" });
          }
          nextStatus = "PAUSED";
          break;

        case "RESUME":
          if (campaign.status === "ACTIVE") {
            return { success: true, campaign };
          }
          if (campaign.status !== "PAUSED") {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Solo se pueden reanudar campañas pausadas" });
          }
          nextStatus = "ACTIVE";
          break;

        case "CANCEL":
          if (campaign.status === "CANCELLED") {
            return { success: true, campaign };
          }
          nextStatus = "CANCELLED";
          break;
      }

      updateFields.status = nextStatus;

      const [updated] = await ctx.coreDb.update(affiliateCampaigns)
        .set(updateFields)
        .where(eq(affiliateCampaigns.id, campaign.id))
        .returning();

      return { success: true, campaign: updated };
    }),
});


