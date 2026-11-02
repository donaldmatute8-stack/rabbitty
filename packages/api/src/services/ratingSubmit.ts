/**
 * ── ratingSubmit ── Núcleo de submit/edit de evaluaciones (F1 Rabbitty Score).
 * Motor compartido por DOS canales:
 *  1. tRPC `ratings.submitRating` (web /pay — ctx.userId del admin).
 *  2. HTTP interno `/api/internal/rating` (admin app, secret compartido) que
 *     alimenta el canal nativo/miniapp vía `/api/pay/rate`.
 * Ambos validan dueño de orden, estado liquidado y el ciclo completo de
 * idempotencia (UNIQUE orderId), ventana de edición 24h y moderación de
 * duplicado exacto. Reglas puras viven en ratingRules.ts — aquí solo orquesta.
 */

import { and, eq, gte, sql } from "drizzle-orm";
import {
  orders,
  payments,
  orderRatings,
  orderRatingEvents,
} from "@rabbitty/database-restaurant/schema";

import {
  isOrderEligibleForRating,
  canEditRating,
  resolveModerationStatus,
  DUPLICATE_WINDOW_HOURS,
} from "./ratingRules";

export interface SubmitRatingInput {
  orderId: string;
  stars: number;
  attributes?: Array<"atencion" | "comida" | "tiempo" | "ambiente"> | null;
  comment?: string | null;
  /** Id del comensal (core user) — DEBE estar autenticado por el canal que invoca. */
  actorUserId: string;
}

export type SubmitRatingFailure = {
  ok: false;
  code: "NOT_FOUND" | "FORBIDDEN" | "NOT_LIQUID" | "WINDOW_CLOSED";
  message: string;
};

export type SubmitRatingSuccess = {
  ok: true;
  ratingId: string | null;
  edited: boolean;
  duplicate?: boolean;
};

/** db del schema restaurante (drizzle instance) — el canal autentica, aquí se ejecutan las reglas. */
export async function submitRatingForOrder(
  restaurantDb: any,
  input: SubmitRatingInput,
): Promise<SubmitRatingSuccess | SubmitRatingFailure> {
  const [order] = await restaurantDb
    .select({ id: orders.id, branchId: orders.branchId, customerId: orders.customerId, status: orders.status })
    .from(orders)
    .where(eq(orders.id, input.orderId))
    .limit(1);
  if (!order) return { ok: false, code: "NOT_FOUND", message: "Orden no encontrada" };
  // Autorización sin filtrar datos de órdenes ajenas
  if (order.customerId !== input.actorUserId) {
    return { ok: false, code: "FORBIDDEN", message: "No puedes evaluar esta orden" };
  }
  const [pay] = await restaurantDb
    .select({ id: payments.id })
    .from(payments)
    .where(and(eq(payments.orderId, order.id), eq(payments.status, "COMPLETED")))
    .limit(1);
  const elig = isOrderEligibleForRating({ orderStatus: order.status, hasCompletedPayment: Boolean(pay) });
  if (!elig.eligible) {
    return { ok: false, code: "NOT_LIQUID", message: "La orden aún no está liquidada" };
  }

  const comment = input.comment?.trim() || null;

  // Duplicado EXACTO verificable → PENDING_REVIEW (única regla de ocultamiento
  // automático permitida; correlación multi-cuenta solo marca REVIEW_FLAG).
  let moderationStatus: "VISIBLE" | "PENDING_REVIEW" = "VISIBLE";
  if (comment) {
    const since = new Date(Date.now() - DUPLICATE_WINDOW_HOURS * 3600 * 1000);
    const [dupRow] = await restaurantDb
      .select({ n: sql<number>`count(*)::int` })
      .from(orderRatings)
      .where(and(
        eq(orderRatings.customerUserId, input.actorUserId),
        eq(orderRatings.branchId, order.branchId),
        eq(orderRatings.comment, comment),
        gte(orderRatings.createdAt, since)
      ));
    moderationStatus = resolveModerationStatus(Number(dupRow?.n ?? 0));
  }

  const [existing] = await restaurantDb
    .select()
    .from(orderRatings)
    .where(eq(orderRatings.orderId, order.id))
    .limit(1);

  if (existing) {
    if (existing.customerUserId !== input.actorUserId) {
      return { ok: false, code: "FORBIDDEN", message: "No puedes editar esta evaluación" };
    }
    if (!existing.isEligible) {
      return { ok: false, code: "NOT_LIQUID", message: "La orden dejó de ser elegible" };
    }
    if (!canEditRating(existing.createdAt ?? existing.updatedAt)) {
      return { ok: false, code: "WINDOW_CLOSED", message: "La ventana de edición (24h) ya cerró" };
    }
    await restaurantDb
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
    await restaurantDb.insert(orderRatingEvents).values({
      ratingId: existing.id,
      eventType: "EDITED",
      actorUserId: input.actorUserId,
      actorRole: "AUTHOR",
      previousStars: existing.stars,
      newStars: input.stars,
      previousComment: existing.comment,
      newComment: comment,
    });
    return { ok: true, ratingId: existing.id, edited: true };
  }

  const [created] = await restaurantDb
    .insert(orderRatings)
    .values({
      orderId: order.id,
      branchId: order.branchId,
      customerUserId: input.actorUserId,
      stars: input.stars,
      attributes: input.attributes ?? null,
      comment,
      moderationStatus,
    })
    .onConflictDoNothing({ target: orderRatings.orderId })
    .returning();

  // Doble submit: si el UNIQUE bloqueó, devolver el existente idempotente
  if (!created) {
    const [dup] = await restaurantDb
      .select({ id: orderRatings.id })
      .from(orderRatings)
      .where(eq(orderRatings.orderId, order.id))
      .limit(1);
    return { ok: true, ratingId: dup?.id ?? null, edited: false, duplicate: true };
  }

  await restaurantDb.insert(orderRatingEvents).values({
    ratingId: created.id,
    eventType: "CREATED",
    actorUserId: input.actorUserId,
    actorRole: "AUTHOR",
    newStars: input.stars,
    newComment: comment,
  });

  return { ok: true, ratingId: created.id, edited: false };
}
