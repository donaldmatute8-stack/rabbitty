/**
 * ── Cotización de envío ────────────────────────────────────────────────────
 *
 * Fuente única del costo de entrega. La usan la app (para mostrarlo antes de
 * confirmar) y el checkout (para cobrarlo de verdad, sin confiar en el cliente).
 *
 * Orden de decisión:
 * 1. `freeOver` alcanzado → gratis (y se dice).
 * 2. `mode: 'PROVIDER'` y el proveedor está configurado → cotización real
 *    (Uber Direct). Si el proveedor falla, cae a tarifa plana en vez de romper
 *    la compra.
 * 3. `baseFee` configurado → tarifa plana del negocio.
 * 4. Sin configuración → `UNCONFIGURED`: no se cobra, pero la app lo muestra como
 *    "por confirmar". Nunca envío gratis silencioso.
 *
 * El POS sigue cobrando la entrega al asignar repartidor cuando nadie lo cobró
 * antes (`alreadyCharged` en `pos.ts`), así que este cálculo no duplica el cobro.
 */

import { uberDirectConfigured, uberQuote, type UberAddress } from "./uberDirect";

export interface DeliveryZone {
  /** Radio de la zona en km (se elige la primera que alcance). */
  maxKm: number;
  /** Tarifa en MXN para esa zona. */
  fee: number;
}

export interface DeliveryConfig {
  enabled?: boolean;
  mode?: "FLAT" | "PROVIDER";
  /** MXN */
  baseFee?: number;
  /** Subtotal (MXN) a partir del cual el envío es gratis. */
  freeOver?: number;
  etaMinutes?: number;
  notes?: string;
  /**
   * Zonas por distancia desde la sucursal. Se aplican **antes** que la tarifa
   * fija: si la dirección trae coordenadas y cae en una zona, manda la zona.
   * Sin coordenadas se usa `baseFee` (nunca se inventa una distancia).
   */
  zones?: DeliveryZone[];
}

export type DeliveryFeeSource = "FREE" | "PROVIDER" | "FLAT" | "UNCONFIGURED" | "DISABLED";

export interface DeliveryQuote {
  fee: number;
  currency: "MXN";
  source: DeliveryFeeSource;
  provider?: "UBER_DIRECT" | "MANUAL";
  etaMinutes: number | null;
  /** Texto corto para la UI ("Gratis", "Por confirmar en el local"…). */
  label: string;
  /** Id de cotización del proveedor, si lo hubo (para crearla al asignar). */
  providerQuoteId?: string;
  expiresAt?: string | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Distancia en km entre dos puntos (haversine). */
function distanceKm(
  a: { lat?: number | null; lng?: number | null },
  b: { lat?: number | null; lng?: number | null },
): number | null {
  if (
    typeof a.lat !== "number" || typeof a.lng !== "number" ||
    typeof b.lat !== "number" || typeof b.lng !== "number"
  ) {
    return null;
  }
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Zona que cubre la distancia; la más barata de las que alcanzan. */
function zoneFee(config: DeliveryConfig, km: number | null): number | null {
  const zones = Array.isArray(config.zones) ? config.zones : [];
  if (km == null || zones.length === 0) return null;
  const matching = zones
    .filter(
      (z): z is DeliveryZone =>
        typeof z?.maxKm === "number" && typeof z?.fee === "number" && km <= z.maxKm,
    )
    .sort((a, b) => a.maxKm - b.maxKm);
  const best = matching[0];
  return best ? round2(best.fee) : null;
}

function normalizeConfig(raw: unknown): DeliveryConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const cfg = raw as DeliveryConfig;
  const hasFee = typeof cfg.baseFee === "number" && cfg.baseFee > 0;
  const hasProvider = cfg.mode === "PROVIDER";
  if (!hasFee && !hasProvider) return null;
  return cfg;
}

export interface QuoteDeliveryInput {
  /** `restaurants.deliveryConfig` */
  config: unknown;
  /** Subtotal de los productos (sin propina ni envío). */
  subtotal: number;
  /** Dirección de entrega ya normalizada (para cotizar con el proveedor). */
  dropoff?: UberAddress | null;
  /** Origen: la sucursal. */
  pickup?: UberAddress | null;
}

export async function quoteDelivery({
  config,
  subtotal,
  dropoff,
  pickup,
}: QuoteDeliveryInput): Promise<DeliveryQuote> {
  const cfg = normalizeConfig(config);

  if (!cfg) {
    return {
      fee: 0,
      currency: "MXN",
      source: "UNCONFIGURED",
      etaMinutes: null,
      label: "Envío por confirmar en el local",
    };
  }

  if (cfg.enabled === false) {
    return {
      fee: 0,
      currency: "MXN",
      source: "DISABLED",
      etaMinutes: null,
      label: "Este negocio no hace envíos por ahora",
    };
  }

  if (typeof cfg.freeOver === "number" && cfg.freeOver > 0 && subtotal >= cfg.freeOver) {
    return {
      fee: 0,
      currency: "MXN",
      source: "FREE",
      etaMinutes: cfg.etaMinutes ?? null,
      label: "Envío gratis",
    };
  }

  if (cfg.mode === "PROVIDER" && uberDirectConfigured() && dropoff) {
    try {
      const quote = await uberQuote({ pickup: pickup ?? {}, dropoff });
      const fee = round2(quote.feeCents / 100);
      return {
        fee,
        currency: "MXN",
        source: "PROVIDER",
        provider: "UBER_DIRECT",
        etaMinutes: quote.pickupMinutes + quote.durationMinutes || cfg.etaMinutes || null,
        label: "Envío calculado",
        providerQuoteId: quote.quoteId,
        expiresAt: quote.expiresAt,
      };
    } catch (error) {
      // El proveedor caído no puede tumbar la venta: se cae a tarifa plana.
      console.warn(
        "[delivery] cotización del proveedor falló, usando tarifa plana:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  // Zonas por distancia (si hay coordenadas en origen y destino)
  const km = distanceKm(pickup ?? {}, dropoff ?? {});
  const byZone = zoneFee(cfg, km);
  if (byZone !== null) {
    return {
      fee: byZone,
      currency: "MXN",
      source: "FLAT",
      etaMinutes: cfg.etaMinutes ?? null,
      label: km != null ? `Envío · ${km.toFixed(1)} km` : "Envío a domicilio",
    };
  }

  const flat = typeof cfg.baseFee === "number" && cfg.baseFee > 0 ? round2(cfg.baseFee) : 0;
  if (flat <= 0) {
    return {
      fee: 0,
      currency: "MXN",
      source: "UNCONFIGURED",
      etaMinutes: cfg.etaMinutes ?? null,
      label: "Envío por confirmar en el local",
    };
  }

  return {
    fee: flat,
    currency: "MXN",
    source: "FLAT",
    etaMinutes: cfg.etaMinutes ?? null,
    label: "Envío a domicilio",
  };
}

/** ¿Este pedido necesita dirección? (productos de tienda que se envían) */
export function requiresAddressForItems(
  items: Array<{ requiresShipping?: boolean | null }>,
): boolean {
  return items.some((item) => Boolean(item.requiresShipping));
}
