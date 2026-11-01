/**
 * ── FX service ── Tipo de cambio USD/MXN configurado por el admin.
 * Modo MANUAL: usa la tasa fija guardada en `restaurants.usdRate`.
 * Modo AUTO: la refresca desde una API gratuita (open.er-api.com, sin key)
 * con caché de 24h en la misma fila; ante fallo de red usa el último valor.
 */

const FX_API_URL = "https://open.er-api.com/v6/latest/USD";
const FX_TTL_MS = 24 * 60 * 60 * 1000;

export interface UsdRateInfo {
  rate: number;
  mode: "AUTO" | "MANUAL";
  source: "manual" | "live-api" | "cached" | "fallback";
  updatedAt: Date | null;
}

const FALLBACK_RATE = 18.0;

export async function getUsdMxnRate(
  restaurantRow: { usdRateMode?: string | null; usdRate?: number | null; usdRateUpdatedAt?: Date | null },
): Promise<UsdRateInfo> {
  const mode = (restaurantRow.usdRateMode as "AUTO" | "MANUAL") || "AUTO";
  const stored = restaurantRow.usdRate && Number(restaurantRow.usdRate) > 0 ? Number(restaurantRow.usdRate) : null;
  const updatedAt = restaurantRow.usdRateUpdatedAt ?? null;

  if (mode === "MANUAL") {
    return { rate: stored ?? FALLBACK_RATE, mode, source: "manual", updatedAt };
  }

  const fresh = updatedAt && Date.now() - new Date(updatedAt).getTime() < FX_TTL_MS;
  if (fresh && stored) {
    return { rate: stored, mode, source: "cached", updatedAt };
  }

  try {
    const res = await fetch(FX_API_URL, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = (await res.json()) as { result?: string; rates?: Record<string, number> };
      const mxn = data?.rates?.MXN;
      if (data?.result === "success" && typeof mxn === "number" && mxn > 1 && mxn < 100) {
        return { rate: Math.round(mxn * 1000) / 1000, mode, source: "live-api", updatedAt: null };
      }
    }
  } catch { /* sin red: cae a caché/fallback */ }

  return { rate: stored ?? FALLBACK_RATE, mode, source: stored ? "cached" : "fallback", updatedAt };
}

/** Convierte un monto MXN → USD redondeado a 2 decimales. */
export function mxnToUsd(mxn: number, rate: number): number {
  return Math.round((mxn / rate) * 100) / 100;
}

/** Lee la tasa del restaurante (por id) — helper para routers. */
export async function getUsdRateByRestaurant(
  restaurantDb: { select: (...a: unknown[]) => any },
  restaurantId: string,
): Promise<UsdRateInfo> {
  const { restaurants } = await import("@rabbitty/database-restaurant/schema");
  const { eq } = await import("drizzle-orm");
  const [row] = await restaurantDb
    .select({
      usdRateMode: restaurants.usdRateMode,
      usdRate: restaurants.usdRate,
      usdRateUpdatedAt: restaurants.usdRateUpdatedAt,
    })
    .from(restaurants)
    .where(eq(restaurants.id, restaurantId))
    .limit(1);
  return getUsdMxnRate(row ?? {});
}

/** Convierte MXN→USD para el restaurante y persiste la tasa si vino fresca de la API. */
export async function resolveUsdRate(
  restaurantDb: any,
  restaurantId: string,
): Promise<{ rate: number; info: UsdRateInfo }> {
  const info = await getUsdRateByRestaurant(restaurantDb, restaurantId);
  // Persistir caché de la tasa viva (AUTO) para modo sin red posterior
  if (info.source === "live-api" && info.rate > 0) {
    const { restaurants } = await import("@rabbitty/database-restaurant/schema");
    const { eq } = await import("drizzle-orm");
    try {
      await restaurantDb
        .update(restaurants)
        .set({ usdRate: info.rate, usdRateUpdatedAt: new Date() })
        .where(eq(restaurants.id, restaurantId));
    } catch { /* best-effort: el consumo sigue con la tasa en memoria */ }
  }
  return { rate: info.rate, info };
}