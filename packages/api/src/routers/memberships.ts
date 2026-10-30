import { z } from "zod";
import { and, eq, desc, sql, lt, gt } from "drizzle-orm";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import {
  membershipPlans,
  membershipPlanVersions,
  membershipSubscriptions,
  membershipEntitlements,
  entitlementUsages,
  ownedBusinesses,
  users,
} from "@rabbitty/database-core/schema";
import { branches, restaurants } from "@rabbitty/database-restaurant/schema";
import { isGodAdminIdentity } from "../services/god2fa";
import { miniappClient } from "../services/miniapp-client";

// ── Helpers ──────────────────────────────────────────────────────────────────

const QR_WINDOW_SECONDS = 30;

const benefitRuleSchema = z.object({
  type: z.enum(["INCLUDED_PRODUCT", "DISCOUNT_PCT", "CREDIT_BALANCE", "EVENT_ACCESS", "BULK_PACK"]),
  targetRefId: z.string().optional(),
  quotaPerCycle: z.number().int().min(1),
  cycleResetType: z.enum(["DAILY", "WEEKLY", "MONTHLY", "FIXED"]),
  discountPct: z.number().min(0).max(100).optional(),
  creditBalance: z.number().min(0).optional(),
});

const intervalSchema = z.enum(["MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL", "ONE_TIME"]);

function addInterval(from: Date, interval: z.infer<typeof intervalSchema>): Date {
  const d = new Date(from);
  const months = { MONTHLY: 1, QUARTERLY: 3, SEMIANNUAL: 6, ANNUAL: 12, ONE_TIME: 12 }[interval];
  d.setMonth(d.getMonth() + months);
  return d;
}

function addCycle(from: Date, reset: "DAILY" | "WEEKLY" | "MONTHLY" | "FIXED", hardEnd: Date): Date {
  const d = new Date(from);
  if (reset === "DAILY") d.setDate(d.getDate() + 1);
  else if (reset === "WEEKLY") d.setDate(d.getDate() + 7);
  else if (reset === "MONTHLY") d.setMonth(d.getMonth() + 1);
  else return hardEnd;
  return d > hardEnd ? hardEnd : d;
}

function signQr(subscriptionId: string, secret: string, window: number): string {
  return createHmac("sha256", secret).update(`${subscriptionId}.${window}`).digest("hex").slice(0, 24);
}

/** Token QR dinámico: `<subscriptionId>.<window>.<hmac>` (rota cada 30s). */
function buildQrToken(subscriptionId: string, secret: string): string {
  const window = Math.floor(Date.now() / 1000 / QR_WINDOW_SECONDS);
  return `${subscriptionId}.${window}.${signQr(subscriptionId, secret, window)}`;
}

async function assertBusinessOwner(ctx: any, businessId: string) {
  // God Admin (identidad verificada con 2FA) tiene poder sobre todos los negocios
  if (isGodAdminIdentity(ctx.user?.email, ctx.user?.name)) return;
  const [biz] = await ctx.coreDb
    .select({ id: ownedBusinesses.id })
    .from(ownedBusinesses)
    .where(and(eq(ownedBusinesses.id, businessId), eq(ownedBusinesses.ownerId, ctx.userId)))
    .limit(1);
  if (!biz) throw new TRPCError({ code: "FORBIDDEN", message: "No eres administrador de este negocio" });
}

/** Owner del negocio O staff (cajero/waiter/mesero) de una sucursal que le pertenece. */
async function assertCanRedeem(ctx: any, businessId: string) {
  if (isGodAdminIdentity(ctx.user?.email, ctx.user?.name)) return;
  const [biz] = await ctx.coreDb
    .select({ id: ownedBusinesses.id })
    .from(ownedBusinesses)
    .where(and(eq(ownedBusinesses.id, businessId), eq(ownedBusinesses.ownerId, ctx.userId)))
    .limit(1);
  if (biz) return;
  if (ctx.branchId) {
    const [br] = await ctx.restaurantDb
      .select({ restaurantId: branches.restaurantId })
      .from(branches)
      .where(eq(branches.id, ctx.branchId))
      .limit(1);
    if (br?.restaurantId) {
      const [rest] = await ctx.restaurantDb
        .select({ businessId: restaurants.businessId })
        .from(restaurants)
        .where(eq(restaurants.id, br.restaurantId))
        .limit(1);
      if (rest?.businessId === businessId) return;
    }
  }
  throw new TRPCError({ code: "FORBIDDEN", message: "No puedes canjear en este negocio" });
}

/** businessId del tenant actual (owner o staff) — para el escáner del POS. */
async function resolveBusinessForBranch(ctx: any): Promise<string | null> {
  const mine = await ctx.coreDb
    .select({ id: ownedBusinesses.id })
    .from(ownedBusinesses)
    .where(eq(ownedBusinesses.ownerId, ctx.userId))
    .limit(1);
  if (mine[0]?.id) return mine[0].id;
  if (ctx.branchId) {
    const [br] = await ctx.restaurantDb
      .select({ restaurantId: branches.restaurantId })
      .from(branches)
      .where(eq(branches.id, ctx.branchId))
      .limit(1);
    if (br?.restaurantId) {
      const [rest] = await ctx.restaurantDb
        .select({ businessId: restaurants.businessId })
        .from(restaurants)
        .where(eq(restaurants.id, br.restaurantId))
        .limit(1);
      if (rest?.businessId) return rest.businessId;
    }
  }
  return null;
}

