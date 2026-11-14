/**
 * Fábrica del motor de mapa.
 *
 * Estado actual (decisión conservadora): **Leaflet es el motor por defecto**
 * porque es el que está probado en producción. MapLibre + OpenFreeMap queda
 * disponible con `NEXT_PUBLIC_MAP_ENGINE=maplibre` hasta que se valide en
 * dispositivo; si al activarlo no logra pintar en unos segundos, se cambia solo
 * a Leaflet.
 *
 * Las dos implementaciones se cargan en diferido: el bundle inicial no lleva
 * ninguna.
 */

import type { MapEngine, MapEngineOptions } from './types';

export type { MapEngine, MapEngineOptions } from './types';

/** Si MapLibre no reporta listo en este tiempo, se considera caído. */
const MAPLIBRE_READY_TIMEOUT_MS = 3500;

export async function createMapEngine(opts: MapEngineOptions): Promise<MapEngine> {
  const forced = process.env.NEXT_PUBLIC_MAP_ENGINE;

  if (forced !== 'maplibre') {
    const { createLeafletEngine } = await import('./leafletEngine');
    return createLeafletEngine(opts);
  }

  try {
    const { createMapLibreEngine } = await import('./maplibreEngine');
    const ready = new Promise<void>((resolve) => {
      void opts.onReady;
      resolve();
    });
    void ready;

    const engine = await createMapLibreEngine(opts);

    // Espera corta: si el canvas no llega a primer render, devolvemos Leaflet.
    const painted = await Promise.race([
      new Promise<boolean>((resolve) => {
        const started = Date.now();
        const tick = () => {
          if (engine.kind !== 'maplibre') return resolve(true);
          // `invalidateSize` fuerza al motor a recalcular; si el contenedor
          // tiene tamaño, el canvas existe y el mapa puede pintar.
          const canvas = opts.container.querySelector('canvas');
          if (canvas && (canvas as HTMLCanvasElement).width > 0) return resolve(true);
          if (Date.now() - started > MAPLIBRE_READY_TIMEOUT_MS) return resolve(false);
          window.setTimeout(tick, 150);
        };
        window.setTimeout(tick, 150);
      }),
    ]);

    if (painted) return engine;

    console.warn('[map] MapLibre no pintó a tiempo: usando Leaflet.');
    engine.destroy();
    const { createLeafletEngine } = await import('./leafletEngine');
    return createLeafletEngine(opts);
  } catch (err) {
    // Sin WebGL, worker bloqueado o tile server caído: no dejamos sin mapa.
    console.warn('[map] MapLibre no disponible, respaldo Leaflet:', err);
    const { createLeafletEngine } = await import('./leafletEngine');
    return createLeafletEngine(opts);
  }
}
