import { z } from "zod";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, godAdminProcedure } from "../trpc";
import { bunzyBroadcasts, bunzyDeliveries, ownedBusinesses } from "@rabbitty/database-core";
import {
  BUNZY_CATEGORIES,
  getBroadcastEvidence,
  getConnectMeta,
  previewBroadcast,
  publishBroadcast,
} from "../services/bunzyConnect";

const audienceSchema = z.object({
  scope: z.enum(["BUSINESS", "ALL_AFFILIATES", "USER"]),
  businessId: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  niche: z.string().min(1).optional(),
  package: z.string().min(1).optional(),
});

const broadcastInput = z.object({
  category: z.enum(BUNZY_CATEGORIES),
  title: z.string().min(3).max(120),
  body: z.string().min(10).max(4000),
  ctaLabel: z.string().max(40).optional().nullable(),
  ctaUrl: z.string().url().optional().nullable(),
  audience: audienceSchema,
  requestKey: z.string().max(120).optional().nullable(),
  scheduledAt: z.string().datetime().optional().nullable(),
  confirmMass: z.boolean().optional(),
});

function assertMassAllowed(scope: "BUSINESS" | "ALL_AFFILIATES" | "USER", confirmMass?: boolean) {
  if (scope === "ALL_AFFILIATES" && (process.env.BUNZY_CONNECT_ALLOW_MASS !== "1" || confirmMass !== true)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "El envío masivo requiere BUNZY_CONNECT_ALLOW_MASS=1 y confirmación explícita.",
    });
  }
}

/**
 * ── Bunzy Connect · Centro de comunicación (God) ──
 * La UI nunca ve el secreto: usa la sesión God + 2FA. El CLI usa la ruta REST
 * con `x-bunzy-connect-secret`. Ambos llaman al MISMO servicio.
 */
export const bunzyConnectRouter = router({
  meta: godAdminProcedure.query(async ({ ctx }) => getConnectMeta(ctx.coreDb)),

  businesses: godAdminProcedure.query(async ({ ctx }) =>
    ctx.coreDb
      .select({
        id: ownedBusinesses.id,
        name: ownedBusinesses.name,
        niche: ownedBusinesses.niche,
        package: ownedBusinesses.package,
      })
      .from(ownedBusinesses)
      .where(inArray(ownedBusinesses.status, ["APPROVED", "VERIFIED"]))
      .orderBy(ownedBusinesses.name)
      .limit(300),
  ),

  preview: godAdminProcedure.input(broadcastInput).mutation(async ({ ctx, input }) =>
    previewBroadcast(ctx.coreDb, {
      ...input,
      createdBy: String(ctx.userId || "god"),
    }),
  ),

  publish: godAdminProcedure.input(broadcastInput).mutation(async ({ ctx, input }) => {
    assertMassAllowed(input.audience.scope, input.confirmMass);
    return publishBroadcast(ctx.coreDb, {
      ...input,
      createdBy: String(ctx.userId || "god"),
    });
  }),

  list: godAdminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.coreDb
      .select()
      .from(bunzyBroadcasts)
      .orderBy(desc(bunzyBroadcasts.createdAt))
      .limit(50);

    if (rows.length === 0) return [];

    const counts = await ctx.coreDb
      .select({
        broadcastId: bunzyDeliveries.broadcastId,
        total: sql<number>`count(*)::int`,
        published: sql<number>`count(*) filter (where ${bunzyDeliveries.status} in ('PUBLISHED','READ'))::int`,
        read: sql<number>`count(*) filter (where ${bunzyDeliveries.status} = 'READ')::int`,
        failed: sql<number>`count(*) filter (where ${bunzyDeliveries.status} = 'FAILED')::int`,
      })
      .from(bunzyDeliveries)
      .where(
        inArray(
          bunzyDeliveries.broadcastId,
          rows.map((r) => r.id),
        ),
      )
      .groupBy(bunzyDeliveries.broadcastId);

    const byId = new Map(counts.map((c) => [c.broadcastId, c]));

    return rows.map((r) => ({
      id: r.id,
      category: r.category,
      title: r.title,
      body: r.body,
      status: r.status,
      audienceScope: r.audienceScope,
      createdAt: r.createdAt,
      publishedAt: r.publishedAt,
      scheduledAt: r.scheduledAt,
      total: byId.get(r.id)?.total ?? 0,
      published: byId.get(r.id)?.published ?? 0,
      read: byId.get(r.id)?.read ?? 0,
      failed: byId.get(r.id)?.failed ?? 0,
    }));
  }),

  evidence: godAdminProcedure
    .input(z.object({ broadcastId: z.string().uuid() }))
    .query(async ({ ctx, input }) => getBroadcastEvidence(ctx.coreDb, input.broadcastId)),
});
