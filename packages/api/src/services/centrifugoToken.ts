/**
 * ── Tokens de Centrifugo (Fase 0C-5) ───────────────────────────────────────
 *
 * Centrifugo está configurado con `allow_subscribe_for_client: false` en el
 * namespace `biz`, así que el cliente necesita dos JWT firmados por nosotros:
 *
 *  · conexión  → { sub, exp }
 *  · suscripción → { sub, channel, exp }
 *
 * El canal NO se acepta del cliente: se construye aquí a partir de la sucursal
 * y la estación ya validadas por el contexto tRPC. Así un token no puede
 * suscribirse al canal de otro tenant aunque adivine el nombre.
 */

import crypto from "node:crypto";

const TOKEN_TTL_SECONDS = 3600;

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function sign(payload: Record<string, unknown>, secret: string): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  const signature = base64url(crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest());
  return `${header}.${body}.${signature}`;
}

export function isCentrifugoConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.CENTRIFUGO_TOKEN_SECRET);
}

/** Canal determinista por tenant + sucursal + estación. */
export function stationChannel(businessId: string | null, branchId: string, stationId: string): string {
  return `biz:${businessId || "unknown"}:branch:${branchId}:station:${stationId}`;
}

export function issueStationTokens(input: {
  businessId: string | null;
  branchId: string;
  stationId: string;
  /** Quién se suscribe (usuario o terminal). Solo para trazabilidad. */
  subject: string;
  secret?: string;
  now?: number;
}): { channel: string; token: string; subscriptionToken: string; expiresIn: number } {
  const secret = input.secret ?? process.env.CENTRIFUGO_TOKEN_SECRET;
  if (!secret) throw new Error("CENTRIFUGO_NOT_CONFIGURED");

  const now = input.now ?? Math.floor(Date.now() / 1000);
  const exp = now + TOKEN_TTL_SECONDS;
  const channel = stationChannel(input.businessId, input.branchId, input.stationId);

  return {
    channel,
    // El `sub` de suscripción DEBE ser el mismo que el de conexión.
    token: sign({ sub: input.subject, iat: now, exp }, secret),
    subscriptionToken: sign({ sub: input.subject, channel, iat: now, exp }, secret),
    expiresIn: TOKEN_TTL_SECONDS,
  };
}
