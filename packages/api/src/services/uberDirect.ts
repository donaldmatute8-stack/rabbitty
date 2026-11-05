/**
 * ── Uber Direct adapter ─────────────────────────────────────────────────
 *
 * Cotiza, crea y cancela entregas con Uber Direct. La API vive detrás de
 * nuestras propias tablas (`deliveries`) para que el resto del sistema siga
 * siendo proveedor-agnóstico.
 *
 * Credenciales (solo servidor): UBER_DIRECT_CLIENT_ID / _CLIENT_SECRET /
 * _CUSTOMER_ID. Nunca se exponen al cliente ni se registran en logs.
 */

const AUTH_URL = "https://auth.uber.com/oauth/v2/token";
const API_BASE = "https://api.uber.com/v1";

export interface UberAddress {
  street1?: string | null;
  street2?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  phone?: string | null;
  name?: string | null;
  lat?: number | null;
  lng?: number | null;
  notes?: string | null;
}

export interface UberQuote {
  quoteId: string;
  feeCents: number;
  currency: string;
  pickupMinutes: number;
  durationMinutes: number;
  dropoffEta: string | null;
  expiresAt: string | null;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

export function uberDirectConfigured(): boolean {
  return Boolean(
    process.env.UBER_DIRECT_CLIENT_ID &&
      process.env.UBER_DIRECT_CLIENT_SECRET &&
      process.env.UBER_DIRECT_CUSTOMER_ID,
  );
}

function customerId(): string {
  const id = process.env.UBER_DIRECT_CUSTOMER_ID;
  if (!id) throw new Error("UBER_DIRECT_CUSTOMER_ID no configurado");
  return id;
}

async function getToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) return cachedToken.token;

  const clientId = process.env.UBER_DIRECT_CLIENT_ID;
  const clientSecret = process.env.UBER_DIRECT_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Uber Direct sin credenciales");

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope: "eats.deliveries",
  });

  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(`Uber auth ${res.status}${data.error ? `: ${data.error}` : ""}`);
  }

  cachedToken = {
    token: data.access_token,
    expiresAt: now + Math.max(60, (data.expires_in ?? 3600) - 120) * 1000,
  };
  return cachedToken.token;
}

/** Nuestra dirección estructurada → JSON string que exige Uber. */
function toUberAddress(address: UberAddress): string {
  return JSON.stringify({
    street_address: [address.street1 || "", address.street2 || ""].filter(Boolean),
    city: address.city || "",
    state: address.state || "",
    zip_code: address.zip || "",
    country: (address.country || "MX").toUpperCase(),
  });
}

async function uberFetch(path: string, init: RequestInit = {}) {
  const token = await getToken();
  const res = await fetch(`${API_BASE}/customers/${customerId()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* respuesta no JSON */
  }
  if (!res.ok) {
    const detail =
      json && typeof json === "object" && "message" in json
        ? String((json as { message?: unknown }).message)
        : text.slice(0, 200);
    throw new Error(`Uber Direct ${res.status}${detail ? `: ${detail}` : ""}`);
  }
  return json as Record<string, unknown>;
}

export async function uberQuote(params: {
  pickup: UberAddress;
  dropoff: UberAddress;
}): Promise<UberQuote> {
  const data = await uberFetch("/delivery_quotes", {
    method: "POST",
    body: JSON.stringify({
      pickup_address: toUberAddress(params.pickup),
      dropoff_address: toUberAddress(params.dropoff),
    }),
  });

  return {
    quoteId: String(data.id ?? ""),
    feeCents: Number(data.fee ?? 0),
    currency: String(data.currency_type ?? data.currency ?? "MXN").toUpperCase(),
    pickupMinutes: Number(data.pickup_duration ?? 0),
    durationMinutes: Number(data.duration ?? 0),
    dropoffEta: typeof data.dropoff_eta === "string" ? data.dropoff_eta : null,
    expiresAt: typeof data.expires === "string" ? data.expires : null,
  };
}

export async function uberCreateDelivery(params: {
  quoteId: string;
  pickup: UberAddress;
  dropoff: UberAddress;
  manifestItems: Array<{ name: string; quantity: number }>;
  externalId?: string;
}): Promise<{
  id: string;
  status: string;
  trackingUrl: string | null;
  feeCents: number | null;
  raw: Record<string, unknown>;
}> {
  const data = await uberFetch("/deliveries", {
    method: "POST",
    body: JSON.stringify({
      quote_id: params.quoteId,
      pickup_name: params.pickup.name || "Rabbitty",
      pickup_phone_number: params.pickup.phone || undefined,
      pickup_latitude: params.pickup.lat ?? undefined,
      pickup_longitude: params.pickup.lng ?? undefined,
      pickup_address: toUberAddress(params.pickup),
      pickup_notes: params.pickup.notes || undefined,
      dropoff_name: params.dropoff.name || undefined,
      dropoff_phone_number: params.dropoff.phone || undefined,
      dropoff_latitude: params.dropoff.lat ?? undefined,
      dropoff_longitude: params.dropoff.lng ?? undefined,
      dropoff_address: toUberAddress(params.dropoff),
      dropoff_notes: params.dropoff.notes || undefined,
      manifest_items: params.manifestItems.map((item) => ({
        name: item.name.slice(0, 80),
        quantity: item.quantity,
        size: "small",
      })),
      external_id: params.externalId,
    }),
  });

  return {
    id: String(data.id ?? ""),
    status: String(data.status ?? "pending"),
    trackingUrl: typeof data.tracking_url === "string" ? data.tracking_url : null,
    feeCents: typeof data.fee === "number" ? data.fee : null,
    raw: data,
  };
}

export async function uberCancelDelivery(deliveryId: string): Promise<void> {
  await uberFetch(`/deliveries/${encodeURIComponent(deliveryId)}/cancel`, { method: "POST" });
}

/** Estado de Uber → estado de Rabbitty. */
export function mapUberStatus(status: string): string {
  switch (status) {
    case "pending":
      // Creada, sin courier asignado todavía.
      return "REQUESTED";
    case "pickup":
      // Courier en camino al local.
      return "ASSIGNED";
    case "pickup_complete":
    case "dropoff":
      return "PICKED_UP";
    case "delivered":
      return "DELIVERED";
    case "canceled":
    case "returned":
      return "CANCELLED";
    case "failed":
      return "FAILED";
    default:
      return "ASSIGNED";
  }
}
