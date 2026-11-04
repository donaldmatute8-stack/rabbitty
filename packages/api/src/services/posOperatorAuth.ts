import { and, eq, isNull } from "drizzle-orm";
import { posOperatorSessions } from "@rabbitty/database-core/schema";
import { staff as staffTable } from "@rabbitty/database-restaurant/schema";
import type { getCoreDb, getRestaurantDb } from "../db";
import type { PosTerminalPrincipal } from "./posTerminalAuth";

/**
 * ── Turno del empleado sobre la terminal (Fase 3 del ADR-014) ──
 *
 * La terminal identifica al DISPOSITIVO; el turno identifica a la PERSONA.
 * El empleado mete su PIN (`staff.pinCode`, ya existente) al empezar y el POS
 * guarda un token de turno atado a esa terminal.
 *
 * Reglas de seguridad:
 *  · El token de turno SOLO se resuelve si antes hay un token de terminal
 *    válido. Robar el token de turno no sirve sin el dispositivo.
 *  · El turno está atado a `terminalId` y a una sucursal; no se puede mover.
 *  · Vence solo (16 h) y se cierra al salir del POS.
 *  · El PIN se valida con scrypt + comparación de tiempo constante y lockout
 *    por intentos (5 fallos → 5 minutos), igual que en caja.
 */

export interface PosOperatorPrincipal {
  sessionId: string;
  terminalId: string;
  staffId: string;
  name: string;
  role: string;
  startedAt: Date | null;
  expiresAt: Date | null;
  lastSeenAt: Date | null;
}

const OPERATOR_TOKEN_RE = /^[a-f0-9]{64}$/i;

export function isOperatorSessionsEnabled(): boolean {
  return process.env.POS_OPERATOR_SESSIONS === "1";
}

export function readOperatorToken(headers: Headers): string | null {
  const raw = headers.get("x-pos-operator-token");
  if (!raw) return null;
  const token = raw.trim();
  return OPERATOR_TOKEN_RE.test(token) ? token : null;
}

/** Resuelve el token de turno SOLO dentro de una terminal ya validada. */
export async function resolvePosOperatorSession(
  coreDb: ReturnType<typeof getCoreDb>,
  restaurantDb: ReturnType<typeof getRestaurantDb>,
  token: string,
  terminal: PosTerminalPrincipal,
): Promise<PosOperatorPrincipal | null> {
  const [row] = await coreDb
    .select({
      sessionId: posOperatorSessions.id,
      terminalId: posOperatorSessions.terminalId,
      staffId: posOperatorSessions.staffId,
      startedAt: posOperatorSessions.startedAt,
      expiresAt: posOperatorSessions.expiresAt,
      lastSeenAt: posOperatorSessions.lastSeenAt,
    })
    .from(posOperatorSessions)
    .where(and(eq(posOperatorSessions.token, token), isNull(posOperatorSessions.endedAt)))
    .limit(1);

  if (!row) return null;
  // Atado al dispositivo: un turno de otra terminal no sirve aquí.
  if (row.terminalId !== terminal.terminalId) return null;
  if (row.expiresAt && new Date(row.expiresAt).getTime() <= Date.now()) return null;

  const [member] = await restaurantDb
    .select({
      id: staffTable.id,
      name: staffTable.name,
      role: staffTable.role,
      branchId: staffTable.branchId,
      isActive: staffTable.isActive,
    })
    .from(staffTable)
    .where(and(eq(staffTable.id, row.staffId), eq(staffTable.isActive, true)))
    .limit(1);

  if (!member) return null;
  // El empleado debe seguir perteneciendo a la sucursal de la terminal.
  if (member.branchId && member.branchId !== terminal.branchId) return null;

  return {
    sessionId: row.sessionId,
    terminalId: row.terminalId,
    staffId: member.id,
    name: member.name,
    role: member.role,
    startedAt: row.startedAt ? new Date(row.startedAt) : null,
    expiresAt: row.expiresAt ? new Date(row.expiresAt) : null,
    lastSeenAt: row.lastSeenAt ? new Date(row.lastSeenAt) : null,
  };
}

/** Latido acotado: una escritura cada 5 minutos por turno. */
const TOUCH_INTERVAL_MS = 5 * 60_000;

export async function touchOperatorSession(
  coreDb: ReturnType<typeof getCoreDb>,
  principal: PosOperatorPrincipal,
): Promise<void> {
  if (principal.lastSeenAt && Date.now() - principal.lastSeenAt.getTime() < TOUCH_INTERVAL_MS) {
    return;
  }
  try {
    await coreDb
      .update(posOperatorSessions)
      .set({ lastSeenAt: new Date() })
      .where(eq(posOperatorSessions.id, principal.sessionId));
  } catch (error) {
    console.warn("[POS_OPERATOR] no se pudo registrar el latido:", error);
  }
}
