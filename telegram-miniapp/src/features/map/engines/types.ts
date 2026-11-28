/**
 * ── Contrato del motor de mapa ──────────────────────────────────────────────
 *
 * La UI (HUD, tarjeta, filtros, copiloto) no sabe qué motor la dibuja.
 * Hoy hay dos implementaciones del mismo contrato:
 *
 *   maplibre  → OpenFreeMap (vectorial, sin key, con clustering)  ← por defecto
 *   leaflet   → CARTO/OSM raster (respaldo y salida de emergencia)
 *
 * Se elige con `NEXT_PUBLIC_MAP_ENGINE=maplibre|leaflet`. Si el dispositivo no
 * tiene WebGL (o MapLibre falla), se cae solo a Leaflet sin tocar la UI.
 */

export interface MapBusiness {
  id: string;
  name?: string;
  user?: string;
  category?: string;
  device?: string;
  address?: string;
  lat?: string | number | null;
  lng?: string | number | null;
  rewardPercentage?: number;
  reward_percentage?: number;
  acceptsBunz?: boolean;
  accepts_bunz?: boolean;
  givesBunz?: boolean;
  gives_bunz?: boolean;
  hasStockOffer?: boolean;
  bunzBalance?: number;
  distance?: number;
  image?: string;
  imageUrl?: string;
  logoUrl?: string;
  startTime?: string;
  endTime?: string;
}

export interface MapEngineOptions {
  container: HTMLElement;
  isDark: boolean;
  onSelect: (business: MapBusiness) => void;
  /** Toque en el mapa vacío: se cierra la tarjeta del spot. */
  onDeselect?: () => void;
  onReady: () => void;
  /** Aviso de movimiento programático (fly/fit): la UI muestra "buscando". */
  onBusy?: (durationMs: number) => void;
}

export interface MapEngine {
  readonly kind: 'maplibre' | 'leaflet';
  destroy(): void;
  invalidateSize(): void;
  flyTo(lat: number, lng: number, zoom?: number, durationMs?: number): void;
  fitBusinesses(items: MapBusiness[]): void;
  setTheme(isDark: boolean): void;
  setUser(lat: number | null, lng: number | null): void;
  setBusinesses(items: MapBusiness[], selectedId: string | null): void;
}

/** Coordenada válida o null (el feed a veces manda strings vacíos). */
export function coordsOf(b: MapBusiness): { lat: number; lng: number } | null {
  const lat = typeof b.lat === 'number' ? b.lat : Number(b.lat);
  const lng = typeof b.lng === 'number' ? b.lng : Number(b.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}
