/**
 * ── Ritmo de notificaciones de engagement ───────────────────────────────────
 *
 * Los avisos transaccionales (pedidos, pagos, chat, seguridad) siempre pasan.
 * Los de engagement (nudges, avisos de favoritos, onboarding, promos) comparten
 * un presupuesto de atención: si el usuario ya recibió uno en la ventana, no se
 * le manda otro. Evita el "todo de un jalón" al entrar o al ser nuevo.
 */

import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { notificationsOutbox } from "@rabbitty/database-core/schema";

/** Tipos que cuentan para el ritmo (los transaccionales no). */
export const ENGAGEMENT_TYPES = [
  "AFFILIATE_NUDGE",
  "PREFERENCE_ALERT",
  "PREFERENCE_OPTIN",
  "PREFERENCE_PROMO",
  "OFFER_FLASH",
  "CHECKIN_PROMPT",
  "ARRIVAL",
  "BIRTHDAY",
  "MEMBERSHIP_NUDGE",
];

const DEFAULT_WINDOW_HOURS = 24;

type CoreDb = ReturnType<typeof import("../db").getCoreDb>;

/**
 * ¿Podemos mandarle otro aviso de engagement ahora?
 * Devuelve `true` si no ha recibido ninguno en la ventana.
 */
export async function canSendEngagement(
  coreDb: CoreDb,
  userId: string,
  withinHours: number = DEFAULT_WINDOW_HOURS,
): Promise<boolean> {
  const since = new Date(Date.now() - withinHours * 3_600_000);
  const [row] = await coreDb
    .select({ count: sql<number>`count(*)::int` })
    .from(notificationsOutbox)
    .where(
      and(
        eq(notificationsOutbox.userId, userId),
        gte(notificationsOutbox.createdAt, since),
        inArray(notificationsOutbox.type, ENGAGEMENT_TYPES),
      ),
    );
  return Number(row?.count ?? 0) === 0;
}
