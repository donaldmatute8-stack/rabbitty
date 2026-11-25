import { z } from "zod";
import { and, desc, eq, gt, gte, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  branches,
  rabbitChairActivations,
  rabbitChairGrants,
  rabbitChairGrantUses,
  rabbitChairSlots,
  rabbitChairWaitlist,
} from "@rabbitty/database-restaurant/schema";
import {
  membershipSubscriptions,
  ownedBusinesses,
  presenceSessions,
  users,
} from "@rabbitty/database-core/schema";
import { sendRabbitChairDrop, sendRabbitChairInvite } from "../services/rabbitChairDrop";
import { logAudit } from "../middleware/auditLog";
import { naiveUtcToIso } from "../services/time";
import {
  adminOnlyProcedure,
  godAdminProcedure,
  posPermission,
  posProcedure,
  protectedProcedure,
  router,
} from "../trpc";
import {
  cancelActivation,
  checkoutSandbox,
  checkoutSlotAtPos,
  claimSlot,
  closeActivation,
  createActivation,
  createGrant,
  getActivation,
  getActiveActivation,
  grantSummary,
  listActivations,
  listSlots,
  markSeated,
  markServed,
  openActivation,
  convertWaitlistEntry,
  inviteNextWaiter,
  isRabbitChairEnabled,
  joinWaitlist,
  listWaitlist,
  scheduleRandomActivation,
  RabbitChairError,
  resolveBusinessId,
  setRabbitChairEnabled,
  updateActivationSettings,
  type Db,
} from "../services/rabbitChair";

/**
 * ── Rabbit Chair · router (Fase 0/1) ────────────────────────────────────────
 *
 * POS/admin/app sobre el mismo servicio. El cobro real está bloqueado: si
 * `RABBIT_CHAIR_PAYMENTS=live`, `checkout` responde PRECONDITION_FAILED hasta
 * que exista la integración de fase 2.
 */

function fail(error: unknown): never {
  if (error instanceof RabbitChairError) {
    const code =
      error.code === "NOT_FOUND"
        ? "NOT_FOUND"
        : error.code === "FORBIDDEN"
          ? "FORBIDDEN"
          : error.code === "SOLD_OUT" ||
              error.code === "INVALID_STATE" ||
              error.code === "PAYMENT_CONFLICT" ||
              error.code === "ALREADY_CLAIMED"
            ? "CONFLICT"
            : error.code === "NO_CREDITS" || error.code === "PAYMENT_REQUIRED"
              ? "PRECONDITION_FAILED"
              : "BAD_REQUEST";

    throw new TRPCError({ code, message: error.message });
  }

  throw error;
}

async function run<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    fail(error);
  }
}

/** Distancia en metros entre dos coordenadas (haversine). */
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const R = 6_371_000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function db(ctx: { restaurantDb: Db }): Db {
  return ctx.restaurantDb;
}

const activationInput = z.object({
  activationId: z.string().min(1),
});

const formatSchema = z.enum(["SINGLE", "BLOCK", "WAVES", "COUPLES"]);
const chargeModeSchema = z.enum(["PREPAID", "POSTPAID"]);
const menuModeSchema = z.enum(["COFFEE", "ALCOHOL", "BOTH"]);

const activateInput = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  format: formatSchema.default("BLOCK"),
  capacity: z.number().int().min(1).max(50).optional(),
  partySize: z.number().int().min(1).max(4).optional(),
  waveMinutes: z.number().int().min(5).max(240).nullish(),
  chargeMode: chargeModeSchema.default("PREPAID"),
  // false = el POS puede cobrar en efectivo. Default true (solo tarjeta).
  cardOnly: z.boolean().optional(),
  minContributionCents: z.number().int().min(5000).max(1_000_000).default(5000),
  durationMinutes: z.number().int().min(1).max(60).default(10),
  menuMode: menuModeSchema.default("BOTH"),
  requiresAgeCheck: z.boolean().optional(),
  playlist: z.string().trim().max(200).nullish(),
  lightPreset: z.string().trim().max(80).nullish(),
  bartenderMode: z.enum(["FIXED", "ROTATING"]).default("ROTATING"),
  randomWindowFrom: z.string().datetime().nullish(),
  randomWindowTo: z.string().datetime().nullish(),
  radiusMeters: z.number().int().min(50).max(20_000).nullish(),
  // Empleado extra (bartender/barista) y minutos pagados.
  staffId: z.string().min(1).nullish(),
  staffMinutes: z.number().int().min(0).max(1440).nullish(),
});

