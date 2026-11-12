/**
 * ── Outbox de eventos POS/KDS (Fase 0C-5) ──────────────────────────────────
 *
 * Mismo patrón que `chatOutbox` del miniapp: el evento se escribe en la MISMA
 * transacción que la orden (si la orden existe, el aviso existe) y un worker lo
 * publica en Centrifugo con at-least-once. El cliente deduplica por `eventId`.
 *
 * La base sigue siendo la fuente de verdad: si Centrifugo se cae, el KDS
 * reconecta y reconstruye desde `kds.getStationQueue`.
 *
 * Ver: Docs/POS-FASE-0/ADR-017-transporte-eventos.md
 */

import crypto from "node:crypto";
import { and, eq, lte, or, isNull } from "drizzle-orm";
import { realtimeOutbox } from "@rabbitty/database-restaurant/schema";

const LEASE_MS = 60_000;
const MAX_ATTEMPTS = 8;

export function isRealtimePublishConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.CENTRIFUGO_API_URL && env.CENTRIFUGO_API_KEY);
}

/** Canal de una estación: aislamiento por tenant + sucursal + estación. */
export function stationChannel(businessId: string | null, branchId: string, stationId: string): string {
  const tenant = businessId || "unknown";
  return `biz:${tenant}:branch:${branchId}:station:${stationId}`;
}

/**
 * Encola un evento. DEBE llamarse con el `tx` de la transacción de la orden.
 * Es idempotente por `eventId`.
 */
export async function enqueueRealtimeEvent(
  tx: any,
  input: {
    businessId?: string | null;
    branchId: string;
    channel: string;
    eventType: string;
    payload: Record<string, unknown>;
    eventId?: string;
  },
): Promise<string> {
  const eventId = input.eventId ?? crypto.randomUUID();
  await tx
    .insert(realtimeOutbox)
    .values({
      businessId: input.businessId ?? null,
      branchId: input.branchId,
      channel: input.channel,
      eventType: input.eventType,
      eventId,
      payload: input.payload,
    })
    .onConflictDoNothing({ target: realtimeOutbox.eventId });
  return eventId;
}

/** Publica un evento por la HTTP API de Centrifugo. */
async function publish(channel: string, data: Record<string, unknown>): Promise<void> {
  const url = process.env.CENTRIFUGO_API_URL;
  const key = process.env.CENTRIFUGO_API_KEY;
  if (!url || !key) throw new Error("CENTRIFUGO_NOT_CONFIGURED");

  const res = await fetch(url.replace(/\/$/, ""), {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": key },
    body: JSON.stringify({ method: "publish", params: { channel, data } }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`centrifugo ${res.status} ${body.slice(0, 120)}`);
  }
}

/**
 * Publica de inmediato lo que quedó pendiente, sin bloquear ni romper la
 * mutación que lo originó. Si falla, el evento sigue QUEUED y lo recoge el
 * cron: el llamador nunca ve el error (la orden ya está confirmada).
 *
 * Con esto el KDS recibe el aviso en el mismo request (~decenas de ms) en vez
 * de esperar al worker periódico.
 */
export function drainRealtimeInBackground(db: any): void {
  if (!isRealtimePublishConfigured()) return;
  void processRealtimeOutboxBatch(db, 10).catch(() => {
    /* queda en la cola para el cron */
  });
}

/**
 * Drena hasta `limit` eventos pendientes. Reclama con SKIP LOCKED para que
 * varios workers no se pisen.
 */
export async function processRealtimeOutboxBatch(
  db: any,
  limit = 25,
): Promise<{ processed: number; published: number; retried: number; failed: number; skipped: boolean }> {
  const summary = { processed: 0, published: 0, retried: 0, failed: 0, skipped: false };
  if (!isRealtimePublishConfigured()) {
    summary.skipped = true;
    return summary;
  }

  const batch = await db.transaction(async (tx: any) => {
    const rows = await tx
      .select()
      .from(realtimeOutbox)
      .where(
        and(
          eq(realtimeOutbox.status, "QUEUED"),
          lte(realtimeOutbox.runAfter, new Date()),
          or(isNull(realtimeOutbox.lockedUntil), lte(realtimeOutbox.lockedUntil, new Date())),
        ),
      )
      .orderBy(realtimeOutbox.runAfter)
      .limit(limit)
      .for("update", { skipLocked: true });

    for (const row of rows) {
      await tx
        .update(realtimeOutbox)
        .set({ lockedUntil: new Date(Date.now() + LEASE_MS) })
        .where(eq(realtimeOutbox.id, row.id));
    }
    return rows;
  });

  for (const item of batch) {
    summary.processed += 1;
    try {
      await publish(item.channel, {
        eventId: item.eventId,
        eventType: item.eventType,
        seq: item.seq,
        branchId: item.branchId,
        ...(item.payload as Record<string, unknown>),
      });
      await db
        .update(realtimeOutbox)
        .set({ status: "SENT", lockedUntil: null, sentAt: new Date(), updatedAt: new Date() })
        .where(eq(realtimeOutbox.id, item.id));
      summary.published += 1;
    } catch (err) {
      const attempts = Number(item.attempts ?? 0) + 1;
      const giveUp = attempts >= MAX_ATTEMPTS;
      const backoffSeconds = Math.min(300, Math.pow(2, Math.max(0, attempts - 1)) * 2);
      await db
        .update(realtimeOutbox)
        .set({
          attempts,
          status: giveUp ? "FAILED" : "QUEUED",
          lockedUntil: null,
          runAfter: new Date(Date.now() + backoffSeconds * 1000),
          updatedAt: new Date(),
        })
        .where(eq(realtimeOutbox.id, item.id));
      if (giveUp) summary.failed += 1;
      else summary.retried += 1;
    }
  }

  return summary;
}
