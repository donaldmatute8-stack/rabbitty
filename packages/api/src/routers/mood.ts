import { z } from "zod";
import { and, desc, eq, inArray, gte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, adminOnlyProcedure } from "../trpc";
import { moodCampaigns, moodEvents, ownedBusinesses, users } from "@rabbitty/database-core";
import type { Context } from "../trpc";

const MOODS = ["calm", "energy", "focus", "celebration", "connection", "surprise"] as const;

/**
 * Negocios sobre los que el usuario puede operar campañas Mood:
 * - Rol ADMIN en core → toda la red de afiliados.
 * - Resto → solo los negocios de los que es dueño.
 */
async function scopedBusinesses(ctx: Context & { userId: string }) {
  const [me] = await ctx.coreDb.select({ role: users.role }).from(users).where(eq(users.id, ctx.userId)).limit(1);
  const base = ctx.coreDb
    .select({ id: ownedBusinesses.id, name: ownedBusinesses.name, category: ownedBusinesses.category, status: ownedBusinesses.status })
    .from(ownedBusinesses);
  const rows = me?.role === "ADMIN" ? await base : await base.where(eq(ownedBusinesses.ownerId, ctx.userId));
  return { rows, isPlatformAdmin: me?.role === "ADMIN" };
}

async function assertCanManage(ctx: Context & { userId: string }, businessId: string) {
  const { rows } = await scopedBusinesses(ctx);
  if (!rows.some((b) => b.id === businessId)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "No puedes gestionar campañas de este negocio" });
  }
}

export const moodRouter = router({
  /** Negocios disponibles para asignar campañas */
  businesses: adminOnlyProcedure.query(async ({ ctx }) => {
    const { rows, isPlatformAdmin } = await scopedBusinesses(ctx);
    return { businesses: rows, isPlatformAdmin };
  }),

  /** Métricas de telemetría de red para Rabbitty Mood */
  metrics: adminOnlyProcedure
    .input(z.object({ days: z.number().int().min(1).max(90).default(30), businessId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const { rows, isPlatformAdmin } = await scopedBusinesses(ctx);
      const days = input?.days ?? 30;
      const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const conditions = [gte(moodEvents.createdAt, sinceDate)];
      if (input?.businessId) {
        conditions.push(eq(moodEvents.businessId, input.businessId));
      } else if (!isPlatformAdmin && rows.length > 0) {
        conditions.push(inArray(moodEvents.businessId, rows.map((b) => b.id)));
      }

      // 1. Distribución por Mood
      const moodCounts = await ctx.coreDb
        .select({
          mood: moodEvents.mood,
          count: sql<number>`count(*)::int`,
        })
        .from(moodEvents)
        .where(and(...conditions))
        .groupBy(moodEvents.mood);

      // 2. Origen (Bunzy vs Grid de selección vs Venue)
      const sourceCounts = await ctx.coreDb
        .select({
          source: moodEvents.source,
          count: sql<number>`count(*)::int`,
        })
        .from(moodEvents)
        .where(and(...conditions))
        .groupBy(moodEvents.source);

      // 3. Total general
      const totalEvents = moodCounts.reduce((acc, row) => acc + (row.count || 0), 0);

      // 4. Últimos check-ins en tiempo real (anónimos)
      const recentEvents = await ctx.coreDb
        .select({
          id: moodEvents.id,
          mood: moodEvents.mood,
          source: moodEvents.source,
          businessId: moodEvents.businessId,
          createdAt: moodEvents.createdAt,
        })
        .from(moodEvents)
        .where(and(...conditions))
        .orderBy(desc(moodEvents.createdAt))
        .limit(10);

      const bizNames = new Map(rows.map((b) => [b.id, b.name]));

      return {
        totalEvents,
        timeframeDays: days,
        distribution: moodCounts.map((m) => ({
          mood: m.mood,
          count: Number(m.count),
          percentage: totalEvents > 0 ? Math.round((Number(m.count) / totalEvents) * 100) : 0,
        })),
        sources: sourceCounts.map((s) => ({
          source: s.source,
          count: Number(s.count),
          percentage: totalEvents > 0 ? Math.round((Number(s.count) / totalEvents) * 100) : 0,
        })),
        recent: recentEvents.map((r) => ({
          ...r,
          businessName: r.businessId ? bizNames.get(r.businessId) ?? "Local de red" : "Global / Fuera de local",
        })),
      };
    }),

  listCampaigns: adminOnlyProcedure.query(async ({ ctx }) => {
    const { rows } = await scopedBusinesses(ctx);
    if (rows.length === 0) return [];
    const names = new Map(rows.map((b) => [b.id, b.name]));
    const campaigns = await ctx.coreDb
      .select()
      .from(moodCampaigns)
      .where(inArray(moodCampaigns.businessId, rows.map((b) => b.id)))
      .orderBy(desc(moodCampaigns.createdAt));
    return campaigns.map((c) => ({ ...c, businessName: names.get(c.businessId) ?? "—" }));
  }),

  createCampaign: adminOnlyProcedure
    .input(
      z.object({
        businessId: z.string().min(1),
        title: z.string().trim().min(1).max(80),
        description: z.string().trim().max(240).optional(),
        targetMood: z.enum(MOODS),
        rewardBunz: z.number().int().min(0).max(1000).default(0),
        startHour: z.number().int().min(0).max(23).default(0),
        endHour: z.number().int().min(0).max(23).default(23),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCanManage(ctx, input.businessId);
      const [campaign] = await ctx.coreDb
        .insert(moodCampaigns)
        .values({ ...input, description: input.description || null, isActive: true })
        .returning();
      return campaign;
    }),

  toggleCampaign: adminOnlyProcedure
    .input(z.object({ id: z.string().min(1), businessId: z.string().min(1), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await assertCanManage(ctx, input.businessId);
      const [campaign] = await ctx.coreDb
        .update(moodCampaigns)
        .set({ isActive: input.isActive, updatedAt: new Date() })
        .where(and(eq(moodCampaigns.id, input.id), eq(moodCampaigns.businessId, input.businessId)))
        .returning();
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campaña no encontrada" });
      return campaign;
    }),

  deleteCampaign: adminOnlyProcedure
    .input(z.object({ id: z.string().min(1), businessId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertCanManage(ctx, input.businessId);
      await ctx.coreDb
        .delete(moodCampaigns)
        .where(and(eq(moodCampaigns.id, input.id), eq(moodCampaigns.businessId, input.businessId)));
      return { success: true };
    }),
});
