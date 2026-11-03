// server-only: imported desde API routes (no client)

/**
 * ── Outbox transaccional (P0) ── Docs/PUSH-NOTIFICATIONS-PLAN.md §2
 * Regla de oro: la transacción de negocio NUNCA llama al proveedor de push.
 * 1) enqueueOutbox() → fila durable (dedupe UNIQUE) en la misma tx de negocio
 * 2) processOutboxBatch() → worker: in-app + APNs + notificationDeliveries
 *    con estados reales: SENT → PROVIDER_ACCEPTED / RETRYING / FAILED / SKIPPED
 *
 * Backoff: runAfter exponencial (~30s × 2^attempts); FAILED tras 4 intentos.
 * Dedupe: dedupeKey UNIQUE — webhooks/retries no duplican.
 */

import { and, eq, lte, asc, sql, or, isNull, inArray } from "drizzle-orm";
import { db } from "@/db";
import { notifications, notificationsOutbox, notificationDeliveries, pushDevices, users } from "@/db/schema";
import { isApnsConfigured, sendApnsToDevice, type PushPayload } from "@/lib/push/apns";
import { sendFcmToDevice, isFcmConfigured } from "@/lib/push/fcm";
import { typePushMuted, parseMutedCategories, categoryForPushType } from "@/lib/push/categories";

export const OUTBOX_MAX_ATTEMPTS = 4;
export const OUTBOX_BACKOFF_BASE_SECONDS = 30;
/** Lease del claim SKIP LOCKED: si el worker muere a mitad del fan-out,
 *  la fila vuelve a ser elegible tras expirar (no se pierde, no se suma retry). */
export const OUTBOX_LEASE_MS = 120_000;

export interface OutboxInput {
  userId: string;
  type: string;
  title: string;
  message: string;
  route?: string | null;
  data?: Record<string, string | number | boolean | null>;
  dedupeKey?: string | null;
  priority?: "high" | "normal" | "low";
}

/** Encola un evento. null = duplicado (dedupeKey ya existía). */
export async function enqueueOutbox(input: OutboxInput): Promise<{ enqueued: boolean; id: string | null }> {
  const inserted = await db
    .insert(notificationsOutbox)
    .values({
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      route: input.route ?? null,
      data: input.data ?? null,
      dedupeKey: input.dedupeKey ?? null,
      priority: input.priority ?? "normal",
    })
    .onConflictDoNothing({ target: notificationsOutbox.dedupeKey })
    .returning({ id: notificationsOutbox.id });
  return { enqueued: inserted.length > 0, id: inserted[0]?.id ?? null };
}

/** Clasifica el resultado del proveedor → estado de entrega. */
export function classifyProviderResult(status: number): { status: string; retryable: boolean } {
  if (status >= 200 && status < 300) return { status: "PROVIDER_ACCEPTED", retryable: false };
  if (status === 410 || status === 404) return { status: "FAILED", retryable: false }; // token muerto
  if (status >= 500 || status === 408) return { status: "RETRYING", retryable: true };
  // 400/403/429 → reconfig o rate: un retry corto puede servir, pero tras N muere
  return { status: "RETRYING", retryable: true };
}

export function nextBackoffSeconds(attempts: number): number {
  return Math.min(900, OUTBOX_BACKOFF_BASE_SECONDS * Math.pow(2, Math.max(0, attempts - 1)));
}