async function activationInBranch(ctx: { restaurantDb: Db }, activationId: string, branchId: string) {
  const activation = await getActivation(db(ctx), activationId);

  if (activation.branchId !== branchId) {
    throw new RabbitChairError("NOT_FOUND", "Activación no encontrada", 404);
  }

  return activation;
}

async function slotInBranch(ctx: { restaurantDb: Db }, slotId: string, branchId: string) {
  const [slot] = await db(ctx)
    .select({ activationId: rabbitChairSlots.activationId })
    .from(rabbitChairSlots)
    .where(eq(rabbitChairSlots.id, slotId))
    .limit(1);

  if (!slot) {
    throw new RabbitChairError("NOT_FOUND", "Lugar no encontrado", 404);
  }

  await activationInBranch(ctx, slot.activationId, branchId);
  return slot;
}

export const rabbitChairRouter = router({
  /** Métricas de La Silla: ocupación, aporte, servicio y fila. */
  metrics: adminOnlyProcedure
    .input(
      z.object({
        activationId: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        // branch = sucursal actual; business = consolidado del tenant.
        scope: z.enum(["branch", "business"]).default("branch"),
      }),
    )
    .query(({ ctx, input }) =>
      run(async () => {
        // Alcance: sucursal o todo el negocio (mismo patrón que el reporte por producto).
        let branchCondition = sql`a."branchId" = ${ctx.branchId}`;
        if (input.scope === "business") {
          const [branch] = await ctx.restaurantDb
            .select({ restaurantId: branches.restaurantId })
            .from(branches)
            .where(eq(branches.id, ctx.branchId))
            .limit(1);
          if (branch?.restaurantId) {
            branchCondition = sql`a."branchId" IN (
              SELECT "id" FROM "branches"
               WHERE "restaurantId" = ${branch.restaurantId} AND "isActive" = true
            )`;
          }
        }

        const rows = (await ctx.restaurantDb.execute(sql`
          SELECT a."id", a."name", a."status", a."capacity", a."startsAt", a."createdAt",
                 COALESCE(a."staffCostCents", 0)::int AS staff_cost_cents,
                 COUNT(s."id") FILTER (WHERE s."status" IN ('PAID','SEATED','SERVED','DONE'))::int AS sold,
                 COALESCE(SUM(s."paidCents") FILTER (WHERE s."paidCents" IS NOT NULL), 0)::int AS revenue_cents,
                 AVG(EXTRACT(EPOCH FROM (s."servedAt" - s."seatedAt")) / 60.0)
                   FILTER (WHERE s."servedAt" IS NOT NULL AND s."seatedAt" IS NOT NULL) AS avg_service_min
            FROM "rabbitChairActivations" a
            LEFT JOIN "rabbitChairSlots" s ON s."activationId" = a."id"
           WHERE ${branchCondition}
             ${input.activationId ? sql`AND a."id" = ${input.activationId}` : sql``}
             ${input.from ? sql`AND COALESCE(a."startsAt", a."createdAt") >= ${input.from}::date` : sql``}
             ${input.to ? sql`AND COALESCE(a."startsAt", a."createdAt") < (${input.to}::date + interval '1 day')` : sql``}
           GROUP BY a."id", a."name", a."status", a."capacity", a."startsAt", a."createdAt",
                    a."staffCostCents"
           ORDER BY COALESCE(a."startsAt", a."createdAt") DESC
           LIMIT 50
        `)) as any;
        const list = (rows?.rows ?? rows ?? []) as Array<Record<string, any>>;

        const waitRows = (await ctx.restaurantDb.execute(sql`
          SELECT w."activationId",
                 COUNT(*) FILTER (WHERE w."status" IN ('WAITING','INVITED'))::int AS waiting,
                 COUNT(*) FILTER (WHERE w."status" = 'CONVERTED')::int AS converted
            FROM "rabbitChairWaitlist" w
            JOIN "rabbitChairActivations" a ON a."id" = w."activationId"
           WHERE ${branchCondition}
           GROUP BY w."activationId"
        `)) as any;
        const waitMap = new Map<string, { waiting: number; converted: number }>();
        for (const row of (waitRows?.rows ?? waitRows ?? [])) {
          waitMap.set(String(row.activationId), {
            waiting: Number(row.waiting ?? 0),
            converted: Number(row.converted ?? 0),
          });
        }

        const activations = list.map((row) => {
          const capacity = Number(row.capacity ?? 0);
          const sold = Number(row.sold ?? 0);
          const revenue = Number(row.revenue_cents ?? 0) / 100;
          const staffCost = Number(row.staff_cost_cents ?? 0) / 100;
          const wait = waitMap.get(String(row.id)) ?? { waiting: 0, converted: 0 };
          return {
            id: String(row.id),
            name: row.name,
            status: row.status,
            capacity,
            startsAt: naiveUtcToIso(row.startsAt),
            createdAt: naiveUtcToIso(row.createdAt),
            sold,
            occupancyPct: capacity > 0 ? Math.round((sold / capacity) * 100) : 0,
            revenue,
            staffCost: Math.round(staffCost * 100) / 100,
            netMargin: Math.round((revenue - staffCost) * 100) / 100,
            avgContribution: sold > 0 ? Math.round((revenue / sold) * 100) / 100 : 0,
            avgServiceMin: row.avg_service_min ? Math.round(Number(row.avg_service_min) * 10) / 10 : null,
            waiting: wait.waiting,
            converted: wait.converted,
          };
        });

        const totals = activations.reduce(
          (acc, a) => {
            acc.capacity += a.capacity;
            acc.sold += a.sold;
            acc.revenue += a.revenue;
            acc.staffCost += a.staffCost;
            acc.waiting += a.waiting;
            acc.converted += a.converted;
            return acc;
          },
          { capacity: 0, sold: 0, revenue: 0, waiting: 0, converted: 0, staffCost: 0 },
        );

        return {
          scope: input.scope,
          totals: {
            ...totals,
            revenue: Math.round(totals.revenue * 100) / 100,
            staffCost: Math.round(totals.staffCost * 100) / 100,
            netMargin: Math.round((totals.revenue - totals.staffCost) * 100) / 100,
            occupancyPct: totals.capacity > 0 ? Math.round((totals.sold / totals.capacity) * 100) : 0,
            avgContribution: totals.sold > 0 ? Math.round((totals.revenue / totals.sold) * 100) / 100 : 0,
            activations: activations.length,
          },
          activations,
        };
      }),
    ),

  /** ¿El dueño activó la experiencia en este negocio? */
  status: posProcedure.query(({ ctx }) =>
    run(async () => ({ enabled: await isRabbitChairEnabled(db(ctx), ctx.branchId) })),
  ),

  /**
   * Activar/desactivar Rabbit Chair. Solo el DUEÑO (sin ficha de staff):
   * es la "activación literal" que habilita la experiencia en el POS.
   */
  enable: protectedProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(({ ctx, input }) =>
      run(async () => {
        if (ctx.staffRole) {
          throw new RabbitChairError(
            "FORBIDDEN",
            "Solo el dueño del negocio puede activar Rabbit Chair.",
            403,
          );
        }
        const result = await setRabbitChairEnabled(
          db(ctx),
          ctx.branchId,
          input.enabled,
          ctx.userId ?? null,
        );

        logAudit({
          userId: ctx.userId ?? null,
          action: input.enabled ? "RABBIT_CHAIR_ENABLE" : "RABBIT_CHAIR_DISABLE",
          resource: "restaurants",
          resourceId: ctx.branchId,
          details: { enabled: input.enabled, branchId: ctx.branchId },
        });

        return result;
      }),
    ),

  /**
   * God: otorga créditos a un negocio. Es la puerta de acceso al producto;
   * sin grant activo no se puede crear una activación.
   */
  grant: godAdminProcedure
    .input(
      z.object({
        businessId: z.string().min(1),
        credits: z.number().int().min(1).max(1000),
        days: z.number().int().min(1).max(365).default(30),
        requestId: z.string().min(1).nullish(),
      }),
    )
    .mutation(({ ctx, input }) =>
      run(async () => {
        const grant = await createGrant(db(ctx), {
          businessId: input.businessId,
          credits: input.credits,
          days: input.days,
          requestId: input.requestId ?? null,
          createdBy: ctx.userId ?? null,
        });

        // Evidencia: quién otorgó, a qué negocio y cuántos créditos.
        logAudit({
          userId: ctx.userId ?? null,
          action: "RABBIT_CHAIR_GRANT",
          resource: "rabbitChairGrants",
          resourceId: grant?.id ?? input.businessId,
          details: {
            businessId: input.businessId,
            credits: input.credits,
            days: input.days,
            requestId: input.requestId ?? null,
          },
        });

        return grant;
      }),
    ),

  /** Admin del negocio: resumen de créditos (módulo La Silla). */
  credits: adminOnlyProcedure.query(({ ctx }) =>
    run(async () => {
      const businessId = await resolveBusinessId(db(ctx), ctx.branchId);
      return grantSummary(db(ctx), businessId);
    }),
  ),

  /**
   * Admin del negocio: historial de créditos con su uso real (a qué activación
   * se aplicó cada crédito). Solo lectura; no toca Bunz ni caja.
   */
  grants: adminOnlyProcedure.query(({ ctx }) =>
    run(async () => {
      const businessId = await resolveBusinessId(db(ctx), ctx.branchId);

      const grants = await db(ctx)
        .select()
        .from(rabbitChairGrants)
        .where(eq(rabbitChairGrants.businessId, businessId))
        .orderBy(desc(rabbitChairGrants.createdAt))
        .limit(50);

      const uses = await db(ctx)
        .select({
          grantId: rabbitChairGrantUses.grantId,
          activationId: rabbitChairGrantUses.activationId,
          usedAt: rabbitChairGrantUses.createdAt,
          activationName: rabbitChairActivations.name,
          activationStatus: rabbitChairActivations.status,
          startsAt: rabbitChairActivations.startsAt,
        })
        .from(rabbitChairGrantUses)
        .leftJoin(
          rabbitChairActivations,
          eq(rabbitChairActivations.id, rabbitChairGrantUses.activationId),
        )
        .where(eq(rabbitChairGrantUses.businessId, businessId))
        .orderBy(desc(rabbitChairGrantUses.createdAt));

      const usesByGrant = new Map<string, typeof uses>();
      for (const use of uses) {
        const list = usesByGrant.get(use.grantId) ?? [];
        list.push(use);
        usesByGrant.set(use.grantId, list);
      }

      const now = Date.now();
      const remaining = grants
        .filter(
          (grant) =>
            !grant.revokedAt &&
            (!grant.expiresAt || grant.expiresAt.getTime() > now) &&
            grant.creditsUsed < grant.creditsTotal,
        )
        .reduce((total, grant) => total + (grant.creditsTotal - grant.creditsUsed), 0);

      return {
        creditsRemaining: remaining,
        grants: grants.map((grant) => ({
          ...grant,
          uses: usesByGrant.get(grant.id) ?? [],
        })),
      };
    }),
  ),

  activate: adminOnlyProcedure.input(activateInput).mutation(({ ctx, input }) =>
    run(async () => {
      if (!(await isRabbitChairEnabled(db(ctx), ctx.branchId))) {
        throw new RabbitChairError(
          "INVALID_STATE",
          "Activa Rabbit Chair en Marketing → Rabbit Chair antes de crear una activación.",
        );
      }
      return createActivation(db(ctx), {
        branchId: ctx.branchId,
        name: input.name,
        format: input.format,
        capacity: input.capacity,
        partySize: input.partySize,
        waveMinutes: input.waveMinutes ?? null,
        chargeMode: input.chargeMode,
        cardOnly: input.cardOnly,
        minContributionCents: input.minContributionCents,
        durationMinutes: input.durationMinutes,
        menuMode: input.menuMode,
        requiresAgeCheck: input.requiresAgeCheck,
        playlist: input.playlist ?? null,
        lightPreset: input.lightPreset ?? null,
        bartenderMode: input.bartenderMode,
        randomWindowFrom: input.randomWindowFrom ? new Date(input.randomWindowFrom) : null,
        randomWindowTo: input.randomWindowTo ? new Date(input.randomWindowTo) : null,
        radiusMeters: input.radiusMeters ?? null,
        staffId: input.staffId ?? null,
        staffMinutes: input.staffMinutes ?? null,
        createdBy: ctx.userId ?? null,
      });
    }),
  ),

  list: adminOnlyProcedure.query(({ ctx }) => run(() => listActivations(db(ctx), ctx.branchId))),

  open: adminOnlyProcedure.input(activationInput).mutation(({ ctx, input }) =>
    run(async () => {
      if (!(await isRabbitChairEnabled(db(ctx), ctx.branchId))) {
        throw new RabbitChairError("INVALID_STATE", "Rabbit Chair no está activado en este negocio.");
      }
      await activationInBranch(ctx, input.activationId, ctx.branchId);
      return openActivation(db(ctx), input.activationId);
    }),
  ),

  /** Sortear fecha dentro de la ventana (Bunzy). */
  scheduleRandom: adminOnlyProcedure.input(activationInput).mutation(({ ctx, input }) =>
    run(async () => {
      await activationInBranch(ctx, input.activationId, ctx.branchId);
      return scheduleRandomActivation(db(ctx), input.activationId);
    }),
  ),

  /**
   * Lanzar el drop: abre la activación y avisa a los Rabbitters.
   * Destino: presencia reciente en el negocio; si no hay, usuarios con push.
   */
  launch: adminOnlyProcedure
    .input(
      activationInput.extend({
        allowBroadcast: z.boolean().optional(),
        // Audiencia del aviso. PRESENCE es la natural (quien ya estuvo aquí).
        audience: z.enum(["PRESENCE", "RADIO", "WAITLIST", "MEMBERS", "ALL"]).default(
          "PRESENCE",
        ),
      }),
    )
    .mutation(({ ctx, input }) =>
    run(async () => {
      if (!(await isRabbitChairEnabled(db(ctx), ctx.branchId))) {
        throw new RabbitChairError("INVALID_STATE", "Rabbit Chair no está activado en este negocio.");
      }
      const activation = await activationInBranch(ctx, input.activationId, ctx.branchId);
      if (activation.status !== "DRAFT") {
        throw new RabbitChairError("INVALID_STATE", "Solo se puede lanzar una activación en borrador");
      }

      const businessId = await resolveBusinessId(db(ctx), ctx.branchId);
      let userIds: string[] = [];
      let broadcast = false;

      if (input.audience === "PRESENCE") {
        // 1) Presencia reciente (lo natural del drop).
        try {
          const since = new Date(Date.now() - 60 * 86400_000);
          const rows = await ctx.coreDb
            .selectDistinct({ userId: presenceSessions.userId })
            .from(presenceSessions)
            .where(and(eq(presenceSessions.businessId, businessId), gte(presenceSessions.lastPingAt, since)))
            .limit(500);
          userIds = rows.map((r) => r.userId).filter(Boolean) as string[];
        } catch (err) {
          console.warn("[rabbitChair.launch] presencia falló:", err);
        }

        // Sin presencia: NO se manda un masivo sin confirmación explícita.
        if (userIds.length === 0) {
          if (!input.allowBroadcast) {
            throw new RabbitChairError(
              "INVALID_STATE",
              "Sin audiencia reciente en el negocio. Confirma el envío masivo (allowBroadcast) para avisar a los Rabbitters con push.",
            );
          }
          broadcast = true;
          const fallback = await ctx.coreDb
            .select({ id: users.id })
            .from(users)
            .where(eq(users.pushInAppEnabled, true))
            .limit(100);
          userIds = fallback.map((u) => u.id);
        }
      } else if (input.audience === "RADIO") {
        // 1b) Radio / proximidad: Rabbitters con presencia reciente en algún
        // negocio dentro del radio del local (no guardamos ubicación personal).
        const radius = Math.min(
          20_000,
          Math.max(50, Number(activation.radiusMeters ?? 1000)),
        );
        const [branch] = await db(ctx)
          .select({ lat: branches.lat, lng: branches.lng })
          .from(branches)
          .where(eq(branches.id, ctx.branchId))
          .limit(1);
        let lat = branch?.lat ?? null;
        let lng = branch?.lng ?? null;
        if (lat == null || lng == null) {
          const [biz] = await ctx.coreDb
            .select({ lat: ownedBusinesses.lat, lng: ownedBusinesses.lng })
            .from(ownedBusinesses)
            .where(eq(ownedBusinesses.id, businessId))
            .limit(1);
          lat = biz?.lat ?? null;
          lng = biz?.lng ?? null;
        }
        if (lat == null || lng == null) {
          throw new RabbitChairError(
            "INVALID_STATE",
            "El local no tiene ubicación configurada. No se puede usar el radio.",
            409,
          );
        }
        const targetLat = lat;
        const targetLng = lng;
        const businesses = await ctx.coreDb
          .select({ id: ownedBusinesses.id, lat: ownedBusinesses.lat, lng: ownedBusinesses.lng })
          .from(ownedBusinesses);
        const nearbyIds = businesses
          .filter(
            (biz) =>
              biz.lat != null &&
              biz.lng != null &&
              distanceMeters(targetLat, targetLng, biz.lat, biz.lng) <= radius,
          )
          .map((biz) => biz.id);

        if (nearbyIds.length === 0) {
          throw new RabbitChairError(
            "INVALID_STATE",
            "No hay negocios con ubicación dentro del radio. Elige otra audiencia.",
          );
        }

        const since = new Date(Date.now() - 60 * 86400_000);
        const rows = await ctx.coreDb
          .selectDistinct({ userId: presenceSessions.userId })
          .from(presenceSessions)
          .where(
            and(
              inArray(presenceSessions.businessId, nearbyIds),
              gte(presenceSessions.lastPingAt, since),
            ),
          )
          .limit(500);
        userIds = rows.map((r) => r.userId).filter(Boolean) as string[];

        if (userIds.length === 0) {
          throw new RabbitChairError(
            "INVALID_STATE",
            "No hay Rabbitters con presencia dentro del radio. Elige otra audiencia.",
          );
        }
      } else if (input.audience === "WAITLIST") {
        // 2) Quienes alguna vez entraron a la fila de La Silla del negocio.
        const rows = await db(ctx)
          .selectDistinct({ userId: rabbitChairWaitlist.userId })
          .from(rabbitChairWaitlist)
          .innerJoin(
            rabbitChairActivations,
            eq(rabbitChairActivations.id, rabbitChairWaitlist.activationId),
          )
          .where(
            and(
              eq(rabbitChairActivations.businessId, businessId),
              isNotNull(rabbitChairWaitlist.userId),
            ),
          )
          .limit(500);
        userIds = rows.map((r) => r.userId).filter(Boolean) as string[];

        if (userIds.length === 0) {
          throw new RabbitChairError(
            "INVALID_STATE",
            "No hay Rabbitters en la fila de este negocio. Elige otra audiencia.",
          );
        }
      } else if (input.audience === "MEMBERS") {
        // 3) Miembros activos del negocio (membresía vigente, no revocada).
        const rows = await ctx.coreDb
          .selectDistinct({ userId: membershipSubscriptions.userId })
          .from(membershipSubscriptions)
          .where(
            and(
              eq(membershipSubscriptions.businessId, businessId),
              eq(membershipSubscriptions.status, "ACTIVE"),
              isNull(membershipSubscriptions.revokedAt),
              or(
                isNull(membershipSubscriptions.currentPeriodEnd),
                gt(membershipSubscriptions.currentPeriodEnd, new Date()),
              ),
            ),
          )
          .limit(500);
        userIds = rows.map((r) => r.userId).filter(Boolean) as string[];

        if (userIds.length === 0) {
          throw new RabbitChairError(
            "INVALID_STATE",
            "No hay miembros activos en este negocio. Elige otra audiencia.",
          );
        }
      } else {
        // 4) Todos con push: solo con confirmación explícita (masivo).
        if (!input.allowBroadcast) {
          throw new RabbitChairError(
            "INVALID_STATE",
            "El envío masivo a todos los Rabbitters exige confirmación (allowBroadcast).",
          );
        }
        broadcast = true;
        const rows = await ctx.coreDb
          .select({ id: users.id })
          .from(users)
          .where(eq(users.pushInAppEnabled, true))
          .limit(100);
        userIds = rows.map((u) => u.id);
      }

      const opened = await openActivation(db(ctx), input.activationId);

      const notified = await sendRabbitChairDrop(userIds, {
        businessId,
        name: activation.name,
        branchId: ctx.branchId,
      });

      logAudit({
        userId: ctx.userId ?? null,
        action: "RABBIT_CHAIR_LAUNCH",
        resource: "rabbitChairActivations",
        resourceId: input.activationId,
        details: {
          businessId,
          audienceType: input.audience,
          audience: userIds.length,
          notified,
          broadcast,
        },
      });

      return {
        activation: opened,
        notified,
        audience: userIds.length,
        audienceType: input.audience,
        broadcast,
      };
    }),
  ),

  /**
   * Ajustes editables sin recompensar ni consumir crédito: solo tarjeta
   * (efectivo en POS) y radio de proximidad. Aplica a borradores y abiertas.
   */
  settings: adminOnlyProcedure
    .input(
      z.object({
        activationId: z.string().min(1),
        cardOnly: z.boolean().optional(),
        radiusMeters: z.number().int().min(50).max(20_000).nullish(),
      }),
    )
    .mutation(({ ctx, input }) =>
      run(async () => {
        await activationInBranch(ctx, input.activationId, ctx.branchId);
        const updated = await updateActivationSettings(db(ctx), input.activationId, {
          cardOnly: input.cardOnly,
          radiusMeters: input.radiusMeters,
        });

        logAudit({
          userId: ctx.userId ?? null,
          action: "RABBIT_CHAIR_SETTINGS",
          resource: "rabbitChairActivations",
          resourceId: input.activationId,
          details: {
            cardOnly: input.cardOnly ?? null,
            radiusMeters: input.radiusMeters ?? null,
          },
        });

        return updated;
      }),
    ),

  close: adminOnlyProcedure.input(activationInput).mutation(({ ctx, input }) =>
    run(async () => {
      await activationInBranch(ctx, input.activationId, ctx.branchId);
      return closeActivation(db(ctx), input.activationId);
    }),
  ),

  cancel: adminOnlyProcedure.input(activationInput).mutation(({ ctx, input }) =>
    run(async () => {
      await activationInBranch(ctx, input.activationId, ctx.branchId);
      return cancelActivation(db(ctx), input.activationId);
    }),
  ),

  /** POS: activación LIVE + lugares en una sola llamada. */
  active: posProcedure.query(({ ctx }) =>
    run(async () => {
      const enabled = await isRabbitChairEnabled(db(ctx), ctx.branchId);
      if (!enabled) return { enabled: false, activation: null, slots: [], soldOut: false };

      const activation = await getActiveActivation(db(ctx), ctx.branchId);
      if (!activation) return { enabled: true, activation: null, slots: [], soldOut: false };

      const slots = await listSlots(db(ctx), activation.id);

      // Si se liberó un lugar y hay fila, se invita al primero (una sola vez).
      if (slots.some((slot) => slot.status === "FREE")) {
        try {
          const invited = await inviteNextWaiter(db(ctx), activation.id);
          if (invited?.userId) {
            const businessId = await resolveBusinessId(db(ctx), ctx.branchId);
            void sendRabbitChairInvite(invited.userId, {
              businessId,
              name: activation.name,
              branchId: ctx.branchId,
            });
          }
        } catch (err) {
          console.warn("[rabbitChair.active] invitación falló:", err);
        }
      }

      return {
        enabled: true,
        activation,
        slots,
        // A1: "agotada" derivada. La activación sigue LIVE para que la app
        // ofrezca la fila y el POS conserve el tablero.
        soldOut: slots.every((slot) => slot.status !== "FREE"),
      };
    }),
  ),

  slots: posProcedure.input(activationInput).query(({ ctx, input }) =>
    run(async () => {
      await activationInBranch(ctx, input.activationId, ctx.branchId);
      return listSlots(db(ctx), input.activationId);
    }),
  ),

  /** App: el Rabbiter toma un lugar (hold de 5 minutos). */
  claim: protectedProcedure.input(activationInput).mutation(({ ctx, input }) =>
    run(() =>
      claimSlot(db(ctx), input.activationId, {
        userId: ctx.userId ?? null,
      }).then(async (slot) => {
        await convertWaitlistEntry(db(ctx), input.activationId, ctx.userId ?? null);
        return slot;
      }),
    ),
  ),

  /** Entrar a la lista de espera cuando la silla está llena. */
  joinWaitlist: protectedProcedure.input(activationInput).mutation(({ ctx, input }) =>
    run(() =>
      joinWaitlist(db(ctx), input.activationId, { userId: ctx.userId ?? null }),
    ),
  ),

  /** POS/admin: quién está en la fila. */
  waitlist: posProcedure.input(activationInput).query(({ ctx, input }) =>
    run(async () => {
      await activationInBranch(ctx, input.activationId, ctx.branchId);
      return listWaitlist(db(ctx), input.activationId);
    }),
  ),

  /** POS: la casa aparta un lugar para un invitado (sin cuenta en la app). */
  claimAtPos: posProcedure
    .input(
      z.object({
        activationId: z.string().min(1),
        guestName: z.string().trim().max(120).nullish(),
      }),
    )
    .mutation(({ ctx, input }) =>
      run(async () => {
        await activationInBranch(ctx, input.activationId, ctx.branchId);
        return claimSlot(db(ctx), input.activationId, {
          guestName: input.guestName ?? null,
        });
      }),
    ),

  /**
   * Checkout SANDBOX. En fase 2 el cobro real (Stripe/terminal) se conecta
   * antes de este paso; mientras, `RABBIT_CHAIR_PAYMENTS=live` lo bloquea.
   */
  checkout: protectedProcedure
    .input(
      z.object({
        slotId: z.string().min(1),
        amountCents: z.number().int().min(5000).max(1_000_000),
        paymentRef: z.string().trim().min(6).max(120),
      }),
    )
    .mutation(({ ctx, input }) =>
      run(async () => {
        // Fail-closed: sin `RABBIT_CHAIR_PAYMENTS=sandbox` explícito, el
        // checkout no corre. En producción se queda apagado hasta fase 2.
        if (process.env.RABBIT_CHAIR_PAYMENTS !== "sandbox") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "El cobro de Rabbit Chair aún no está habilitado.",
          });
        }

        return checkoutSandbox(db(ctx), {
          slotId: input.slotId,
          amountCents: input.amountCents,
          paymentRef: input.paymentRef,
          userId: ctx.userId ?? null,
        });
      }),
    ),

  /**
   * Cobro real del aporte en caja. Registra una orden normal (entra a caja,
   * reportes y conciliación) y marca el lugar como pagado.
   */
  checkoutAtPos: posPermission("POS_CHARGE")
    .input(
      z.object({
        slotId: z.string().min(1),
        amountCents: z.number().int().min(100).max(1_000_000),
        method: z.enum(["CARD", "CASH"]).default("CARD"),
        reference: z.string().trim().max(120).nullish(),
      }),
    )
    .mutation(({ ctx, input }) =>
      run(async () => {
        await slotInBranch(ctx, input.slotId, ctx.branchId);
        return checkoutSlotAtPos(db(ctx), {
          slotId: input.slotId,
          amountCents: input.amountCents,
          method: input.method,
          reference: input.reference ?? null,
          staffId: ctx.posOperator?.staffId ?? null,
          terminalId: ctx.posAuth?.terminalId ?? null,
        });
      }),
    ),

  seat: posPermission("POS_CHARGE")
    .input(z.object({ slotId: z.string().min(1) }))
    .mutation(({ ctx, input }) =>
      run(async () => {
        await slotInBranch(ctx, input.slotId, ctx.branchId);
        return markSeated(db(ctx), input.slotId);
      }),
    ),

  serve: posPermission("POS_CHARGE")
    .input(z.object({ slotId: z.string().min(1) }))
    .mutation(({ ctx, input }) =>
      run(async () => {
        await slotInBranch(ctx, input.slotId, ctx.branchId);
        return markServed(db(ctx), input.slotId);
      }),
    ),
});
