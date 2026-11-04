/**
 * ── Publicación de eventos de chat a Centrifugo (server-only) ──
 *
 * Patrón del plan (Fase 4): el evento se escribe en `chat_event_outbox` dentro
 * de la MISMA transacción del mensaje. El worker publica con at-least-once y
 * reintentos; el cliente deduplica por `eventId`.
 *
 * Garantía: nada queda "guardado y nunca avisado". Se acepta republicar.
 */

import { and, eq, inArray, lte, or, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { chatEventOutbox } from '@/db/schema';

const API_URL = () => process.env.CENTRIFUGO_API_URL || 'http://localhost:8000/api';
const API_KEY = () => process.env.CENTRIFUGO_API_KEY || '';
const LEASE_MS = 60_000;
const MAX_ATTEMPTS = 8;

export function isRealtimePublishConfigured(): boolean {
  return Boolean(process.env.CENTRIFUGO_API_KEY && process.env.CENTRIFUGO_API_URL);
}

export function chatChannel(conversationId: string): string {
  return `chat:conv_${conversationId}`;
}

/**
 * Inserta el evento en el outbox. DEBE llamarse con el `tx` de la transacción
 * del mensaje para que evento y mensaje sean atómicos.
 */
export async function enqueueChatEvent(
  tx: { insert: typeof db.insert },
  input: {
    conversationId: string;
    type: 'message.created' | 'message.read' | 'typing';
    eventId: string;
    payload: Record<string, unknown>;
  },
): Promise<void> {
  await tx
    .insert(chatEventOutbox)
    .values({
      conversationId: input.conversationId,
      type: input.type,
      eventId: input.eventId,
      payload: input.payload,
    })
    .onConflictDoNothing({ target: chatEventOutbox.eventId });
}

/** Publica un evento por la HTTP API de Centrifugo. */
async function publish(channel: string, data: Record<string, unknown>): Promise<void> {
  const res = await fetch(API_URL(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY(),
    },
    body: JSON.stringify({ method: 'publish', params: { channel, data } }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`centrifugo ${res.status} ${body.slice(0, 120)}`);
  }
}

/**
 * Procesa hasta `limit` eventos QUEUED. Reclama con SKIP LOCKED (varios workers
 * pueden correr a la vez: piggyback tras el envío + cron).
 */
export async function processChatOutboxBatch(limit = 25): Promise<{
  processed: number;
  published: number;
  retried: number;
  failed: number;
  skipped: number;
}> {
  const summary = { processed: 0, published: 0, retried: 0, failed: 0, skipped: 0 };

  if (!isRealtimePublishConfigured()) {
    summary.skipped = 1;
    return summary;
  }

  const batch = await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(chatEventOutbox)
      .where(
        and(
          eq(chatEventOutbox.status, 'QUEUED'),
          lte(chatEventOutbox.runAfter, new Date()),
          or(isNull(chatEventOutbox.lockedUntil), lte(chatEventOutbox.lockedUntil, new Date())),
        ),
      )
      .orderBy(chatEventOutbox.runAfter)
      .limit(limit)
      .for('update', { skipLocked: true });

    if (rows.length > 0) {
      await tx
        .update(chatEventOutbox)
        .set({ lockedUntil: new Date(Date.now() + LEASE_MS) })
        .where(inArray(chatEventOutbox.id, rows.map((r) => r.id)));
    }
    return rows;
  });

  for (const item of batch) {
    summary.processed += 1;
    try {
      await publish(
        chatChannel(item.conversationId),
        // `eventType` identifica el evento; `type` (en el payload) es el tipo de
        // mensaje (TEXT/VOICE). No se pisan.
        { eventId: item.eventId, eventType: item.type, ...(item.payload as Record<string, unknown>) },
      );
      await db
        .update(chatEventOutbox)
        .set({ status: 'PROCESSED', lockedUntil: null, updatedAt: new Date() })
        .where(eq(chatEventOutbox.id, item.id));
      summary.published += 1;
    } catch (err) {
      const attempts = Number(item.attempts ?? 0) + 1;
      const giveUp = attempts >= MAX_ATTEMPTS;
      const backoffSeconds = Math.min(300, Math.pow(2, Math.max(0, attempts - 1)) * 2);
      await db
        .update(chatEventOutbox)
        .set({
          attempts,
          status: giveUp ? 'FAILED' : 'QUEUED',
          lockedUntil: null,
          runAfter: new Date(Date.now() + backoffSeconds * 1000),
          updatedAt: new Date(),
        })
        .where(eq(chatEventOutbox.id, item.id));
      if (giveUp) summary.failed += 1;
      else summary.retried += 1;
      console.warn(
        `[CHAT OUTBOX] ${item.eventId} falló (intento ${attempts}):`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return summary;
}

/**
 * Dispara el worker sin bloquear la respuesta (piggyback).
 * El mensaje YA está persistido + el evento en el outbox: si esto falla, el
 * cron lo recoge.
 */
export function kickChatOutbox(): void {
  void processChatOutboxBatch(10).catch((err) =>
    console.warn('[CHAT OUTBOX] piggyback falló:', err instanceof Error ? err.message : err),
  );
}

/** Publicación directa de typing (transient, no se persiste). */
export async function publishTyping(conversationId: string, senderId: string): Promise<void> {
  if (!isRealtimePublishConfigured()) return;
  try {
    await publish(chatChannel(conversationId), {
      eventId: `typing:${conversationId}:${senderId}:${Date.now()}`,
      eventType: 'typing',
      senderId,
      at: Date.now(),
    });
  } catch (err) {
    console.warn('[TYPING] publish falló:', err instanceof Error ? err.message : err);
  }
}

/** Cuenta eventos pendientes (diagnóstico). */
export async function chatOutboxStats(): Promise<Record<string, number>> {
  const rows = await db
    .select({ status: chatEventOutbox.status, n: sql<number>`COUNT(*)::int` })
    .from(chatEventOutbox)
    .groupBy(chatEventOutbox.status);
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.n)]));
}
