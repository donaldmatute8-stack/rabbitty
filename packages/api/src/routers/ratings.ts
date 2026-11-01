import { z } from "zod";
import { and, eq, gte, inArray, sql, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, godAdminProcedure } from "../trpc";
import {
  orders,
  payments,
  branches,
  orderRatings,
  orderRatingEvents,
  moderationLog,
  merchantScoreShadow,
} from "@rabbitty/database-restaurant/schema";

/**
 * ── RABBITTY SCORE · Fase 1 ── Rating post-pago + Merchant Service Score shadow.
 * Ver Docs/RABBITTY-SCORE-PLAN.md. Reglas:
 * - 1 rating por orden (UNIQUE orderId), autorizado server-side por dueño de la orden.
 * - Elegible solo si la orden está COMPLETED/PAID **y** tiene payment COMPLETED.
 * - Comercio ve agregados + comentarios SIN identidad. Identidad solo God.
 * - Nada aquí toca pagos, ledger Bunz, inventario ni cierre de mesa.
 */

const ATTRIBUTES = ["atencion", "comida", "tiempo", "ambiente"] as const;
const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const PUBLIC_MIN_SAMPLE = 5;
const PRIOR_MEAN = 3.0; // no informativo hasta calibración (§5.3 del doc)
const PRIOR_WEIGHT = 4;
const RECENCY_HALF_LIFE_DAYS = 90;

/** Guard: staff de la branch, owner del negocio, o God. */
async function assertBranchAccess(ctx: any, branchId: string): Promise<void> {
  const { isGodAdminIdentity } = await import("../services/god2fa");
  if (isGodAdminIdentity(ctx.user?.email, ctx.user?.name)) return;
  const { staff, branches: b } = await import("@rabbitty/database-restaurant/schema");
  const staffRows = await ctx.restaurantDb
    .select({ branchId: staff.branchId })
    .from(staff)
    .where(eq(staff.userId, ctx.userId));
  if (staffRows.some((s: { branchId: string | null }) => s.branchId === branchId)) return;
  // Owner del negocio dueño del restaurante de la branch
  const [br] = await ctx.restaurantDb
    .select({ restaurantId: b.restaurantId })
    .from(b)
    .where(eq(b.id, branchId))
    .limit(1);
  if (!br?.restaurantId) throw new TRPCError({ code: "FORBIDDEN", message: "Sin acceso a esta sucursal" });
  const { restaurants, ownedBusinesses } = await import("@rabbitty/database-core/schema").then(async (mod) => ({
    restaurants: (await import("@rabbitty/database-restaurant/schema")).restaurants,
    ownedBusinesses: mod.ownedBusinesses,
  }));
  const [rest] = await ctx.restaurantDb
    .select({ businessId: restaurants.businessId })
    .from(restaurants)
    .where(eq(restaurants.id, br.restaurantId))
    .limit(1);
  if (rest?.businessId) {
    const [owned] = await ctx.coreDb
      .select({ id: ownedBusinesses.id })
      .from(ownedBusinesses)
      .where(and(eq(ownedBusinesses.id, rest.businessId), eq(ownedBusinesses.ownerId, ctx.userId ?? "")))
      .limit(1);
    if (owned) return;
  }
  throw new TRPCError({ code: "FORBIDDEN", message: "Sin acceso a esta sucursal" });
}

/**
 * ── Exclusión INMEDIATA del rating cuando la orden deja de ser elegible ──
 * Se llama en TODAS las transiciones a no-elegible (VOID, VOIDED, EXPIRED,
 * cancelaciones). El job nocturno solo reconcilia deriva.
 */
export async function invalidateOrderRating(db: any, orderId: string, reason: string): Promise<void> {
  try {
    const rows = await db
      .update(orderRatings)
      .set({ isEligible: false, ineligibleReason: reason, updatedAt: new Date() })
      .where(and(eq(orderRatings.orderId, orderId), eq(orderRatings.isEligible, true)))
      .returning({ id: orderRatings.id });
    for (const r of rows) {
      await db.insert(orderRatingEvents).values({
        ratingId: r.id,
        eventType: "VOIDED",
        actorRole: "SYSTEM",
        reason,
      });
    }
  } catch (err) {
    console.warn("[ratings] invalidación falló (no fatal):", err);
  }
}

