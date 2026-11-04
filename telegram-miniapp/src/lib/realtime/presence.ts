/**
 * ── Presencia de app por SESIÓN (server-only) ──
 *
 * Regla del plan (Fase 3): "En línea" = tiene la app conectada. NO es GPS ni
 * presencia física en el local (eso vive en `presenceSessions`, instrumento
 * distinto que jamás se reutiliza aquí).
 *
 * Multi-device: un usuario puede tener iPhone + iPad. La presencia AGREGADA se
 * deriva de sus sesiones activas; si un device cae, el otro lo mantiene online.
 * El TTL cubre la desconexión abrupta (cuando el `close` nunca llega).
 */

import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { chatConnections } from '@/db/schema';

/** Sin heartbeat en este tiempo, la sesión se considera caída. */
export const PRESENCE_TTL_SECONDS = 90;

export interface PresenceInfo {
  online: boolean;
  lastSeenAt: Date | null;
}

/** Marca viva la sesión (llamado por el heartbeat del cliente). */
export async function touchConnection(
  userId: string,
  sessionId: string,
  platform?: string | null,
): Promise<void> {
  await db
    .insert(chatConnections)
    .values({ userId, sessionId, platform: platform ?? null })
    .onConflictDoUpdate({
      target: [chatConnections.userId, chatConnections.sessionId],
      set: { lastSeenAt: new Date(), disconnectedAt: null },
    });
}

/** Cierre limpio (el cliente avisa al salir o al cerrar la app). */
export async function closeConnection(userId: string, sessionId: string): Promise<void> {
  await db
    .update(chatConnections)
    .set({ disconnectedAt: new Date(), lastSeenAt: new Date() })
    .where(and(eq(chatConnections.userId, userId), eq(chatConnections.sessionId, sessionId)));
}

/**
 * Presencia agregada de varios usuarios.
 * `online` = al menos una sesión sin cerrar y con heartbeat dentro del TTL.
 */
export async function getPresenceForUsers(userIds: string[]): Promise<Map<string, PresenceInfo>> {
  const out = new Map<string, PresenceInfo>();
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return out;

  try {
    const rows = await db
      .select({
        userId: chatConnections.userId,
        lastSeenAt: sql<Date | null>`MAX(${chatConnections.lastSeenAt})`,
        online: sql<boolean>`BOOL_OR(${isNull(chatConnections.disconnectedAt)} AND ${chatConnections.lastSeenAt} > (now() AT TIME ZONE 'UTC') - (${PRESENCE_TTL_SECONDS} * interval '1 second'))`,
      })
      .from(chatConnections)
      .where(inArray(chatConnections.userId, ids))
      .groupBy(chatConnections.userId);

    for (const row of rows) {
      out.set(row.userId, {
        online: Boolean(row.online),
        lastSeenAt: row.lastSeenAt ? new Date(row.lastSeenAt) : null,
      });
    }
  } catch (err) {
    console.warn('[PRESENCE] consulta falló:', err instanceof Error ? err.message : err);
  }

  for (const id of ids) {
    if (!out.has(id)) out.set(id, { online: false, lastSeenAt: null });
  }
  return out;
}

export async function getPresenceForUser(userId: string): Promise<PresenceInfo> {
  const map = await getPresenceForUsers([userId]);
  return map.get(userId) ?? { online: false, lastSeenAt: null };
}
