import { z } from "zod";
import { desc, eq, gte, inArray, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, godAdminProcedure } from "../trpc";
import { bunzyBroadcasts, bunzyDeliveries, bunzyPreferences, bunzySeries, ownedBusinesses } from "@rabbitty/database-core";
import {
  BUNZY_CATEGORIES,
  draftBroadcast,
  getBroadcastEvidence,
  getConnectMeta,
  previewBroadcast,
  publishBroadcast,
} from "../services/bunzyConnect";

const ACADEMY_SERIES = [
  {
    title: "Cómo aprovechar tu menú digital",
    body:
      "Tu menú digital es la primera impresión que se llevan tus clientes. Revisa que las fotos estén actualizadas, que los nombres sean claros y que los precios coincidan con el local. Un menú ordenado reduce dudas y prepara la visita.",
  },
  {
    title: "Cómo destacar tus productos populares",
    body:
      "Identifica los 3 productos que más vendes y dales prioridad en tu menú. Una foto cuidada y una descripción corta ayudan a que el cliente se decida antes de llegar. Cambia el destacado cada mes para mantenerlo fresco.",
  },
  {
    title: "Cómo aprovechar las recompensas Bunz",
    body:
      "Explica a tu equipo cómo funciona el cashback en Bunz y recuérdale al cliente que puede recibirlo al pagar. Una recompensa bien comunicada en caja se convierte en una razón para volver.",
  },
  {
    title: "Cómo revisar la actividad de tu negocio",
    body:
      "Dedica 5 minutos al día a revisar ventas, tickets promedio y canjes de Bunz. Detecta los días flojos y prueba una promoción pequeña. Lo que se mide se puede mejorar.",
  },
] as const;

