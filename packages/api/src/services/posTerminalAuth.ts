import { and, eq, isNull } from "drizzle-orm";
import { posTerminals, posTerminalSessions } from "@rabbitty/database-core/schema";
import type { getCoreDb } from "../db";

/**
 * ── Autenticación de terminal POS (Fase 2 del ADR-014) ──
 *
 * La terminal tiene su PROPIA sesión (token opaco de 64 hex), separada de
 * NextAuth. Esto permite que el POS siga operando aunque el administrador no
 * tenga la sesión abierta en ese dispositivo.
 *
 * Reglas de seguridad:
 *  · Se acepta el token SOLO si: existe, no está revocado, la terminal está
 *    ACTIVE, la sesión no venció y la autorización de la terminal no venció.
 *  · El token no otorga identidad de usuario (`userId = null`). Solo habilita
 *    los routers POS permitidos y SIEMPRE dentro de su sucursal.
 *  · La lectura es "doble": si además hay sesión de admin, esa sigue siendo
 *    válida. La terminal nunca reemplaza la autorización del admin: se suma.
 */

export interface PosTerminalPrincipal {
  terminalId: string;
  sessionId: string;
  branchId: string;
  /** Estación fija de la terminal (null = elige el cliente). */
  stationId: string | null;
  businessId: string | null;
  terminalName: string;
  sessionExpiresAt: Date;
  lastUsedAt: Date | null;
  useCount: number;
}

/** Token de terminal: 64 hex. Cualquier otra cosa se ignora sin tocar la DB. */
const TERMINAL_TOKEN_RE = /^[a-f0-9]{64}$/i;

export function readTerminalToken(headers: Headers): string | null {
  const raw = headers.get("x-pos-terminal-token");
  if (!raw) return null;
  const token = raw.trim();
  return TERMINAL_TOKEN_RE.test(token) ? token : null;
}

export function isTerminalSessionsEnabled(): boolean {
  return process.env.POS_TERMINAL_SESSIONS === "1";
}

/**
 * Resuelve el token a un principal válido. Devuelve null si no existe, está
 * revocado/vencido o la terminal ya no está ACTIVE.
 */
export async function resolvePosTerminalSession(
  coreDb: ReturnType<typeof getCoreDb>,
  token: string,
): Promise<PosTerminalPrincipal | null> {
  const [row] = await coreDb
    .select({
      sessionId: posTerminalSessions.id,
      sessionExpiresAt: posTerminalSessions.expiresAt,
      sessionRevokedAt: posTerminalSessions.revokedAt,
      lastUsedAt: posTerminalSessions.lastUsedAt,
      useCount: posTerminalSessions.useCount,
      terminalId: posTerminals.id,
      terminalName: posTerminals.name,
      terminalStatus: posTerminals.status,
      terminalExpiresAt: posTerminals.expiresAt,
      branchId: posTerminals.branchId,
      stationId: posTerminals.stationId,
      businessId: posTerminals.businessId,
    })
    .from(posTerminalSessions)
    .innerJoin(posTerminals, eq(posTerminalSessions.terminalId, posTerminals.id))
    .where(and(eq(posTerminalSessions.token, token), isNull(posTerminalSessions.revokedAt)))
    .limit(1);

  if (!row) return null;
  if (row.terminalStatus !== "ACTIVE") return null;
  if (!row.branchId) return null;

  const now = Date.now();
  if (row.sessionExpiresAt && new Date(row.sessionExpiresAt).getTime() <= now) return null;
  if (row.terminalExpiresAt && new Date(row.terminalExpiresAt).getTime() <= now) return null;

  return {
    terminalId: row.terminalId,
    sessionId: row.sessionId,
    branchId: row.branchId,
    stationId: row.stationId ?? null,
    businessId: row.businessId ?? null,
    terminalName: row.terminalName,
    sessionExpiresAt: new Date(row.sessionExpiresAt),
    lastUsedAt: row.lastUsedAt ? new Date(row.lastUsedAt) : null,
    useCount: row.useCount ?? 0,
  };
}

/**
 * Telemetría sin amplificación de escrituras: solo cuenta la sesión si su
 * último uso tiene más de 5 minutos. Sirve para medir adopción por terminal.
 */
const TOUCH_INTERVAL_MS = 5 * 60_000;

export async function touchTerminalSession(
  coreDb: ReturnType<typeof getCoreDb>,
  principal: PosTerminalPrincipal,
): Promise<void> {
  if (principal.lastUsedAt && Date.now() - principal.lastUsedAt.getTime() < TOUCH_INTERVAL_MS) {
    return;
  }
  try {
    await coreDb
      .update(posTerminalSessions)
      .set({ lastUsedAt: new Date(), useCount: principal.useCount + 1 })
      .where(eq(posTerminalSessions.id, principal.sessionId));
    await coreDb
      .update(posTerminals)
      .set({ lastSeenAt: new Date() })
      .where(eq(posTerminals.id, principal.terminalId));
  } catch (error) {
    // La telemetría nunca debe tumbar una operación del POS.
    console.warn("[POS_AUTH] no se pudo registrar el uso de la terminal:", error);
  }
}
