/**
 * ── Motor Leaflet (respaldo) ────────────────────────────────────────────────
 *
 * Se usa si el dispositivo no tiene WebGL, si MapLibre falla al montar, o si
 * alguien pone `NEXT_PUBLIC_MAP_ENGINE=leaflet` para volver al mapa anterior
 * sin tocar la UI.
 *
 * Tiles: CARTO solo si hay `NEXT_PUBLIC_CARTO_KEY`; si no, OSM (y en tema
 * oscuro se invierte por CSS, que es lo que ya estaba en producción).
 */

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { markerHTML, userMarkerHTML } from '../markers';
import { coordsOf, type MapBusiness, type MapEngine, type MapEngineOptions } from './types';

const cartoKey = process.env.NEXT_PUBLIC_CARTO_KEY;
const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const DARK_TILE_URL = cartoKey
  ? `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${cartoKey}`
  : OSM_TILE_URL;
const LIGHT_TILE_URL = cartoKey
  ? `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=${cartoKey}`
  : OSM_TILE_URL;
const ATTRIBUTION = cartoKey
  ? '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

interface Entry {
  marker: L.Marker;
  signature: string;
}

/** Los tiles de Leaflet se estilizan aquí (no en la UI). */
function ensureTileStyles() {
  if (typeof document === 'undefined' || document.getElementById('rabbitty-leaflet-tiles')) return;
  const el = document.createElement('style');
  el.id = 'rabbitty-leaflet-tiles';
  el.textContent = `
    .leaflet-container { background: #08050E; outline: none; }
    .rabbitty-dark-tiles { filter: ${
      cartoKey
        ? 'brightness(0.72) contrast(1.18) saturate(0.78) hue-rotate(-10deg)'
        : 'invert(1) hue-rotate(180deg) brightness(0.88) contrast(1.05) saturate(0.7)'
    }; }
  `;
  document.head.appendChild(el);
}

export async function createLeafletEngine(opts: MapEngineOptions): Promise<MapEngine> {
  const { container, onSelect, onReady } = opts;

  ensureTileStyles();
  let isDark = opts.isDark;
  let businesses: MapBusiness[] = [];
  let selectedId: string | null = null;

  const map = L.map(container, {
    center: [25.7275, -100.312],
    zoom: 15,
    minZoom: 4,
    maxZoom: 19,
    zoomControl: false,
    attributionControl: false,
  });

  const spotLayer = L.layerGroup().addTo(map);
  const userLayer = L.layerGroup().addTo(map);
  let tiles: L.TileLayer | null = null;
  const markers = new Map<string, Entry>();
  let userMarker: L.Marker | null = null;

  const applyTiles = () => {
    if (tiles) map.removeLayer(tiles);
    tiles = L.tileLayer(isDark ? DARK_TILE_URL : LIGHT_TILE_URL, {
      subdomains: cartoKey ? 'abcd' : 'abc',
      maxZoom: 19,
      className: isDark ? 'rabbitty-dark-tiles' : 'rabbitty-light-tiles',
      attribution: ATTRIBUTION,
    }).addTo(map);
    tiles.bringToBack();
  };

  const renderMarkers = () => {
    spotLayer.clearLayers();
    markers.clear();
    businesses.forEach((b) => {
      const pos = coordsOf(b);
      if (!pos) return;
      const isSel = selectedId === b.id;
      const icon = L.divIcon({
        html: markerHTML(b, isSel, isDark),
        className: '',
        iconSize: [64, 80],
        iconAnchor: [32, 80],
      });
      const marker = L.marker([pos.lat, pos.lng], { icon, zIndexOffset: isSel ? 1500 : 800 })
        .addTo(spotLayer)
        .on('click', (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e.originalEvent);
          onSelect(b);
          map.panTo([pos.lat - 0.0018, pos.lng], { animate: true, duration: 0.4 });
        });
      markers.set(b.id, { marker, signature: `${isSel}` });
    });
  };

  const drawUser = (lat: number | null, lng: number | null) => {
    userLayer.clearLayers();
    userMarker = null;
    if (lat == null || lng == null) return;
    const icon = L.divIcon({ html: userMarkerHTML(), className: '', iconSize: [28, 28], iconAnchor: [14, 14] });
    userMarker = L.marker([lat, lng], { icon, zIndexOffset: 2000 }).addTo(userLayer);
    L.circle([lat, lng], {
      radius: 90,
      color: '#E91E63',
      fillColor: '#E91E63',
      fillOpacity: isDark ? 0.06 : 0.1,
      weight: 1.5,
      dashArray: '3 5',
    }).addTo(userLayer);
  };

  applyTiles();
  map.on('click', () => opts.onDeselect?.());
  map.whenReady(() => onReady());

  return {
    kind: 'leaflet',

    destroy() {
      markers.clear();
      map.remove();
    },

    invalidateSize() {
      map.invalidateSize();
    },

    flyTo(lat, lng, zoom = 15, durationMs = 1200) {
      map.flyTo([lat, lng], zoom, { duration: Math.max(0.2, durationMs / 1000) });
    },

    fitBusinesses(items) {
      const pts = items
        .map(coordsOf)
        .filter((p): p is { lat: number; lng: number } => p !== null)
        .map((p) => [p.lat, p.lng] as [number, number]);
      if (pts.length === 0) return;
      map.fitBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 16 });
    },

    setTheme(dark) {
      if (dark === isDark) return;
      isDark = dark;
      applyTiles();
      renderMarkers();
      if (userMarker) {
        const ll = userMarker.getLatLng();
        drawUser(ll.lat, ll.lng);
      }
    },

    setUser(lat, lng) {
      drawUser(lat, lng);
    },

    setBusinesses(items, sel) {
      const changedSelection = sel !== selectedId;
      const changedData = items !== businesses;
      businesses = items;
      selectedId = sel;
      // Cambiar solo la selección repinta a mano: sin recrear todo el árbol.
      if (changedData || changedSelection) renderMarkers();
    },
  };
}
