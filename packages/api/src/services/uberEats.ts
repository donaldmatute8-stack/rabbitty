/**
 * ── Uber Eats Marketplace adapter ─────────────────────────────────────────
 *
 * Store / Menu / Order APIs de Uber Eats. Es DISTINTO de Uber Direct (última
 * milla): Direct manda al repartidor, Eats trae el pedido del marketplace.
 *
 * Todo lo que necesita secretos vive aquí (solo servidor):
 *   UBER_EATS_CLIENT_ID
 *   UBER_EATS_CLIENT_SECRET        (también es la llave de la firma del webhook)
 *   UBER_EATS_ENV                  "sandbox" | "production" (default sandbox)
 *
 * Sin credenciales aprobadas por Uber (NDA + licencia + whitelisting) el módulo
 * queda inerte: `uberEatsConfigured()` devuelve false y la UI lo dice.
 *
 * Nunca se registran tokens ni el client secret en logs.
 */

import crypto from "node:crypto";

const SANDBOX = {
  api: "https://test-api.uber.com",
  auth: "https://sandbox-auth.uber.com/oauth/v2/token",
};
const PRODUCTION = {
  api: "https://api.uber.com",
  auth: "https://auth.uber.com/oauth/v2/token",
};

/** Scopes de la integración POS (Store + Menu + Order). */
const SCOPES = [
  "eats.store",
  "eats.store.status.read",
  "eats.store.status.write",
  "eats.store.orders.read",
  "eats.store.orders.write",
  "eats.store.menu.read",
  "eats.store.menu.write",
].join(" ");

export type UberEatsEnv = "sandbox" | "production";

export function uberEatsEnv(): UberEatsEnv {
  return String(process.env.UBER_EATS_ENV || "sandbox").toLowerCase() === "production"
    ? "production"
    : "sandbox";
}

export function uberEatsConfigured(): boolean {
  return Boolean(process.env.UBER_EATS_CLIENT_ID && process.env.UBER_EATS_CLIENT_SECRET);
}

function baseUrls() {
  return uberEatsEnv() === "production" ? PRODUCTION : SANDBOX;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

/** Token OAuth (client_credentials). Devuelve null si no hay credenciales. */
export async function getUberEatsToken(): Promise<string | null> {
  if (!uberEatsConfigured()) return null;
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;

  const body = new URLSearchParams({
    client_id: String(process.env.UBER_EATS_CLIENT_ID),
    client_secret: String(process.env.UBER_EATS_CLIENT_SECRET),
    grant_type: "client_credentials",
    scope: SCOPES,
  });

  try {
    const res = await fetch(baseUrls().auth, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.warn("[UBER_EATS] token HTTP", res.status);
      return null;
    }
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) return null;
    cachedToken = {
      token: json.access_token,
      expiresAt: Date.now() + Math.max(60, Number(json.expires_in ?? 3600) - 60) * 1000,
    };
    return cachedToken.token;
  } catch (err) {
    console.warn("[UBER_EATS] token error:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * ── Firma del webhook ──
 * Uber manda `X-Uber-Signature` = HMAC-SHA256 hex (minúsculas) del **body crudo**
 * usando el client secret. Sin esto no se puede registrar el webhook en el
 * dashboard ni confiar en el origen.
 */
export function verifyUberSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.UBER_EATS_CLIENT_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const clean = signature.trim().toLowerCase();
  if (clean.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(clean), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** Comparación de bearer estático (compatibilidad con el webhook legacy). */
export function verifySharedSecret(provided: string | null): boolean {
  const expected = process.env.AGGREGATOR_WEBHOOK_SECRET;
  if (!expected || !provided) return false;
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function request<T = unknown>(
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  const token = await getUberEatsToken();
  if (!token) {
    return { ok: false, status: 0, error: "UBER_EATS_NO_CREDENTIALS" };
  }
  try {
    const res = await fetch(`${baseUrls().api}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
    const text = await res.text();
    const data = text ? (JSON.parse(text) as T) : undefined;
    if (!res.ok) {
      return { ok: false, status: res.status, data, error: text.slice(0, 300) };
    }
    return { ok: true, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Store ───────────────────────────────────────────────────────────────────

export async function getStoreStatus(storeId: string) {
  return request<{ status?: string }>("GET", `/v1/eats/stores/${encodeURIComponent(storeId)}/status`);
}

export async function setStoreStatus(storeId: string, status: "ONLINE" | "OFFLINE" | "PAUSED") {
  return request("PATCH", `/v1/eats/stores/${encodeURIComponent(storeId)}/status`, { status });
}

// ── Menu ────────────────────────────────────────────────────────────────────

export async function getStoreMenus(storeId: string) {
  return request("GET", `/v1/eats/stores/${encodeURIComponent(storeId)}/menus`);
}

/**
 * Publica el menú. El payload lo arma `buildUberEatsMenu()` con nuestro
 * catálogo; Uber valida precios, categorías y modificadores.
 */
export async function pushStoreMenu(storeId: string, menu: unknown) {
  return request("POST", `/v1/eats/stores/${encodeURIComponent(storeId)}/menus`, menu);
}

// ── Order ───────────────────────────────────────────────────────────────────

export async function acceptOrder(orderId: string) {
  return request("POST", `/v1/eats/orders/${encodeURIComponent(orderId)}/accept`);
}

export async function denyOrder(orderId: string, reason?: string) {
  return request("POST", `/v1/eats/orders/${encodeURIComponent(orderId)}/deny`, reason ? { reason } : {});
}

export async function markOrderReady(orderId: string) {
  return request("POST", `/v1/eats/orders/${encodeURIComponent(orderId)}/ready`);
}

export async function cancelOrder(orderId: string, reason?: string) {
  return request("POST", `/v1/eats/orders/${encodeURIComponent(orderId)}/cancel`, reason ? { reason } : {});
}