const audienceSchema = z.object({
  scope: z.enum(["BUSINESS", "ALL_AFFILIATES", "ALL_RABBITTERS", "USER"]),
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

function assertMassAllowed(scope: "BUSINESS" | "ALL_AFFILIATES" | "ALL_RABBITTERS" | "USER", confirmMass?: boolean) {
  const isMass = scope === "ALL_AFFILIATES" || scope === "ALL_RABBITTERS";
  if (isMass && (process.env.BUNZY_CONNECT_ALLOW_MASS !== "1" || confirmMass !== true)) {
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
        clicked: sql<number>`count(*) filter (where ${bunzyDeliveries.clickedAt} is not null)::int`,
        skipped: sql<number>`count(*) filter (where ${bunzyDeliveries.status} = 'SKIPPED')::int`,
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
      clicked: byId.get(r.id)?.clicked ?? 0,
      skipped: byId.get(r.id)?.skipped ?? 0,
      failed: byId.get(r.id)?.failed ?? 0,
    }));
  }),

  draft: godAdminProcedure
    .input(
      z.object({
        brief: z.string().min(5).max(1000),
        category: z.enum(BUNZY_CATEGORIES),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        return await draftBroadcast(input.brief, input.category);
      } catch (err) {
        // El panel muestra este mensaje tal cual: debe decir QUÉ falló del
        // proveedor (modelo no instalado, falta API key, timeout…).
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: err instanceof Error ? `No se pudo redactar: ${err.message}` : "No se pudo redactar el borrador",
        });
      }
    }),

  scheduleAcademy: godAdminProcedure
    .input(
      z.object({
        businessId: z.string().min(1),
        startAt: z.string().datetime().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const start = input.startAt ? new Date(input.startAt) : new Date(Date.now() + 24 * 60 * 60 * 1000);
      const results = [];
      for (let i = 0; i < ACADEMY_SERIES.length; i += 1) {
        const item = ACADEMY_SERIES[i]!;
        const scheduledAt = new Date(start.getTime() + i * 7 * 24 * 60 * 60 * 1000).toISOString();
        results.push(
          await publishBroadcast(ctx.coreDb, {
            category: "TIP",
            title: item.title,
            body: item.body,
            ctaLabel: "Ver en Rabbitty",
            ctaUrl: "https://rabbitty.me",
            audience: { scope: "BUSINESS", businessId: input.businessId },
            requestKey: `academy:${input.businessId}:w${i + 1}`,
            createdBy: String(ctx.userId || "god"),
            scheduledAt,
          }),
        );
      }
      return { scheduled: results.length, results };
    }),

  analytics: godAdminProcedure.query(async ({ ctx }) => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const categories = await ctx.coreDb
      .select({
        category: bunzyBroadcasts.category,
        sent: sql<number>`count(*)::int`,
        published: sql<number>`count(*) filter (where ${bunzyDeliveries.status} in ('PUBLISHED','READ'))::int`,
        read: sql<number>`count(*) filter (where ${bunzyDeliveries.status} = 'READ')::int`,
        clicked: sql<number>`count(*) filter (where ${bunzyDeliveries.clickedAt} is not null)::int`,
        skipped: sql<number>`count(*) filter (where ${bunzyDeliveries.status} = 'SKIPPED')::int`,
        failed: sql<number>`count(*) filter (where ${bunzyDeliveries.status} = 'FAILED')::int`,
      })
      .from(bunzyDeliveries)
      .innerJoin(bunzyBroadcasts, eq(bunzyDeliveries.broadcastId, bunzyBroadcasts.id))
      .where(gte(bunzyBroadcasts.createdAt, since))
      .groupBy(bunzyBroadcasts.category);

    const [optOuts] = await ctx.coreDb
      .select({ n: sql<number>`count(*)::int` })
      .from(bunzyPreferences)
      .where(or(eq(bunzyPreferences.product, false), eq(bunzyPreferences.tips, false), eq(bunzyPreferences.news, false)));

    return { categories, optOuts: Number(optOuts?.n ?? 0) };
  }),

  series: godAdminProcedure.query(async ({ ctx }) =>
    ctx.coreDb
      .select()
      .from(bunzySeries)
      .orderBy(desc(bunzySeries.active), bunzySeries.nextRunAt)
      .limit(50),
  ),

  createSeries: godAdminProcedure
    .input(
      z.object({
        name: z.string().min(3).max(80),
        audienceScope: z.enum(["BUSINESS", "ALL_AFFILIATES", "ALL_RABBITTERS"]),
        businessId: z.string().min(1).optional(),
        category: z.enum(["TIP", "NEWS", "SYSTEM"]),
        cadenceDays: z.number().int().min(1).max(90),
        title: z.string().min(3).max(120),
        body: z.string().min(10).max(4000),
        ctaLabel: z.string().max(40).optional().nullable(),
        ctaUrl: z.string().url().optional().nullable(),
        startAt: z.string().datetime().optional(),
        confirmMass: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.audienceScope !== "BUSINESS") {
        assertMassAllowed(input.audienceScope, input.confirmMass);
      } else if (!input.businessId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Falta businessId para una serie de un negocio" });
      }

      const [created] = await ctx.coreDb
        .insert(bunzySeries)
        .values({
          name: input.name,
          audienceScope: input.audienceScope,
          businessId: input.businessId ?? null,
          category: input.category,
          cadenceDays: input.cadenceDays,
          nextRunAt: input.startAt ? new Date(input.startAt) : new Date(Date.now() + 24 * 60 * 60 * 1000),
          title: input.title,
          body: input.body,
          ctaLabel: input.ctaLabel ?? null,
          ctaUrl: input.ctaUrl ?? null,
          active: true,
          createdBy: String(ctx.userId || "god"),
        })
        .returning();

      return created;
    }),

  toggleSeries: godAdminProcedure
    .input(z.object({ id: z.string().uuid(), active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.coreDb
        .update(bunzySeries)
        .set({ active: input.active, updatedAt: new Date() })
        .where(eq(bunzySeries.id, input.id));
      return { ok: true };
    }),

  evidence: godAdminProcedure
    .input(z.object({ broadcastId: z.string().uuid() }))
    .query(async ({ ctx, input }) => getBroadcastEvidence(ctx.coreDb, input.broadcastId)),
});
