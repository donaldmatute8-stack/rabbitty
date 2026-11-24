import crypto from "node:crypto";

/**
 * ── Invitaciones privadas de Rabbit Chair ────────────────────────────────────
 *
 * La landing vive en `/rabbit-chair?t=<token>`. El token es **sin estado**:
 *   base64url(JSON) + "." + HMAC-SHA256
 *
 * Payload:
 *   b   businessId
 *   n   nombre del negocio (para personalizar la página)
 *   t   "gift" (regalo por hito) | "upgrade" (venta)
 *   m   etiqueta libre del hito ("3 activaciones", "12 meses", …)
 *   exp epoch en segundos
 *
 * Secreto: `RABBIT_CHAIR_TOKEN_SECRET` (fallback `RABBITTY_API_SECRET`).
 * Rotarlo invalida todos los enlaces vigentes.
 */

export interface RabbitChairInvite {
  b: string;
  n: string;
  t: "gift" | "upgrade";
  m?: string;
  exp: number;
}

function secret(): string {
  return String(process.env.RABBIT_CHAIR_TOKEN_SECRET || process.env.RABBITTY_API_SECRET || "");
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex").slice(0, 24);
}

export function signRabbitChairInvite(invite: RabbitChairInvite): string {
  const payload = Buffer.from(JSON.stringify(invite)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyRabbitChairInvite(token: string | undefined | null): RabbitChairInvite | null {
  if (!token || !secret()) return null;
  const [payload, sig] = String(token).split(".");
  if (!payload || !sig) return null;

  const expected = sign(payload);
  try {
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as RabbitChairInvite;
    if (!data?.b || !data?.n || !data?.exp) return null;
    if (data.exp * 1000 < Date.now()) return null;
    if (data.t !== "gift" && data.t !== "upgrade") return null;
    return data;
  } catch {
    return null;
  }
}
