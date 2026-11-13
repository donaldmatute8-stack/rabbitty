/**
 * ── Código de presencia para el chequeo (ADR-025 D7) ───────────────────────
 *
 * El admin (o un dispositivo de la sucursal) muestra un QR con un código que
 * rota cada minuto. El comandero lo escanea y lo manda junto con el PIN del
 * mesero: el código prueba que el dispositivo **está físicamente** en la
 * sucursal; el PIN prueba **quién** es.
 *
 * Sin estado en base: el código es un HMAC de `branchId:ventana`. Se acepta la
 * ventana actual y la anterior (margen de un minuto por reloj/escaneo).
 */

import crypto from "node:crypto";

const WINDOW_MS = 60_000;

function secret(): string {
  return (
    process.env.CHECKIN_CODE_SECRET ||
    process.env.AUTH_SECRET ||
    "rabbitty-dev-checkin-secret"
  );
}

function codeFor(branchId: string, window: number): string {
  return crypto
    .createHmac("sha256", secret())
    .update(`${branchId}:${window}`)
    .digest("hex")
    .slice(0, 8)
    .toUpperCase();
}

export function currentPresenceCode(branchId: string, now = Date.now()) {
  const window = Math.floor(now / WINDOW_MS);
  return {
    code: codeFor(branchId, window),
    expiresAt: new Date((window + 1) * WINDOW_MS),
    windowSeconds: WINDOW_MS / 1000,
  };
}

/** true si el código corresponde a la ventana actual o a la anterior. */
export function verifyPresenceCode(branchId: string, code: string, now = Date.now()): boolean {
  const clean = String(code || "").trim().toUpperCase();
  if (clean.length !== 8) return false;
  const window = Math.floor(now / WINDOW_MS);
  return clean === codeFor(branchId, window) || clean === codeFor(branchId, window - 1);
}
