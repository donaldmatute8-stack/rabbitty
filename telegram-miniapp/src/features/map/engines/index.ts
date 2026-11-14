/**
 * Fábrica del motor de mapa.
 *
 * maplibre (OpenFreeMap) por defecto · leaflet como respaldo o por bandera.
 * Las dos implementaciones se cargan en diferido: el bundle inicial no lleva
 * ninguna (~90 KB menos hasta que abres el mapa).
 */

import type { MapEngine, MapEngineOptions } from './types';

export type { MapEngine, MapEngineOptions } from './types';

export async function createMapEngine(opts: MapEngineOptions): Promise<MapEngine> {
  const forced = process.env.NEXT_PUBLIC_MAP_ENGINE;

  if (forced === 'leaflet') {
    const { createLeafletEngine } = await import('./leafletEngine');
    return createLeafletEngine(opts);
  }

  try {
    const { createMapLibreEngine } = await import('./maplibreEngine');
    return await createMapLibreEngine(opts);
  } catch (err) {
    // Sin WebGL, driver roto o tile server caído: no dejamos al usuario sin mapa.
    console.warn('[map] MapLibre no disponible, respaldo Leaflet:', err);
    const { createLeafletEngine } = await import('./leafletEngine');
    return createLeafletEngine(opts);
  }
}