/** Procesa hasta `limit` eventos QUEUED. Devuelve resumen para telemetría. */
export async function processOutboxBatch(limit = 20): Promise<{
  processed: number; sent: number; retried: number; failed: number; skipped: number;
}> {
  const summary = { processed: 0, sent: 0, retried: 0, failed: 0, skipped: 0 };
  if (!isApnsConfigured()) {
    // Sin envs: el outbox NO pierde eventos — congela (no quema intentos) y el
    // worker los procesará en cuanto la$config exista. Solo dejamos rastro.
    summary.skipped = 1;
    return summary;
  }

  // Claim transaccional con SKIP LOCKED (§14-3): el cron de GH y el piggyback
  // pueden correr al mismo tiempo — cada fila la reclama un único worker.
  // Una fila a medio procesar vuelve a la cola solo si su lease expira.
  const batch = await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(notificationsOutbox)
      .where(
        and(
          eq(notificationsOutbox.status, "QUEUED"),
          lte(notificationsOutbox.runAfter, new Date()),
          or(isNull(notificationsOutbox.lockedUntil), lte(notificationsOutbox.lockedUntil, new Date()))
        )
      )
      .orderBy(asc(notificationsOutbox.runAfter))
      .limit(limit)
      .for("update", { skipLocked: true });
    if (rows.length > 0) {
      await tx
        .update(notificationsOutbox)
        .set({ lockedUntil: new Date(Date.now() + OUTBOX_LEASE_MS), updatedAt: new Date() })
        .where(inArray(notificationsOutbox.id, rows.map((r) => r.id)));
    }
    return rows;
  });

  // Prefs del usuario (una sola query para todo el batch): plano CATEGORÍA
  // (pushMutedCategories) y plano CANAL (pushInAppEnabled).
  const userPushPrefs = new Map<string, { muted: string; inAppEnabled: boolean }>();
  const batchUserIds = Array.from(new Set(batch.map((b) => b.userId)));
  if (batchUserIds.length > 0) {
    const prefRows = await db
      .select({ id: users.id, muted: users.pushMutedCategories, inAppEnabled: users.pushInAppEnabled })
      .from(users)
      .where(inArray(users.id, batchUserIds));
    for (const row of prefRows) {
      userPushPrefs.set(row.id, { muted: row.muted, inAppEnabled: row.inAppEnabled !== false });
    }
  }

  for (const item of batch) {
    summary.processed += 1;

    // ── Dos planos distintos, no confundirlos (v2.1 §4) ──
    // CATEGORÍA (pushMutedCategories): el Rabbitter no quiere ese tipo de aviso
    //   → sin campana y sin push (los CRITICAL/SYSTEM nunca se silencian).
    // CANAL (pushInAppEnabled): no quiere campana, pero el push nativo SÍ sale
    //   y marca el badge iOS (semántica tipo Facebook — H22).
    const prefs = userPushPrefs.get(item.userId);
    const mutedCategories = parseMutedCategories(prefs?.muted);
    const pushMuted = typePushMuted(mutedCategories, item.type);
    const inAppEnabled = prefs?.inAppEnabled !== false;
    // Todos los devices activos del usuario (iOS→APNs, Android→FCM)
    const usersDevices = await db
      .select({ id: pushDevices.id, token: pushDevices.token, platform: pushDevices.platform })
      .from(pushDevices)
      .where(and(eq(pushDevices.userId, item.userId), eq(pushDevices.isActive, true)));

    // 1) In-app primero. H22: el plano CANAL apaga SOLO la campana — el push
    // sigue saliendo y el ícono iOS marca el badge. El plano CATEGORÍA apaga
    // ambos (ver bloque SKIPPED abajo).
    let notificationId: string | null = null;
    if (!pushMuted && inAppEnabled) {
      const [inApp] = await db
        .insert(notifications)
        .values({ userId: item.userId, title: item.title, message: item.message, type: item.type, ...(item.route ? { route: item.route } : {}) })
        .onConflictDoNothing()
        .returning({ id: notifications.id });
      notificationId = inApp?.id ?? null;
      if (notificationId) {
        await db.insert(notificationDeliveries).values({ notificationId, channel: "inApp", status: "SENT" });
      }
    }

    // 2) Fan-out por device: iOS → APNs · Android → FCM (P3)
    // §2.2: si la categoría está silenciada, NO se llama al proveedor — queda
    // registrado como SKIPPED (category_muted) y el item cierra como PROCESSED.
    if (pushMuted) {
      if (notificationId) {
        await db.insert(notificationDeliveries).values({
          notificationId,
          channel: "APNs",
          status: "SKIPPED",
          reason: `category_muted:${categoryForPushType(item.type)}`,
        });
      }
      summary.skipped += 1;
      await db
        .update(notificationsOutbox)
        .set({ status: "PROCESSED", lockedUntil: null, updatedAt: new Date() })
        .where(eq(notificationsOutbox.id, item.id));
      continue;
    }

    // H17-badge: iOS badge sincronizado con el unread in-app real al momento
    // del envío (antes badge:1 fijo dejaba ícono activo con 0 sin leer).
    let unreadBadge = 1;
    try {
      const [unreadRow] = await db
        .select({ n: sql<number>`COUNT(*)::int` })
        .from(notifications)
        .where(and(eq(notifications.userId, item.userId), eq(notifications.isRead, false)));
      unreadBadge = Math.max(0, Number(unreadRow?.n ?? 0)) || 1;
    } catch { /* fallback badge 1 */ }

    const payload: PushPayload = {
      title: item.title,
      body: item.message,
      badge: unreadBadge, // H17-badge: unread real (sync icono ↔ centro de notificaciones)
      data: { ...(item.data as Record<string, string> ?? {}), ...(item.route ? { route: item.route } : {}) },
      // Seguimiento de pedidos = notificación "viva": se reemplaza a sí misma
      // (collapse-id por pedido) y usa time-sensitive para atravesar Focus.
      ...(item.dedupeKey?.startsWith("order_stage:")
        ? {
            collapseId: `order:${item.dedupeKey.split(":")[1]}`,
            threadId: `order:${item.dedupeKey.split(":")[1]}`,
            interruptionLevel: "time-sensitive" as const,
            relevanceScore: 1,
          }
        : item.priority === "high"
          ? { interruptionLevel: "time-sensitive" as const }
          : {}),
    };

    let anyOk = false;
    const deliveryRefId = notificationId ?? item.id; // deliveries sin FK — id de outbox nos sirve de fallback
    for (const dev of usersDevices) {
      try {
        let channel = "APNs";
        let res: { ok: boolean; status: number; reason?: string };
        if ((dev.platform ?? "ios") === "android") {
          // P3: FCM (Android) — con paridad de estados de entrega
          const fcmRes = await sendFcmToDevice(dev.token, payload);
          channel = "FCM";
          res = fcmRes;
        } else {
          res = await sendApnsToDevice(dev.token, payload);
        }
        await db.insert(notificationDeliveries).values({
          notificationId: deliveryRefId,
          deviceId: dev.id ?? null,
          channel,
          status: res.ok ? "PROVIDER_ACCEPTED" : classifyProviderResult(res.status).status,
          reason: res.ok ? null : `HTTP ${res.status} ${res.reason ?? ""}`.trim(),
        });
        if (res.ok) anyOk = true;
      } catch (err) {
        await db.insert(notificationDeliveries).values({
          notificationId: deliveryRefId,
          deviceId: dev.id ?? null,
          channel: "APNs",
          status: "RETRYING",
          reason: err instanceof Error ? err.message.slice(0, 200) : "error",
        });
      }
    }

    // 3) Estado del outbox: PROCESSED si el proveedor aceptó por ≥1 device; retry si no
    if (anyOk) {
      summary.sent += 1;
      await db
        .update(notificationsOutbox)
        .set({ status: "PROCESSED", lockedUntil: null, updatedAt: new Date() })
        .where(eq(notificationsOutbox.id, item.id));
    } else {
      const attempts = item.attempts + 1;
      const dead = attempts >= OUTBOX_MAX_ATTEMPTS;
      summary[dead ? "failed" : "retried"] += 1;
      await db
        .update(notificationsOutbox)
        .set({
          status: dead ? "FAILED" : "QUEUED",
          attempts,
          runAfter: new Date(Date.now() + nextBackoffSeconds(attempts) * 1000),
          lockedUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(notificationsOutbox.id, item.id));
    }
  }
  return summary;
}

/** Piggyback: dispara el worker sin bloquear la respuesta del request. */
export function kickWorker(): void {
  void processOutboxBatch(10).catch((err: unknown) =>
    console.warn("[OUTBOX] piggyback worker falló:", err instanceof Error ? err.message : err)
  );
}