export const ratingsRouter = router({
  /** Elegibilidad de la orden para el prompt (la app consulta antes de mostrarlo). */
  isOrderRateable: protectedProcedure
    .input(z.object({ orderId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [order] = await ctx.restaurantDb
        .select({ id: orders.id, branchId: orders.branchId, customerId: orders.customerId, status: orders.status })
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1);
      if (!order) return { rateable: false, reason: "NOT_FOUND" as const };
      if (order.customerId !== ctx.userId) return { rateable: false, reason: "NOT_YOURS" as const };
      const paidNow = order.status === "COMPLETED" || order.status === "PAID";
      if (!paidNow) return { rateable: false, reason: "NOT_PAID" as const };
      const [pay] = await ctx.restaurantDb
        .select({ id: payments.id })
        .from(payments)
        .where(and(eq(payments.orderId, order.id), eq(payments.status, "COMPLETED")))
        .limit(1);
      if (!pay) return { rateable: false, reason: "NOT_PAID" as const };
      const [existing] = await ctx.restaurantDb
        .select({ id: orderRatings.id })
        .from(orderRatings)
        .where(eq(orderRatings.orderId, order.id))
        .limit(1);
      return { rateable: true, reason: null, alreadyRated: Boolean(existing) };
    }),

  /** Enviar (o editar dentro de 24h) el rating. 1 por orden, autorizado por dueño. */
  submitRating: protectedProcedure
    .input(z.object({
      orderId: z.string(),
      stars: z.number().int().min(1).max(5),
      attributes: z.array(z.enum(ATTRIBUTES)).max(4).optional(),
      comment: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [order] = await ctx.restaurantDb
        .select({ id: orders.id, branchId: orders.branchId, customerId: orders.customerId, status: orders.status })
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Orden no encontrada" });
      // Autorización sin filtrar datos de órdenes ajenas
      if (order.customerId !== ctx.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No puedes evaluar esta orden" });
      }
      if (order.status !== "COMPLETED" && order.status !== "PAID") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "La orden aún no está liquidada" });
      }
      const [pay] = await ctx.restaurantDb
        .select({ id: payments.id })
        .from(payments)
        .where(and(eq(payments.orderId, order.id), eq(payments.status, "COMPLETED")))
        .limit(1);
      if (!pay) throw new TRPCError({ code: "BAD_REQUEST", message: "La orden aún no está liquidada" });

      const comment = input.comment?.trim() || null;

      // Duplicado EXACTO verificable → PENDING_REVIEW (única regla de ocultamiento
      // automático permitida; correlación multi-cuenta solo marca REVIEW_FLAG).
      let moderationStatus: "VISIBLE" | "PENDING_REVIEW" = "VISIBLE";
      if (comment) {
        const since = new Date(Date.now() - 72 * 3600 * 1000);
        const [dupRow] = await ctx.restaurantDb
          .select({ n: sql<number>`count(*)::int` })
          .from(orderRatings)
          .where(and(
            eq(orderRatings.customerUserId, ctx.userId ?? ""),
            eq(orderRatings.branchId, order.branchId),
            eq(orderRatings.comment, comment),
            gte(orderRatings.createdAt, since)
          ));
        if (Number(dupRow?.n ?? 0) >= 3) moderationStatus = "PENDING_REVIEW";
      }

      const [existing] = await ctx.restaurantDb
        .select()
        .from(orderRatings)
        .where(eq(orderRatings.orderId, order.id))
        .limit(1);

      if (existing) {
        if (existing.customerUserId !== ctx.userId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "No puedes editar esta evaluación" });
        }
        if (!existing.isEligible) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "La orden dejó de ser elegible" });
        }
        const age = Date.now() - new Date(existing.createdAt ?? existing.updatedAt ?? 0).getTime();
        if (age > EDIT_WINDOW_MS) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "La ventana de edición (24h) ya cerró" });
        }
        await ctx.restaurantDb
          .update(orderRatings)
          .set({
            stars: input.stars,
            attributes: input.attributes ?? existing.attributes,
            comment,
            moderationStatus,
            editedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(orderRatings.id, existing.id));
        await ctx.restaurantDb.insert(orderRatingEvents).values({
          ratingId: existing.id,
          eventType: "EDITED",
          actorUserId: ctx.userId,
          actorRole: "AUTHOR",
          previousStars: existing.stars,
          newStars: input.stars,
          previousComment: existing.comment,
          newComment: comment,
        });
        return { success: true, ratingId: existing.id, edited: true };
      }

      const [created] = await ctx.restaurantDb
        .insert(orderRatings)
        .values({
          orderId: order.id,
          branchId: order.branchId,
          customerUserId: ctx.userId ?? "",
          stars: input.stars,
          attributes: input.attributes ?? null,
          comment,
          moderationStatus,
        })
        .onConflictDoNothing({ target: orderRatings.orderId })
        .returning();

      // Doble submit: si el UNIQUE bloqueó, devolver el existente idempotente
      if (!created) {
        const [dup] = await ctx.restaurantDb
          .select({ id: orderRatings.id })
          .from(orderRatings)
          .where(eq(orderRatings.orderId, order.id))
          .limit(1);
        return { success: true, ratingId: dup?.id ?? null, edited: false, duplicate: true };
      }

      await ctx.restaurantDb.insert(orderRatingEvents).values({
        ratingId: created.id,
        eventType: "CREATED",
        actorUserId: ctx.userId,
        actorRole: "AUTHOR",
        newStars: input.stars,
        newComment: comment,
      });

      return { success: true, ratingId: created.id, edited: false };
    }),

  /** Reportar un comentario (comercio). → PENDING_REVIEW (fuera de agregados) + auditoría. */
  reportRating: protectedProcedure
    .input(z.object({ ratingId: z.string(), reason: z.string().min(5).max(300) }))
    .mutation(async ({ ctx, input }) => {
      const [rating] = await ctx.restaurantDb
        .select()
        .from(orderRatings)
        .where(eq(orderRatings.id, input.ratingId))
        .limit(1);
      if (!rating) throw new TRPCError({ code: "NOT_FOUND", message: "Evaluación no encontrada" });
      await assertBranchAccess(ctx, rating.branchId);
      const prev = rating.moderationStatus;
      await ctx.restaurantDb
        .update(orderRatings)
        .set({
          moderationStatus: "PENDING_REVIEW",
          reportedAt: new Date(),
          reportedBy: ctx.userId,
          reportReason: input.reason,
          updatedAt: new Date(),
        })
        .where(eq(orderRatings.id, rating.id));
      await ctx.restaurantDb.insert(orderRatingEvents).values({
        ratingId: rating.id,
        eventType: "REPORTED",
        actorUserId: ctx.userId,
        actorRole: "STAFF",
        reason: input.reason,
      });
      await ctx.restaurantDb.insert(moderationLog).values({
        entityType: "ORDER_RATING",
        entityId: rating.id,
        action: "REPORTED",
        actorUserId: ctx.userId ?? "",
        reason: input.reason,
        previousState: prev,
        newState: "PENDING_REVIEW",
      });
      return { success: true };
    }),

  /**
   * Superficie Affiliate: agregados + comentarios SIN IDENTIDAD del autor.
   * No devuelve userId, nombre, teléfono ni score interno.
   */
  merchantRatingSummary: protectedProcedure
    .input(z.object({ branchId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertBranchAccess(ctx, input.branchId);
      const eligibleBase = and(
        eq(orderRatings.branchId, input.branchId),
        eq(orderRatings.isEligible, true)
      );

      const [agg] = await ctx.restaurantDb
        .select({
          n: sql<number>`COUNT(*) FILTER (WHERE ${orderRatings.moderationStatus} <> 'PENDING_REVIEW')`,
          avgStars: sql<number>`COALESCE(AVG(${orderRatings.stars}) FILTER (WHERE ${orderRatings.moderationStatus} <> 'PENDING_REVIEW'), 0)`,
          pendingReview: sql<number>`COUNT(*) FILTER (WHERE ${orderRatings.moderationStatus} = 'PENDING_REVIEW')`,
        })
        .from(orderRatings)
        .where(eligibleBase);

      // Cobertura de feedback (contexto de muestra — NO es satisfacción)
      const covRes: any = await ctx.restaurantDb.execute(sql`
        SELECT
          (SELECT COUNT(*)::int FROM "order_ratings" r WHERE r."branchId" = ${input.branchId} AND r."isEligible" = true) AS rated,
          (SELECT COUNT(*)::int FROM "orders" o
             JOIN "payments" p ON p."orderId" = o.id AND p.status = 'COMPLETED'
             WHERE o."branchId" = ${input.branchId}
               AND o.status IN ('COMPLETED','PAID')
               AND o."createdAt" >= now() - interval '90 days') AS eligible
      `);
      const covRows = covRes?.rows ?? covRes;
      const covRow = Array.isArray(covRows) ? covRows[0] : covRows;

      const comments = await ctx.restaurantDb
        .select({
          id: orderRatings.id,
          stars: orderRatings.stars,
          attributes: orderRatings.attributes,
          comment: orderRatings.comment,
          moderationStatus: orderRatings.moderationStatus,
          createdAt: orderRatings.createdAt,
        })
        .from(orderRatings)
        .where(and(eligibleBase, sql`${orderRatings.comment} IS NOT NULL`))
        .orderBy(desc(orderRatings.createdAt))
        .limit(30);

      const n = Number(agg?.n ?? 0);
      const rated = Number(covRow?.rated ?? 0);
      const eligible = Number(covRow?.eligible ?? 0);

      return {
        // Público solo con muestra suficiente; si no, estado "reuniendo opiniones"
        sampleSufficient: n >= PUBLIC_MIN_SAMPLE,
        n,
        avgStars: n > 0 ? Math.round(Number(agg?.avgStars ?? 0) * 10) / 10 : null,
        pendingReview: Number(agg?.pendingReview ?? 0),
        // Cobertura de opiniones (NO satisfacción)
        coverage: { rated, eligible, pct: eligible > 0 ? Math.round((rated / eligible) * 100) : 0 },
        comments: comments.map((c) => ({
          id: c.id,
          stars: c.stars,
          attributes: c.attributes,
          comment: c.comment,
          visible: c.moderationStatus !== "PENDING_REVIEW" && c.moderationStatus !== "HIDDEN",
          createdAt: c.createdAt,
          // SIN identidad del autor — por diseño (§D del doc)
        })),
      };
    }),

  /** God: moderación con motivo obligatorio + auditoría completa. */
  moderateRating: godAdminProcedure
    .input(z.object({
      ratingId: z.string(),
      action: z.enum(["HIDE", "RESTORE"]),
      reason: z.string().min(5).max(300),
    }))
    .mutation(async ({ ctx, input }) => {
      const [rating] = await ctx.restaurantDb
        .select()
        .from(orderRatings)
        .where(eq(orderRatings.id, input.ratingId))
        .limit(1);
      if (!rating) throw new TRPCError({ code: "NOT_FOUND", message: "Evaluación no encontrada" });
      const newState = input.action === "HIDE" ? "HIDDEN" : "VISIBLE";
      await ctx.restaurantDb
        .update(orderRatings)
        .set({ moderationStatus: newState, updatedAt: new Date() })
        .where(eq(orderRatings.id, rating.id));
      await ctx.restaurantDb.insert(orderRatingEvents).values({
        ratingId: rating.id,
        eventType: input.action === "HIDE" ? "MODERATED_HIDDEN" : "RESTORED",
        actorUserId: ctx.userId,
        actorRole: "GOD",
        reason: input.reason,
      });
      await ctx.restaurantDb.insert(moderationLog).values({
        entityType: "ORDER_RATING",
        entityId: rating.id,
        action: input.action === "HIDE" ? "HIDDEN" : "RESTORED",
        actorUserId: ctx.userId ?? "",
        reason: input.reason,
        previousState: rating.moderationStatus,
        newState,
      });
      return { success: true, newState };
    }),

  /** God: cola de moderación (incluye review flags y pendientes) + historial. */
  moderationQueue: godAdminProcedure
    .input(z.object({ branchId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.restaurantDb
        .select()
        .from(orderRatings)
        .where(input.branchId
          ? and(eq(orderRatings.branchId, input.branchId), inArray(orderRatings.moderationStatus, ["PENDING_REVIEW", "HIDDEN"]))
          : inArray(orderRatings.moderationStatus, ["PENDING_REVIEW", "HIDDEN"]))
        .orderBy(desc(orderRatings.updatedAt))
        .limit(100);
      const log = await ctx.restaurantDb
        .select()
        .from(moderationLog)
        .orderBy(desc(moderationLog.createdAt))
        .limit(50);
      return {
        queue: rows.map((r) => ({
          id: r.id,
          branchId: r.branchId,
          stars: r.stars,
          comment: r.comment,
          moderationStatus: r.moderationStatus,
          reportReason: r.reportReason,
          reportedAt: r.reportedAt,
          reviewFlag: r.reviewFlag,
          createdAt: r.createdAt,
          // Identidad del autor: SOLO God (§D) — causa documentada al moderar
          customerUserId: r.customerUserId,
        })),
        log,
      };
    }),

  /**
   * God: Merchant Service Score en SHADOW (E4). Bayesiano con recencia y
   * cobertura. NO se usa para nada operativo; se persiste snapshot para
   * medición de poder predictivo.
   */
  merchantScoreShadow: godAdminProcedure
    .input(z.object({ branchId: z.string(), persist: z.boolean().default(false) }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.restaurantDb
        .select({
          stars: orderRatings.stars,
          createdAt: orderRatings.createdAt,
        })
        .from(orderRatings)
        .where(and(eq(orderRatings.branchId, input.branchId), eq(orderRatings.isEligible, true), sql`${orderRatings.moderationStatus} <> 'PENDING_REVIEW'`));

      let weightedSum = 0;
      let weightTotal = 0;
      for (const r of rows) {
        const ageDays = Math.max(0, (Date.now() - new Date(r.createdAt ?? Date.now()).getTime()) / 86400000);
        const w = Math.pow(0.5, ageDays / RECENCY_HALF_LIFE_DAYS);
        weightedSum += Number(r.stars) * w;
        weightTotal += w;
      }
      const recencyMean = weightTotal > 0 ? weightedSum / weightTotal : 0;
      const n = rows.length;
      const score = n > 0
        ? (recencyMean * n + PRIOR_MEAN * PRIOR_WEIGHT) / (n + PRIOR_WEIGHT)
        : PRIOR_MEAN;

      const covRes2: any = await ctx.restaurantDb.execute(sql`
        SELECT
          (SELECT COUNT(*)::int FROM "orders" o JOIN "payments" p ON p."orderId" = o.id AND p.status='COMPLETED'
             WHERE o."branchId" = ${input.branchId} AND o.status IN ('COMPLETED','PAID')
               AND o."createdAt" >= now() - interval '90 days') AS eligible
      `);
      const covRows2 = covRes2?.rows ?? covRes2;
      const covRow2 = Array.isArray(covRows2) ? covRows2[0] : covRows2;
      const eligible = Number(covRow2?.eligible ?? 0);
      const coverage = eligible > 0 ? Math.min(1, n / eligible) : 0;

      const result = {
        branchId: input.branchId,
        score: Math.round(score * 100) / 100,
        sampleN: n,
        coverage: Math.round(coverage * 1000) / 1000,
        components: {
          recencyMean: Math.round(recencyMean * 100) / 100,
          priorMean: PRIOR_MEAN,
          priorWeight: PRIOR_WEIGHT,
          recencyHalfLifeDays: RECENCY_HALF_LIFE_DAYS,
          method: "bayesian_shrinkage_with_recency",
        },
      };

      if (input.persist) {
        await ctx.restaurantDb.insert(merchantScoreShadow).values({
          branchId: input.branchId,
          score: result.score,
          sampleN: result.sampleN,
          coverage: result.coverage,
          components: result.components,
        });
      }
      return result;
    }),
});