function buildEntitlementRows(
  subscriptionId: string,
  rules: z.infer<typeof benefitRuleSchema>[],
  start: Date,
  periodEnd: Date,
) {
  return rules.map((r) => ({
    subscriptionId,
    benefitType: r.type,
    targetRefId: r.targetRefId ?? null,
    quotaPerCycle: r.quotaPerCycle,
    cycleResetType: r.cycleResetType,
    currentUsageInCycle: 0,
    cycleStartDate: start,
    cycleEndDate: addCycle(start, r.cycleResetType, periodEnd),
    discountPct: r.discountPct ?? null,
    creditBalance: r.creditBalance ?? null,
  }));
}


/** Tope de cortesías activas por negocio — God Admin configurable (systemSettings). */
async function getCourtesyCap(coreDb: any, businessId: string): Promise<number> {
  try {
    const [row] = await coreDb.select({ value: sql<string>`value` }).from(
      (await import("@rabbitty/database-core/schema")).systemSettings
    ).where(sql`key = 'membership_courtesy_cap'`).limit(1);
    if (row?.value) {
      const cfg = JSON.parse(row.value);
      return Number(cfg.overrides?.[businessId] ?? cfg.default ?? 10);
    }
  } catch { /* default */ }
  return 10;
}


// ── Router ───────────────────────────────────────────────────────────────────

