import { createHmac } from "node:crypto";

/**
 * Token QR dinámico del Membership Pass.
 * IMPORTANTE: debe mantenerse idéntico a `signQr`/`buildQrToken` en
 * packages/api/src/routers/memberships.ts (el POS valida con esa lógica).
 * Formato: `<subscriptionId>.<window>.<hmac24>`; la ventana rota cada 30s.
 */
export const QR_WINDOW_SECONDS = 30;

export function signQr(subscriptionId: string, secret: string, window: number): string {
  return createHmac("sha256", secret).update(`${subscriptionId}.${window}`).digest("hex").slice(0, 24);
}

export function buildQrToken(subscriptionId: string, secret: string): string {
  const window = Math.floor(Date.now() / 1000 / QR_WINDOW_SECONDS);
  return `${subscriptionId}.${window}.${signQr(subscriptionId, secret, window)}`;
}

