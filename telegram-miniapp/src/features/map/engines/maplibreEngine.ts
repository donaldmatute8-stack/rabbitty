/**
 * ── Motor MapLibre + OpenFreeMap ────────────────────────────────────────────
 *
 * Por qué: los tiles vectoriales pesan mucho menos que las imágenes raster,
 * se dibujan en GPU y no necesitan API key (OpenFreeMap no cobra ni limita).
 * El estilo es nuestro (`style/rabbittyStyle.ts`), así que el color del mapa se
 * cambia en un solo archivo.
 *
 * Escala (pensado para muchas sucursales):
 * · clustering en el propio motor → a zoom de ciudad no se crean miles de nodos
 * · pines DOM solo para lo que cabe en pantalla (máx. 80) y se reutilizan
 * · `setData` se salta si solo cambió la selección
 *
 * Seguridad: no hay credenciales en el cliente; el HTML del pin se sanea en
 * `markers.ts`.
 */

import maplibregl from 'maplibre-gl';
import type { GeoJSONSource, LngLatBoundsLike, Map as MLMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { markerHTML, pinColor, userMarkerHTML } from '../markers';
import { rabbittyMapStyle } from '../style/rabbittyStyle';
import { coordsOf, type MapBusiness, type MapEngine, type MapEngineOptions } from './types';

/** Tope de pines DOM simultáneos: más allá, el cluster ya los agrupa. */
const MAX_DOM_MARKERS = 80;
const SOURCE_SPOTS = 'rabbitty-spots';
const SOURCE_USER = 'rabbitty-user-area';

interface MarkerEntry {
  marker: maplibregl.Marker;
  signature: string;
}

function emptyCollection() {
  return { type: 'FeatureCollection' as const, features: [] as GeoJSON.Feature[] };
}

function toCollection(items: MapBusiness[]) {
  const features: GeoJSON.Feature[] = [];
  for (const b of items) {
    const pos = coordsOf(b);
    if (!pos) continue;
    features.push({
      type: 'Feature',
      properties: { id: b.id, color: pinColor(b) },
      geometry: { type: 'Point', coordinates: [pos.lng, pos.lat] },
    });
  }
  return { type: 'FeatureCollection' as const, features };
}

/** Círculo de radio en metros como polígono (para el halo del usuario). */
function circlePolygon(lat: number, lng: number, meters: number, steps = 48) {
  const ring: [number, number][] = [];
  const earth = 6378137;
  const dLat = (meters / earth) * (180 / Math.PI);
  const dLng = dLat / Math.cos((lat * Math.PI) / 180);
  for (let i = 0; i <= steps; i += 1) {
    const angle = (i / steps) * 2 * Math.PI;
    ring.push([lng + dLng * Math.cos(angle), lat + dLat * Math.sin(angle)]);
  }
  return {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        properties: {},
        geometry: { type: 'Polygon' as const, coordinates: [ring] },
      },
    ],
  };
}

