"use client";

/**
 * ── Credenciales locales de la terminal POS (Fase 2 del ADR-014) ──
 *
 * El dispositivo guarda DOS cosas distintas:
 *  · `deviceKey`: secreto local que identifica a la terminal ante el servidor.
 *    El servidor solo guarda su hash HMAC; aquí vive el original.
 *  · `sessionToken`: sesión emitida por el servidor, con expiración y
 *    revocación. Es lo que viaja en `x-pos-terminal-token`.
 *
 * `localStorage` es accesible para JS del mismo origen; se acepta el riesgo
 * (igual que cualquier token de sesión web). El servidor nunca confía en estos
 * valores sin validarlos contra `pos_terminal_sessions`.
 */

const TOKEN_KEY = "rabbitty_pos_terminal_token";
const DEVICE_KEY = "rabbitty_pos_device_key";
const INFO_KEY = "rabbitty_pos_terminal_info";
const OPERATOR_TOKEN_KEY = "rabbitty_pos_operator_token";
const OPERATOR_INFO_KEY = "rabbitty_pos_operator_info";

export interface PosTerminalInfo {
  terminalId: string;
  name: string;
  branchId: string | null;
  expiresAt?: string | null;
}

function safeGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* modo privado / cuota: la terminal simplemente pedirá vincularse */
  }
}

export function getPosTerminalToken(): string | null {
  const token = safeGet(TOKEN_KEY);
  return token && /^[a-f0-9]{64}$/i.test(token) ? token : null;
}

export function getPosTerminalInfo(): PosTerminalInfo | null {
  const raw = safeGet(INFO_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PosTerminalInfo;
  } catch {
    return null;
  }
}

export function savePosTerminal(token: string, info: PosTerminalInfo): void {
  safeSet(TOKEN_KEY, token);
  safeSet(INFO_KEY, JSON.stringify(info));
}

export function clearPosTerminal(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(INFO_KEY);
  } catch {
    /* nada que limpiar */
  }
}

/** ¿Este dispositivo ya fue vinculado alguna vez? (sin generar uno nuevo) */
export function hasPosDeviceKey(): boolean {
  const existing = safeGet(DEVICE_KEY);
  return !!existing && /^[a-f0-9]{64}$/i.test(existing);
}

/** Secreto local de 64 hex. Estable por dispositivo. */
export function getOrCreateDeviceKey(): string {
  const existing = safeGet(DEVICE_KEY);
  if (existing && /^[a-f0-9]{64}$/i.test(existing)) return existing;

  let key = "";
  try {
    const bytes = new Uint8Array(32);
    window.crypto.getRandomValues(bytes);
    key = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    // Fallback muy poco probable (navegador sin WebCrypto).
    key = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  }
  safeSet(DEVICE_KEY, key);
  return key;
}

// ── Turno del empleado (Fase 3) ─────────────────────────────────────────────

export interface PosOperatorInfo {
  staffId: string;
  name: string;
  role: string;
  expiresAt?: string | null;
}

export function getPosOperatorToken(): string | null {
  const token = safeGet(OPERATOR_TOKEN_KEY);
  return token && /^[a-f0-9]{64}$/i.test(token) ? token : null;
}

export function getPosOperatorInfo(): PosOperatorInfo | null {
  const raw = safeGet(OPERATOR_INFO_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PosOperatorInfo;
  } catch {
    return null;
  }
}

export function savePosOperator(token: string, info: PosOperatorInfo): void {
  safeSet(OPERATOR_TOKEN_KEY, token);
  safeSet(OPERATOR_INFO_KEY, JSON.stringify(info));
}

export function clearPosOperator(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(OPERATOR_TOKEN_KEY);
    window.localStorage.removeItem(OPERATOR_INFO_KEY);
  } catch {
    /* nada que limpiar */
  }
}