export const membershipsRouter = router({

  /**
   * 🎁 Otorga una cortesía: suscripción individual sin pago, beneficios personalizables
   * por destinatario (NO altera el plan), revocable por el dueño. Origen COURTESY.
   * Atómico: suscripción + beneficios + auditoría en UNA transacción; notificación post-commit.
   */
  grantCourtesy: protectedProcedure
    .input(z.object({
      targetUserId: z.string(),
      benefitRules: z.array(benefitRuleSchema).min(1).max(10),
      durationMonths: z.union([z.literal(3), z.literal(6), z.literal(12), z.literal(0)]), // 0 = indefinida (revocable)
      giftNote: z.string().max(300).optional(),
      label: z.string().max(60).optional(), // etiqueta visible opcional (ej. "Cortesía Familiar")
    }))
    .mutation(async ({ ctx, input }) => {
      const [biz] = await ctx.coreDb.select({ id: ownedBusinesses.id, name: ownedBusinesses.name })
        .from(ownedBusinesses).where(eq(ownedBusinesses.ownerId, ctx.userId)).limit(1);
      if (!biz) throw new TRPCError({ code: "FORBIDDEN", message: "No eres dueño de un negocio" });
      if (input.targetUserId === ctx.userId) throw new TRPCError({ code: "BAD_REQUEST", message: "No puedes otorgártela a ti mismo" });

      const now = new Date();
      const indefinite = input.durationMonths === 0;
      const periodEnd = indefinite ? null : (() => { const d = new Date(now); d.setMonth(d.getMonth() + input.durationMonths); return d; })();
      // Entitlements FIXED necesitan fecha concreta (contadores internos): +99 años para indefinidas
      const entitlementHardEnd = periodEnd ?? (() => { const d = new Date(now); d.setFullYear(d.getFullYear() + 99); return d; })();

      const sub = await ctx.coreDb.transaction(async (tx: any) => {
        // Cap server-side ATÓMICO: contar cortesías activas DENTRO de la tx
        const [countRow] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(membershipSubscriptions)
          .where(and(
            eq(membershipSubscriptions.businessId, biz.id),
            eq(membershipSubscriptions.membershipOrigin, "COURTESY"),
            eq(membershipSubscriptions.status, "ACTIVE"),
          ));
        const cap = await getCourtesyCap(ctx.coreDb, biz.id);
        if ((countRow?.count ?? 0) >= cap) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Tope de cortesías activas alcanzado (${cap}). Revoca una para liberar cupo.` });
        }

        const [target] = await tx.select({ id: users.id }).from(users).where(eq(users.id, input.targetUserId)).limit(1);
        if (!target) throw new TRPCError({ code: "BAD_REQUEST", message: "Destinatario no encontrado" });

        // Unicidad: el destinatario no puede tener 2 cortesías activas del mismo negocio
        const [dup] = await tx.select({ id: membershipSubscriptions.id })
          .from(membershipSubscriptions)
          .where(and(
            eq(membershipSubscriptions.userId, input.targetUserId),
            eq(membershipSubscriptions.businessId, biz.id),
            eq(membershipSubscriptions.membershipOrigin, "COURTESY"),
            eq(membershipSubscriptions.status, "ACTIVE"),
          ))
          .limit(1);
        if (dup) throw new TRPCError({ code: "CONFLICT", message: "Ese usuario ya tiene una cortesía activa de este negocio" });

        const [created] = await tx.insert(membershipSubscriptions).values({
          userId: input.targetUserId,
          businessId: biz.id,
          planVersionId: null,                       // cortesía = suscripción individual, sin plan
          status: "ACTIVE",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,               // null = indefinida real (revocable)
          noExpiration: indefinite,
          paymentProvider: null,                     // sin pago — el origen lo dice
          membershipOrigin: "COURTESY",
          issuedByUserId: ctx.userId,
          giftNote: input.giftNote || null,
          qrPassSecret: randomBytes(32).toString("hex"),
        }).returning();

        await tx.insert(membershipEntitlements).values(
          buildEntitlementRows(created.id, input.benefitRules, now, entitlementHardEnd)
        );

        await tx.insert((await import("@rabbitty/database-core/schema")).auditEntries).values({
          userId: ctx.userId,
          action: "COURTESY_GRANTED",
          resource: "membership_subscriptions",
          resourceId: created.id,
          details: `${biz.name} → user ${input.targetUserId} · ${input.durationMonths === 0 ? "indefinida" : `${input.durationMonths}m`} · ${input.benefitRules.length} beneficios`,
        }).catch(() => {});

        return created;
      });

      // Notificación POST-commit (nunca anuncia lo que no se confirmó)
      try {
        await miniappClient.sendNotification({
          userId: input.targetUserId,
          title: `🎁 ${biz.name} te otorgó una membresía`,
          message: input.giftNote ? `Con nota: "${input.giftNote}" — ábrela en Mis Membresías y muéstrala en caja.` : "Está activa desde ya — muéstrala en caja con su QR dorado.",
          type: "REWARD",
          route: "/memberships",
        } as any);
      } catch (notifyErr) {
        console.error("[memberships] notify cortesía falló:", notifyErr);
      }

      return { subscriptionId: sub.id, periodEnd, indefinite };
    }),

  /**
   * Revoca una cortesía: inmediata, server-side, auditada. El QR deja de funcionar
   * porque redeemAtPOS re-verifica el estado CON lock dentro de la transacción.
   */
  revokeCourtesy: protectedProcedure
    .input(z.object({ subscriptionId: z.string(), reason: z.string().max(300).optional() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.coreDb.transaction(async (tx: any) => {
        const [sub] = await tx.select().from(membershipSubscriptions)
          .where(eq(membershipSubscriptions.id, input.subscriptionId))
          .for("update");
        if (!sub) throw new TRPCError({ code: "NOT_FOUND", message: "Membresía no encontrada" });
        const [biz] = await tx.select({ ownerId: ownedBusinesses.ownerId, name: ownedBusinesses.name })
          .from(ownedBusinesses).where(eq(ownedBusinesses.id, sub.businessId)).limit(1);
        if (biz?.ownerId !== ctx.userId && !isGodAdminIdentity(ctx.user?.email, ctx.user?.name)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Solo el dueño puede revocar" });
        }
        if (sub.membershipOrigin !== "COURTESY") throw new TRPCError({ code: "BAD_REQUEST", message: "Solo se revocan cortesías" });
        if (sub.status !== "ACTIVE") throw new TRPCError({ code: "BAD_REQUEST", message: "Ya no está activa" });

        await tx.update(membershipSubscriptions).set({
          status: "REVOKED",
          revokedAt: new Date(),
          revokedByUserId: ctx.userId,
          revocationReason: input.reason || null,
          updatedAt: new Date(),
        }).where(eq(membershipSubscriptions.id, sub.id));

        await tx.insert((await import("@rabbitty/database-core/schema")).auditEntries).values({
          userId: ctx.userId,
          action: "COURTESY_REVOKED",
          resource: "membership_subscriptions",
          resourceId: sub.id,
          details: input.reason || "Sin motivo especificado",
        }).catch(() => {});

        return { userId: sub.userId, businessName: biz?.name || "el negocio" };
      });

      try {
        await miniappClient.sendNotification({
          userId: result.userId,
          title: `Tu cortesía de ${result.businessName} fue revocada`,
          message: input.reason?.trim() ? `Motivo: ${input.reason}` : "La membresía de cortesía ya no está activa.",
          type: "SYSTEM",
          route: "/memberships",
        } as any);
      } catch { /* best-effort */ }

      return { success: true };
    }),

  /** Lista de cortesías del negocio (owner): estado, destinatario y consumo por beneficio. */
  listCourtesies: protectedProcedure
    .input(z.object({ businessId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertBusinessOwner(ctx, input.businessId);
      const rows = await ctx.coreDb.select({
        sub: membershipSubscriptions,
      }).from(membershipSubscriptions)
        .where(and(
          eq(membershipSubscriptions.businessId, input.businessId),
          eq(membershipSubscriptions.membershipOrigin, "COURTESY"),
        ))
        .orderBy(desc(membershipSubscriptions.createdAt))
        .limit(100);
      const out = [];
      for (const r of rows) {
        const [member] = await ctx.coreDb.select({ firstName: users.firstName, lastName: users.lastName, username: users.username })
          .from(users).where(eq(users.id, r.sub.userId)).limit(1);
        const ents = await ctx.coreDb.select().from(membershipEntitlements)
          .where(eq(membershipEntitlements.subscriptionId, r.sub.id));
        out.push({
          id: r.sub.id,
          memberName: [member?.firstName, member?.lastName].filter(Boolean).join(" ") || member?.username || "Miembro",
          memberUsername: member?.username ?? null,
          status: r.sub.status,
          noExpiration: r.sub.noExpiration,
          currentPeriodEnd: r.sub.currentPeriodEnd,
          giftNote: r.sub.giftNote,
          revokedAt: r.sub.revokedAt,
          revocationReason: r.sub.revocationReason,
          entitlements: ents.map((e: any) => ({ id: e.id, type: e.benefitType, quota: e.quotaPerCycle, used: e.currentUsageInCycle, cycleEnd: e.cycleEndDate })),
        });
      }
      return out;
    }),


  /** Negocios que administra el usuario autenticado. */
  myBusinesses: protectedProcedure.query(async ({ ctx }) => {
    const isGod = isGodAdminIdentity(ctx.user?.email, ctx.user?.name);
    if (isGod) {
      // God Admin: todos los negocios (gestión directa sin impersonación)
      return await ctx.coreDb
        .select({ id: ownedBusinesses.id, name: ownedBusinesses.name, isGod: sql<boolean>`true` })
        .from(ownedBusinesses)
        .orderBy(ownedBusinesses.name);
    }
    const mine = await ctx.coreDb
      .select({ id: ownedBusinesses.id, name: ownedBusinesses.name, isGod: sql<boolean>`false` })
      .from(ownedBusinesses)
      .where(eq(ownedBusinesses.ownerId, ctx.userId));
    if (mine.length > 0) return mine;
    // Staff/cajero sin ownership: el negocio de SU branch (venta en caja) — mismo criterio
    // que assertCanRedeem, para que el botón "Nuevo plan" funcione en el tenant del staff.
    if (ctx.branchId) {
      const [br] = await ctx.restaurantDb
        .select({ restaurantId: branches.restaurantId })
        .from(branches)
        .where(eq(branches.id, ctx.branchId))
        .limit(1);
      if (br?.restaurantId) {
        const [rest] = await ctx.restaurantDb
          .select({ businessId: restaurants.businessId })
          .from(restaurants)
          .where(eq(restaurants.id, br.restaurantId))
          .limit(1);
        if (rest?.businessId) {
          const [biz] = await ctx.coreDb
            .select({ id: ownedBusinesses.id, name: ownedBusinesses.name, isGod: sql<boolean>`false` })
            .from(ownedBusinesses)
            .where(eq(ownedBusinesses.id, rest.businessId))
            .limit(1);
          if (biz) return [biz];
        }
      }
    }
    return mine;
  }),

  /** Planes publicados de un negocio (versión vigente). */
  listPlans: protectedProcedure
    .input(z.object({ businessId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.coreDb
        .select({ plan: membershipPlans, version: membershipPlanVersions })
        .from(membershipPlans)
        .innerJoin(membershipPlanVersions, eq(membershipPlanVersions.id, membershipPlans.currentVersionId))
        .where(and(
          eq(membershipPlans.businessId, input.businessId),
          eq(membershipPlans.isActive, true),
          eq(membershipPlanVersions.isPublished, true),
        ));
      return rows;
    }),

  /** Admin: todos los planes (incluye borradores) con su versión actual. */
  listPlansAdmin: protectedProcedure
    .input(z.object({ businessId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertBusinessOwner(ctx, input.businessId);
      const plans = await ctx.coreDb
        .select()
        .from(membershipPlans)
        .where(eq(membershipPlans.businessId, input.businessId))
        .orderBy(desc(membershipPlans.createdAt));
      const result = [];
      for (const plan of plans) {
        const versions = await ctx.coreDb
          .select()
          .from(membershipPlanVersions)
          .where(eq(membershipPlanVersions.planId, plan.id))
          .orderBy(desc(membershipPlanVersions.versionNumber));
        const [countRow] = await ctx.coreDb
          .select({ count: sql<number>`count(*)::int` })
          .from(membershipSubscriptions)
          .innerJoin(membershipPlanVersions, eq(membershipPlanVersions.id, membershipSubscriptions.planVersionId))
          .where(and(eq(membershipPlanVersions.planId, plan.id), eq(membershipSubscriptions.status, "ACTIVE")));
        result.push({ plan, versions, activeMembers: countRow?.count ?? 0 });
      }
      return result;
    }),

  /** Admin: crea plan + versión 1 (borrador). */
  createPlan: protectedProcedure
    .input(z.object({
      businessId: z.string().uuid(),
      name: z.string().min(2).max(80),
      description: z.string().max(500).optional(),
      coverImageUrl: z.string().url().optional(),
      badgeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      priceFiat: z.number().min(0),
      currency: z.string().length(3).default("MXN"),
      billingInterval: intervalSchema,
      benefitRules: z.array(benefitRuleSchema).min(1),
      branchesAllowed: z.array(z.string()).default([]),
      maxMembersLimit: z.number().int().min(1).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertBusinessOwner(ctx, input.businessId);
      const slug = `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${randomBytes(2).toString("hex")}`;

      return await ctx.coreDb.transaction(async (tx: any) => {
        const [plan] = await tx.insert(membershipPlans).values({
          businessId: input.businessId,
          slug,
          name: input.name,
          description: input.description,
          coverImageUrl: input.coverImageUrl,
          badgeColor: input.badgeColor,
        }).returning();
        const [version] = await tx.insert(membershipPlanVersions).values({
          planId: plan.id,
          versionNumber: 1,
          priceFiat: input.priceFiat,
          currency: input.currency,
          billingInterval: input.billingInterval,
          benefitRules: input.benefitRules,
          branchesAllowed: input.branchesAllowed,
          maxMembersLimit: input.maxMembersLimit,
        }).returning();
        return { plan, version };
      });
    }),

  /** Admin: edita precio/beneficios → nueva versión (los miembros actuales no se afectan). */
  updatePlan: protectedProcedure
    .input(z.object({
      planId: z.string().uuid(),
      name: z.string().min(2).max(80).optional(),
      description: z.string().max(500).optional(),
      isActive: z.boolean().optional(),
      priceFiat: z.number().min(0),
      billingInterval: intervalSchema,
      benefitRules: z.array(benefitRuleSchema).min(1),
      branchesAllowed: z.array(z.string()).default([]),
      maxMembersLimit: z.number().int().min(1).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [plan] = await ctx.coreDb.select().from(membershipPlans).where(eq(membershipPlans.id, input.planId)).limit(1);
      if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Plan no encontrado" });
      await assertBusinessOwner(ctx, plan.businessId);

      const [last] = await ctx.coreDb
        .select({ n: membershipPlanVersions.versionNumber, currency: membershipPlanVersions.currency })
        .from(membershipPlanVersions)
        .where(eq(membershipPlanVersions.planId, plan.id))
        .orderBy(desc(membershipPlanVersions.versionNumber))
        .limit(1);

      const [version] = await ctx.coreDb.insert(membershipPlanVersions).values({
        planId: plan.id,
        versionNumber: (last?.n ?? 0) + 1,
        priceFiat: input.priceFiat,
        currency: last?.currency ?? "MXN",
        billingInterval: input.billingInterval,
        benefitRules: input.benefitRules,
        branchesAllowed: input.branchesAllowed,
        maxMembersLimit: input.maxMembersLimit,
      }).returning();

      await ctx.coreDb.update(membershipPlans).set({
        name: input.name ?? plan.name,
        description: input.description ?? plan.description,
        isActive: input.isActive ?? plan.isActive,
        updatedAt: new Date(),
      }).where(eq(membershipPlans.id, plan.id));

      return version;
    }),

  /** Admin: publica una versión y la marca como vigente del plan. */
  publishPlanVersion: protectedProcedure
    .input(z.object({ versionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.coreDb
        .select({ version: membershipPlanVersions, plan: membershipPlans })
        .from(membershipPlanVersions)
        .innerJoin(membershipPlans, eq(membershipPlans.id, membershipPlanVersions.planId))
        .where(eq(membershipPlanVersions.id, input.versionId))
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Versión no encontrada" });
      await assertBusinessOwner(ctx, row.plan.businessId);

      await ctx.coreDb.transaction(async (tx: any) => {
        await tx.update(membershipPlanVersions).set({ isPublished: true, updatedAt: new Date() })
          .where(eq(membershipPlanVersions.id, input.versionId));
        await tx.update(membershipPlans).set({ currentVersionId: input.versionId, updatedAt: new Date() })
          .where(eq(membershipPlans.id, row.plan.id));
      });

      // ── Notificar a los usuarios que guardaron el negocio (Madriguera) ──
      try {
        const [biz] = await ctx.coreDb.select({ name: ownedBusinesses.name })
          .from(ownedBusinesses).where(eq(ownedBusinesses.id, row.plan.businessId)).limit(1);
        const saveRows = await ctx.coreDb.execute(
          sql`SELECT DISTINCT "userId" FROM "business_interactions" WHERE "businessId" = ${row.plan.businessId} AND action = 'SAVE' AND "userId" IS NOT NULL LIMIT 100`
        ).then((r: unknown) => ((r as { rows?: Array<{ userId: string }> }).rows || (r as unknown as Array<{ userId: string }>)) as Array<{ userId: string }>);
        for (const s2 of saveRows) {
          try {
            await miniappClient.sendNotification({
              userId: s2.userId,
              title: `🎟️ Nuevo plan en ${biz?.name || 'tu negocio guardado'}`,
              message: `Publicaron la membresía "${row.plan.name}"${row.version.priceFiat ? ` ($${Number(row.version.priceFiat)} / ${row.version.billingInterval.toLowerCase()})` : ''}. Échale un ojo en su perfil.`,
              type: "AFFILIATE",
              route: `/affiliate/${row.plan.businessId}`,
            } as any);
          } catch { /* best-effort */ }
        }
      } catch (saveErr) {
        console.error("[memberships] notify saves falló:", saveErr);
      }

      return { success: true };
    }),

  /**
   * Suscribe al usuario autenticado. Fase 15.1: la confirmación de pago Stripe
   * se integrará aquí; por ahora solo se aceptan CASH_POS (validado en caja) y PROMO.
   */
  /**
   * Suscribe un usuario. Fase 15.1: CASH_POS (venta en caja) y PROMO.
   * - Sin targetUserId: suscribe al usuario autenticado (solo owner, alta propia).
   * - Con targetUserId: el owner/staff vende la membresía a un cliente escaneado en caja.
   * Todos los checks (duplicado + cupo) corren DENTRO de la tx con lock del plan (anti-carrera).
   */
  subscribe: protectedProcedure
    .input(z.object({
      planVersionId: z.string().uuid(),
      paymentProvider: z.enum(["CASH_POS", "PROMO"]),
      targetUserId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.coreDb
        .select({ version: membershipPlanVersions, plan: membershipPlans })
        .from(membershipPlanVersions)
        .innerJoin(membershipPlans, eq(membershipPlans.id, membershipPlanVersions.planId))
        .where(eq(membershipPlanVersions.id, input.planVersionId))
        .limit(1);
      if (!row || !row.version.isPublished || !row.plan.isActive || row.plan.currentVersionId !== row.version.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Plan no disponible" });
      }

      // Pagos fuera de línea / promo solo los autoriza el dueño del negocio.
      await assertBusinessOwner(ctx, row.plan.businessId);
      const targetUserId = input.targetUserId ?? ctx.userId;

      const now = new Date();
      const periodEnd = addInterval(now, row.version.billingInterval as z.infer<typeof intervalSchema>);
      const rules = row.version.benefitRules as z.infer<typeof benefitRuleSchema>[];

      return await ctx.coreDb.transaction(async (tx: any) => {
        // Lock del plan: serializa suscripciones concurrentes del mismo plan
        await tx.select().from(membershipPlans).where(eq(membershipPlans.id, row.plan.id)).for("update");

        const [existing] = await tx
          .select({ id: membershipSubscriptions.id })
          .from(membershipSubscriptions)
          .innerJoin(membershipPlanVersions, eq(membershipPlanVersions.id, membershipSubscriptions.planVersionId))
          .where(and(
            eq(membershipSubscriptions.userId, targetUserId),
            eq(membershipPlanVersions.planId, row.plan.id),
            eq(membershipSubscriptions.status, "ACTIVE"),
          ))
          .limit(1);
        if (existing) throw new TRPCError({ code: "CONFLICT", message: "Ya tiene esta membresía activa" });

        if (row.version.maxMembersLimit) {
          const [countRow] = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(membershipSubscriptions)
            .innerJoin(membershipPlanVersions, eq(membershipPlanVersions.id, membershipSubscriptions.planVersionId))
            .where(and(eq(membershipPlanVersions.planId, row.plan.id), eq(membershipSubscriptions.status, "ACTIVE")));
          if ((countRow?.count ?? 0) >= row.version.maxMembersLimit) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Cupo de miembros agotado" });
          }
        }

        // Validar que el target exista (venta en caja)
        if (targetUserId !== ctx.userId) {
          const [tgt] = await tx.select({ id: users.id }).from(users).where(eq(users.id, targetUserId)).limit(1);
          if (!tgt) throw new TRPCError({ code: "BAD_REQUEST", message: "Cliente no encontrado" });
        }

        const [sub] = await tx.insert(membershipSubscriptions).values({
          userId: targetUserId,
          businessId: row.plan.businessId,
          planVersionId: row.version.id,
          status: "ACTIVE",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          paymentProvider: input.paymentProvider,
          membershipOrigin: "PURCHASED",
          qrPassSecret: randomBytes(32).toString("hex"),
        }).returning();
        await tx.insert(membershipEntitlements).values(buildEntitlementRows(sub.id, rules, now, periodEnd));

        // Notificar al cliente (venta en caja / promo) — vía el canal S2S de la miniapp
        if (targetUserId !== ctx.userId) {
          try {
            await miniappClient.sendNotification({
              userId: targetUserId,
              title: "🎟️ ¡Membresía activada!",
              message: `El negocio activó tu membresía "${row.plan.name}". Ya puedes mostrarla en caja con su QR dorado.`,
              type: "REWARD",
              route: "/memberships",
            } as any);
          } catch (notifyErr) {
            console.error("[memberships] notificación al cliente falló:", notifyErr);
          }
        }
        return { subscriptionId: sub.id };
      });
    }),

  /** businessId del tenant actual (owner o staff) — el escáner del POS lo consulta antes de canjear. */
  myBusinessForContext: protectedProcedure.query(async ({ ctx }) => {
    return { businessId: await resolveBusinessForBranch(ctx) };
  }),

  /** Membresías del usuario con estado de derechos del ciclo actual. */
  getMyMemberships: protectedProcedure.query(async ({ ctx }) => {
    const subs = await ctx.coreDb
      .select({ sub: membershipSubscriptions, version: membershipPlanVersions, plan: membershipPlans })
      .from(membershipSubscriptions)
      .innerJoin(membershipPlanVersions, eq(membershipPlanVersions.id, membershipSubscriptions.planVersionId))
      .innerJoin(membershipPlans, eq(membershipPlans.id, membershipPlanVersions.planId))
      .where(eq(membershipSubscriptions.userId, ctx.userId))
      .orderBy(desc(membershipSubscriptions.createdAt));

    const out = [];
    for (const s of subs) {
      const entitlements = await ctx.coreDb
        .select()
        .from(membershipEntitlements)
        .where(eq(membershipEntitlements.subscriptionId, s.sub.id));
      const { qrPassSecret: _omit, ...safeSub } = s.sub;
      out.push({ subscription: safeSub, plan: s.plan, version: s.version, entitlements });
    }
    return out;
  }),

  /** Token QR dinámico (rota cada 30s) del Membership Pass. */
  getMembershipPass: protectedProcedure
    .input(z.object({ subscriptionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [sub] = await ctx.coreDb
        .select()
        .from(membershipSubscriptions)
        .where(and(eq(membershipSubscriptions.id, input.subscriptionId), eq(membershipSubscriptions.userId, ctx.userId)))
        .limit(1);
      if (!sub) throw new TRPCError({ code: "NOT_FOUND", message: "Membresía no encontrada" });
      if (sub.status !== "ACTIVE") throw new TRPCError({ code: "BAD_REQUEST", message: "Membresía no vigente" });
      if (!sub.noExpiration && (!sub.currentPeriodEnd || sub.currentPeriodEnd < new Date())) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Membresía no vigente (periodo vencido)" });
      }
      return {
        qrToken: buildQrToken(sub.id, sub.qrPassSecret),
        expiresInSeconds: QR_WINDOW_SECONDS - (Math.floor(Date.now() / 1000) % QR_WINDOW_SECONDS),
        status: sub.status,
      };
    }),

  /**
   * POS: valida el QR y consume un derecho de forma atómica e idempotente.
   * El UPDATE condicional impide exceder la cuota aun con escaneos concurrentes.
   */
  redeemAtPOS: protectedProcedure
    .input(z.object({
      businessId: z.string().uuid(),
      qrToken: z.string().min(10),
      branchId: z.string().min(1),
      entitlementId: z.string().uuid().optional(),
      orderId: z.string().optional(),
      quantity: z.number().int().min(1).max(10).default(1),
      idempotencyKey: z.string().min(8).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertCanRedeem(ctx, input.businessId);

      const [subId, windowStr, mac] = input.qrToken.split(".");
      const window = Number(windowStr);
      if (!subId || !mac || !Number.isInteger(window)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "QR inválido" });
      }
      const nowWindow = Math.floor(Date.now() / 1000 / QR_WINDOW_SECONDS);
      if (Math.abs(nowWindow - window) > 1) throw new TRPCError({ code: "BAD_REQUEST", message: "QR expirado" });

      const [sub] = await ctx.coreDb
        .select()
        .from(membershipSubscriptions)
        .where(and(eq(membershipSubscriptions.id, subId), eq(membershipSubscriptions.businessId, input.businessId)))
        .limit(1);
      if (!sub) throw new TRPCError({ code: "NOT_FOUND", message: "Membresía no encontrada" });

      const expected = Buffer.from(signQr(sub.id, sub.qrPassSecret, window));
      const given = Buffer.from(mac);
      if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "QR inválido" });
      }
      if (sub.status !== "ACTIVE") throw new TRPCError({ code: "BAD_REQUEST", message: "Membresía no vigente" });
      if (!sub.noExpiration && (!sub.currentPeriodEnd || sub.currentPeriodEnd < new Date())) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Membresía no vigente (periodo vencido)" });
      }

return await ctx.coreDb.transaction(async (tx: any) => {
        // Idempotencia: si ya se procesó, devolver el resultado previo.
        const [prev] = await tx.select().from(entitlementUsages)
          .where(eq(entitlementUsages.idempotencyKey, input.idempotencyKey)).limit(1);
        if (prev) return { success: true, duplicate: true, usageId: prev.id, remaining: 0, memberName: null };

        const now = new Date();
        // Candidatos: el beneficio indicado, o (escáner POS) todos los del ciclo con cuota.
        const candidates = input.entitlementId
          ? await tx.select().from(membershipEntitlements)
              .where(and(eq(membershipEntitlements.id, input.entitlementId), eq(membershipEntitlements.subscriptionId, sub.id)))
              .limit(1)
          : await tx.select().from(membershipEntitlements)
              .where(eq(membershipEntitlements.subscriptionId, sub.id))
              .orderBy(membershipEntitlements.cycleEndDate);

        let updated: (typeof candidates)[number] | null = null;
        // Límite para ciclos: el fin del periodo pagado (o lejano en indefinidas — revocables)
        const cycleHardEnd = (sub as any).noExpiration
          ? (() => { const d = new Date(now); d.setFullYear(d.getFullYear() + 99); return d; })()
          : ((sub as any).currentPeriodEnd ?? now);
        for (const ent of candidates) {
          // Rolar ciclo vencido (diario/semanal/mensual) antes de consumir.
          if (ent.cycleEndDate <= now && ent.cycleResetType !== "FIXED" && ent.cycleEndDate < cycleHardEnd) {
            await tx.update(membershipEntitlements).set({
              currentUsageInCycle: 0,
              cycleStartDate: now,
              cycleEndDate: addCycle(now, ent.cycleResetType, cycleHardEnd),
              updatedAt: now,
            }).where(and(eq(membershipEntitlements.id, ent.id), lt(membershipEntitlements.cycleEndDate, now)));
          }

          // Consumo condicional atómico (impide exceder la cuota con escaneos concurrentes).
          const rows = await tx.update(membershipEntitlements).set({
            currentUsageInCycle: sql`${membershipEntitlements.currentUsageInCycle} + ${input.quantity}`,
            updatedAt: now,
          }).where(and(
            eq(membershipEntitlements.id, ent.id),
            gt(membershipEntitlements.cycleEndDate, now),
            sql`${membershipEntitlements.currentUsageInCycle} + ${input.quantity} <= ${membershipEntitlements.quotaPerCycle}`,
          )).returning();
          if (rows.length > 0) { updated = rows[0]; break; }
        }
        if (!updated) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Sin usos disponibles en este ciclo" });
        }

        let usageId = "";
        const [usage] = await tx.insert(entitlementUsages).values({
          entitlementId: updated.id,
          subscriptionId: sub.id,
          branchId: input.branchId,
          staffId: ctx.userId,
          orderId: input.orderId,
          quantityUsed: input.quantity,
          idempotencyKey: input.idempotencyKey,
        }).onConflictDoNothing({ target: entitlementUsages.idempotencyKey }).returning();
        if (usage) {
          usageId = usage.id;
        } else {
          // Carrera de idempotencia: otro escaneo ganó la UNIQUE → devolver duplicado (no 500)
          const [winner] = await tx.select().from(entitlementUsages)
            .where(eq(entitlementUsages.idempotencyKey, input.idempotencyKey)).limit(1);
          if (winner) {
            const [wEnt] = await tx.select().from(membershipEntitlements)
              .where(eq(membershipEntitlements.id, winner.entitlementId)).limit(1);
            const [memberDup] = await tx.select({ firstName: users.firstName, lastName: users.lastName, username: users.username })
              .from(users).where(eq(users.id, sub.userId)).limit(1);
            return {
              success: true,
              duplicate: true,
              usageId: winner.id,
              remaining: Math.max(0, (wEnt?.quotaPerCycle ?? 0) - (wEnt?.currentUsageInCycle ?? 0)),
              memberName: [memberDup?.firstName, memberDup?.lastName].filter(Boolean).join(" ") || memberDup?.username || "Miembro",
            };
          }
          return { success: true, duplicate: true, usageId: "", remaining: 0, memberName: null };
        }

        // Nombre del miembro para la confirmación del cajero
        const [member] = await tx.select({ firstName: users.firstName, lastName: users.lastName, username: users.username })
          .from(users).where(eq(users.id, sub.userId)).limit(1);

        // Bidireccional: avisa al dueño cuando canjean su cortesía
        if (sub.membershipOrigin === "COURTESY") {
          const memberName2 = [member?.firstName, member?.lastName].filter(Boolean).join(" ") || member?.username || "alguien";
          const benefitLabels: Record<string, string> = {
            INCLUDED_PRODUCT: "producto incluido", DISCOUNT_PCT: "descuento",
            CREDIT_BALANCE: "saldo", EVENT_ACCESS: "acceso", BULK_PACK: "paquete",
          };
          try {
            const { miniappClient: mac2 } = await import("../services/miniapp-client");
            await mac2.sendNotification({
              userId: sub.issuedByUserId || sub.userId,
              title: "🎁 Canje de cortesía",
              message: `${memberName2} canjeó su ${benefitLabels[updated.benefitType] || "beneficio"} — le quedan ${updated.quotaPerCycle - updated.currentUsageInCycle} de este ciclo.`,
              type: "AFFILIATE",
              route: "/memberships",
            } as any);
          } catch { /* best-effort */ }
        }

        return {
          success: true,
          duplicate: false,
          usageId,
          remaining: updated.quotaPerCycle - updated.currentUsageInCycle,
          memberName: [member?.firstName, member?.lastName].filter(Boolean).join(" ") || member?.username || "Miembro",
          benefitType: updated.benefitType,
        };
      });
    }),

  /** Admin: lista de miembros del negocio con estado. */
  listMembers: protectedProcedure
    .input(z.object({ businessId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertBusinessOwner(ctx, input.businessId);
      const rows = await ctx.coreDb
        .select({
          id: membershipSubscriptions.id,
          userId: membershipSubscriptions.userId,
          status: membershipSubscriptions.status,
          currentPeriodEnd: membershipSubscriptions.currentPeriodEnd,
          cancelAtPeriodEnd: membershipSubscriptions.cancelAtPeriodEnd,
          paymentProvider: membershipSubscriptions.paymentProvider,
          planName: membershipPlans.name,
        })
        .from(membershipSubscriptions)
        .innerJoin(membershipPlanVersions, eq(membershipPlanVersions.id, membershipSubscriptions.planVersionId))
        .innerJoin(membershipPlans, eq(membershipPlans.id, membershipPlanVersions.planId))
        .where(eq(membershipSubscriptions.businessId, input.businessId))
        .orderBy(desc(membershipSubscriptions.createdAt));
      return rows;
    }),

  /** Usuario: cancela al final del periodo (conserva beneficios hasta entonces). */
  cancelSubscription: protectedProcedure
    .input(z.object({ subscriptionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const res = await ctx.coreDb.update(membershipSubscriptions)
        .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
        .where(and(eq(membershipSubscriptions.id, input.subscriptionId), eq(membershipSubscriptions.userId, ctx.userId)))
        .returning({ id: membershipSubscriptions.id });
      if (res.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Membresía no encontrada" });
      return { success: true };
    }),
});