export async function createMapLibreEngine(opts: MapEngineOptions): Promise<MapEngine> {
  const { container, onSelect, onReady } = opts;

  let isDark = opts.isDark;
  let businesses: MapBusiness[] = [];
  let selectedId: string | null = null;
  let user: { lat: number; lng: number } | null = null;
  let dataSignature = '';
  let ready = false;
  let disposed = false;

  const markers = new Map<string, MarkerEntry>();
  let userMarker: maplibregl.Marker | null = null;

  const map: MLMap = new maplibregl.Map({
    container,
    style: rabbittyMapStyle(isDark),
    center: [0, 0],
    zoom: 13,
    minZoom: 2,
    maxZoom: 19,
    fadeDuration: 0,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    antialias: false,
    attributionControl: false,
    // Sin copias del mundo: menos tiles en memoria y sin confusión en bordes.
    renderWorldCopies: false,
  });

  // ── Capas de datos (se recrean solas si cambia el estilo) ──────────────────
  const ensureLayers = () => {
    if (disposed) return;

    if (!map.getSource(SOURCE_SPOTS)) {
      map.addSource(SOURCE_SPOTS, {
        type: 'geojson',
        data: toCollection(businesses),
        cluster: true,
        clusterRadius: 52,
        clusterMaxZoom: 15,
        clusterMinPoints: 2,
        generateId: true,
      });

      // Cluster: círculo con el rosa de la marca y el conteo dentro.
      map.addLayer({
        id: 'spots-cluster',
        type: 'circle',
        source: SOURCE_SPOTS,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#E91E63',
          'circle-radius': ['step', ['get', 'point_count'], 17, 10, 23, 40, 29],
          'circle-opacity': 0.92,
          'circle-stroke-color': isDark ? '#0B0712' : '#FFFFFF',
          'circle-stroke-width': 2.5,
        },
      });
      map.addLayer({
        id: 'spots-cluster-count',
        type: 'symbol',
        source: SOURCE_SPOTS,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 12,
        },
        paint: { 'text-color': '#FFFFFF' },
      });
      dataSignature = '';
    }

    if (!map.getSource(SOURCE_USER)) {
      map.addSource(SOURCE_USER, { type: 'geojson', data: emptyCollection() });
      map.addLayer({
        id: 'user-area-fill',
        type: 'fill',
        source: SOURCE_USER,
        paint: { 'fill-color': '#E91E63', 'fill-opacity': isDark ? 0.1 : 0.12 },
      });
      map.addLayer({
        id: 'user-area-line',
        type: 'line',
        source: SOURCE_USER,
        paint: {
          'line-color': '#E91E63',
          'line-opacity': 0.55,
          'line-width': 1.2,
          'line-dasharray': [2, 2],
        },
      });
    }

    pushData();
    drawUser();
  };

  const pushData = () => {
    const src = map.getSource(SOURCE_SPOTS) as GeoJSONSource | undefined;
    if (!src) return;
    const signature = businesses
      .map((b) => {
        const p = coordsOf(b);
        return p ? `${b.id}:${p.lat.toFixed(5)}:${p.lng.toFixed(5)}` : '';
      })
      .join('|');
    // Cambiar solo la selección no debe reenviar el dataset al worker.
    if (signature === dataSignature) return;
    dataSignature = signature;
    src.setData(toCollection(businesses));
  };

  const drawUser = () => {
    const src = map.getSource(SOURCE_USER) as GeoJSONSource | undefined;
    if (src) src.setData(user ? circlePolygon(user.lat, user.lng, 90) : emptyCollection());

    if (!user) {
      userMarker?.remove();
      userMarker = null;
      return;
    }
    if (!userMarker) {
      const el = document.createElement('div');
      el.innerHTML = userMarkerHTML();
      el.style.width = '28px';
      el.style.height = '28px';
      userMarker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([user.lng, user.lat])
        .addTo(map);
    } else {
      userMarker.setLngLat([user.lng, user.lat]);
    }
  };

  // ── Pines DOM: solo lo visible, reutilizando nodos ─────────────────────────
  const syncMarkers = () => {
    if (disposed || !map.isStyleLoaded()) return;

    const bounds = map.getBounds();
    const center = map.getCenter();

    // Un punto dentro de un cluster ya está representado por el círculo: si
    // además pintamos su pin, se encima y se ve sucio. Proyectamos los clusters
    // visibles y descartamos los pines que caen dentro.
    const clusterHits: { x: number; y: number; r: number }[] = [];
    for (const f of map.queryRenderedFeatures({ layers: ['spots-cluster'] })) {
      const count = Number(f.properties?.point_count || 2);
      const r = count >= 40 ? 29 : count >= 10 ? 23 : 17;
      const pt = map.project((f.geometry as GeoJSON.Point).coordinates as [number, number]);
      clusterHits.push({ x: pt.x, y: pt.y, r: r + 6 });
    }
    const inCluster = (lng: number, lat: number) => {
      if (clusterHits.length === 0) return false;
      const p = map.project([lng, lat]);
      return clusterHits.some((c) => (p.x - c.x) ** 2 + (p.y - c.y) ** 2 <= c.r * c.r);
    };

    const visible = businesses
      .map((b) => {
        const pos = coordsOf(b);
        if (!pos) return null;
        if (!bounds.contains([pos.lng, pos.lat])) return null;
        if (inCluster(pos.lng, pos.lat)) return null;
        return {
          b,
          pos,
          d: Math.abs(pos.lat - center.lat) + Math.abs(pos.lng - center.lng),
        };
      })
      .filter((v): v is { b: MapBusiness; pos: { lat: number; lng: number }; d: number } => v !== null)
      .sort((a, z) => a.d - z.d)
      .slice(0, MAX_DOM_MARKERS);

    const keep = new Set(visible.map((v) => v.b.id));
    for (const [id, entry] of markers) {
      if (!keep.has(id)) {
        entry.marker.remove();
        markers.delete(id);
      }
    }

    for (const v of visible) {
      const isSel = selectedId === v.b.id;
      const signature = `${isSel ? 1 : 0}|${isDark ? 1 : 0}|${v.b.logoUrl || ''}|${v.b.rewardPercentage ?? v.b.reward_percentage ?? 0}`;
      const existing = markers.get(v.b.id);

      if (existing) {
        if (existing.signature !== signature) {
          existing.marker.getElement().innerHTML = markerHTML(v.b, isSel, isDark);
          existing.signature = signature;
        }
        continue;
      }

      const el = document.createElement('div');
      el.style.width = '64px';
      el.style.height = '80px';
      el.style.cursor = 'pointer';
      el.style.willChange = 'transform';
      el.innerHTML = markerHTML(v.b, isSel, isDark);

      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        onSelect(v.b);
        map.easeTo({ center: [v.pos.lng, v.pos.lat - 0.0018], duration: 420 });
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([v.pos.lng, v.pos.lat])
        .addTo(map);

      markers.set(v.b.id, { marker, signature });
    }
  };

  // El movimiento del mapa se agrupa en un frame (no en cada evento).
  let frame = 0;
  const scheduleSync = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      syncMarkers();
    });
  };

  map.on('moveend', scheduleSync);
  map.on('zoomend', scheduleSync);
  map.on('resize', scheduleSync);

  map.on('style.load', () => {
    ensureLayers();
    syncMarkers();
  });

  map.on('load', () => {
    if (disposed) return;
    ensureLayers();
    syncMarkers();
    // `load` solo significa "estilo listo": todavía puede no haber un solo tile
    // pintado. El loader se quita con el primer `idle` (tiles dibujados) y, si
    // el servidor tarda, con el tope de abajo.
    map.once('idle', () => {
      if (disposed || ready) return;
      ready = true;
      onReady();
      syncMarkers();
    });
  });

  // Cluster: al tocar, se acerca hasta desagrupar.
  map.on('click', 'spots-cluster', (e) => {
    const feature = map.queryRenderedFeatures(e.point, { layers: ['spots-cluster'] })[0];
    if (!feature) return;
    const clusterId = feature.properties?.cluster_id as number | undefined;
    const src = map.getSource(SOURCE_SPOTS) as GeoJSONSource | undefined;
    const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
    if (!src || clusterId == null) return;
    void src.getClusterExpansionZoom(clusterId).then((zoom) => {
      map.easeTo({ center: coords, zoom: Math.min(zoom + 0.25, 18), duration: 500 });
    });
  });

  // Toque en el fondo: cierra la tarjeta (sin disparar si fue un cluster).
  map.on('click', (e) => {
    const hits = map.queryRenderedFeatures(e.point, { layers: ['spots-cluster'] });
    if (hits.length > 0) return;
    opts.onDeselect?.();
  });

  map.on('mouseenter', 'spots-cluster', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'spots-cluster', () => { map.getCanvas().style.cursor = ''; });

  // Si el estilo tarda o falla, no dejamos la UI en blanco.
  const readyTimeout = window.setTimeout(() => {
    if (!ready && !disposed) {
      ready = true;
      onReady();
    }
  }, 3500);

  return {
    kind: 'maplibre',

    destroy() {
      disposed = true;
      window.clearTimeout(readyTimeout);
      if (frame) cancelAnimationFrame(frame);
      markers.forEach((entry) => entry.marker.remove());
      markers.clear();
      userMarker?.remove();
      userMarker = null;
      map.remove();
    },

    invalidateSize() {
      map.resize();
    },

    flyTo(lat, lng, zoom = 15, durationMs = 1200) {
      map.flyTo({ center: [lng, lat], zoom, duration: durationMs, essential: true });
    },

    fitBusinesses(items) {
      const pts = items.map(coordsOf).filter((p): p is { lat: number; lng: number } => p !== null);
      if (pts.length === 0) return;
      if (pts.length === 1) {
        map.flyTo({ center: [pts[0].lng, pts[0].lat], zoom: 16, duration: 900 });
        return;
      }
      let minLat = pts[0].lat, maxLat = pts[0].lat, minLng = pts[0].lng, maxLng = pts[0].lng;
      for (const p of pts) {
        minLat = Math.min(minLat, p.lat);
        maxLat = Math.max(maxLat, p.lat);
        minLng = Math.min(minLng, p.lng);
        maxLng = Math.max(maxLng, p.lng);
      }
      const bounds: LngLatBoundsLike = [[minLng, minLat], [maxLng, maxLat]];
      map.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 700 });
    },

    setTheme(dark) {
      if (dark === isDark) return;
      isDark = dark;
      map.setStyle(rabbittyMapStyle(dark), { diff: false });
    },

    setUser(lat, lng) {
      if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        user = null;
      } else {
        user = { lat, lng };
      }
      drawUser();
    },

    setBusinesses(items, sel) {
      businesses = items;
      selectedId = sel;
      pushData();
      syncMarkers();
    },
  };
}
