/**
 * ── Estilos de mapa Rabbitty (templates propios) ────────────────────────────
 *
 * Tiles vectoriales de OpenFreeMap: gratis, sin API key y sin límite de
 * peticiones. El estilo NO se descarga de un tercero: lo definimos aquí, así
 * que los colores del mapa son nuestros y se cambian en un solo sitio.
 *
 * Para reestilizar el mapa solo hay que tocar `RABBITTY_MAP_THEMES`:
 * cada clave es una superficie (agua, tierra, calles, etiquetas…).
 *
 *   agua        water
 *   tierra      landAlt
 *   parque      park
 *   edificios   building / buildingLine
 *   calles      roadMinor / roadMajor / roadHighway (+ sus *Line de borde)
 *   etiquetas   label / labelHalo / labelRoad
 */

import type { StyleSpecification } from 'maplibre-gl';

export const OPENFREEMAP_SOURCE = 'https://tiles.openfreemap.org/planet';
const GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
const FONT = ['Noto Sans Regular'];
const FONT_BOLD = ['Noto Sans Bold'];

export interface MapPalette {
  bg: string;
  landAlt: string;
  park: string;
  wood: string;
  water: string;
  waterLine: string;
  building: string;
  buildingLine: string;
  roadMinor: string;
  roadMinorLine: string;
  roadMajor: string;
  roadMajorLine: string;
  roadHighway: string;
  roadHighwayLine: string;
  rail: string;
  boundary: string;
  label: string;
  labelHalo: string;
  labelRoad: string;
}

export const RABBITTY_MAP_THEMES: Record<'dark' | 'light', MapPalette> = {
  // Noche: casi negro con violetas fríos; el rosa de la marca queda para los
  // pines y nunca compite con el fondo.
  dark: {
    bg: '#08050E',
    landAlt: '#100A18',
    park: '#0E1A17',
    wood: '#0C1714',
    water: '#0A1024',
    waterLine: '#111A33',
    building: '#160F22',
    buildingLine: '#221733',
    roadMinor: '#221634',
    roadMinorLine: '#170F24',
    roadMajor: '#2F1F47',
    roadMajorLine: '#1C132B',
    roadHighway: '#452B63',
    roadHighwayLine: '#241634',
    rail: '#2A1F3A',
    boundary: '#382A4A',
    label: '#B7A9C9',
    labelHalo: '#08050E',
    labelRoad: '#8C7DA0',
  },
  // Día: papel frío, calles blancas con sombra suave (lectura tipo Uber).
  light: {
    bg: '#F7F8FB',
    landAlt: '#EEF1F6',
    park: '#E6F1E9',
    wood: '#DDEBE1',
    water: '#D7E6F5',
    waterLine: '#C4D8EC',
    building: '#E9ECF2',
    buildingLine: '#DCE1EA',
    roadMinor: '#FFFFFF',
    roadMinorLine: '#E4E8EF',
    roadMajor: '#FFFFFF',
    roadMajorLine: '#DFE4EC',
    roadHighway: '#FFFFFF',
    roadHighwayLine: '#D8DEE8',
    rail: '#DFE3EA',
    boundary: '#D5DBE5',
    label: '#3F4450',
    labelHalo: '#FFFFFF',
    labelRoad: '#6B7280',
  },
};

export function rabbittyMapStyle(isDark: boolean): StyleSpecification {
  const c = RABBITTY_MAP_THEMES[isDark ? 'dark' : 'light'];

  const roadLayers = (
    suffix: string,
    fill: string,
    line: string,
    minzoom: number,
    classes: unknown[],
  ): any[] => [
    {
      id: `road-${suffix}-casing`,
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom,
      filter: ['all', ['==', ['geometry-type'], 'LineString'], ['in', ['get', 'class'], ['literal', classes]]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': line, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.4, 16, 7] },
    },
    {
      id: `road-${suffix}`,
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom,
      filter: ['all', ['==', ['geometry-type'], 'LineString'], ['in', ['get', 'class'], ['literal', classes]]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': fill, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.8, 16, 5] },
    },
  ];

  return {
    version: 8,
    name: `rabbitty-${isDark ? 'dark' : 'light'}`,
    glyphs: GLYPHS,
    sources: {
      openmaptiles: { type: 'vector', url: OPENFREEMAP_SOURCE },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': c.bg } },

      // Superficies artificiales
      {
        id: 'landuse',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landuse',
        filter: ['in', ['get', 'class'], ['literal', ['residential', 'commercial', 'industrial', 'garages', 'retail']]],
        paint: { 'fill-color': c.landAlt, 'fill-opacity': 0.9 },
      },
      {
        id: 'park',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'park',
        paint: { 'fill-color': c.park, 'fill-opacity': 0.75 },
      },
      {
        id: 'landcover-wood',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landcover',
        filter: ['in', ['get', 'class'], ['literal', ['wood', 'grass', 'scrub']]],
        paint: { 'fill-color': c.wood, 'fill-opacity': 0.6 },
      },

      // Agua
      { id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water', paint: { 'fill-color': c.water } },
      {
        id: 'waterway',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'waterway',
        paint: { 'line-color': c.water, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.6, 16, 3] },
      },

      // Edificios (solo de cerca: peso visual bajo a zoom de ciudad)
      {
        id: 'building',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'building',
        minzoom: 13.5,
        paint: {
          'fill-color': c.building,
          'fill-outline-color': c.buildingLine,
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13.5, 0, 15, 1],
        },
      },

      // Vías, de menor a mayor jerarquía
      ...roadLayers('minor', c.roadMinor, c.roadMinorLine, 12, ['minor', 'service', 'track', 'path', 'pedestrian']),
      ...roadLayers('secondary', c.roadMajor, c.roadMajorLine, 9, ['secondary', 'tertiary']),
      ...roadLayers('primary', c.roadMajor, c.roadMajorLine, 7, ['primary']),
      ...roadLayers('highway', c.roadHighway, c.roadHighwayLine, 5, ['motorway', 'trunk', 'motorway_link', 'trunk_link']),

      {
        id: 'rail',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        minzoom: 11,
        filter: ['==', ['get', 'class'], 'rail'],
        paint: { 'line-color': c.rail, 'line-width': 1, 'line-dasharray': [3, 2] },
      },

      // Límites administrativos
      {
        id: 'boundary',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'boundary',
        minzoom: 5,
        filter: ['<=', ['get', 'admin_level'], 4],
        paint: { 'line-color': c.boundary, 'line-width': 1, 'line-dasharray': [4, 3] },
      },

      // Etiquetas: nombres de ciudad y de calle
      {
        id: 'place-label',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
        minzoom: 8,
        filter: ['in', ['get', 'class'], ['literal', ['city', 'town', 'village', 'suburb', 'neighbourhood']]],
        layout: {
          'text-field': ['get', 'name'],
          'text-font': FONT_BOLD,
          'text-size': ['interpolate', ['linear'], ['zoom'], 8, 10, 14, 15],
          'text-transform': ['case', ['==', ['get', 'class'], 'city'], 'uppercase', 'none'],
          'text-letter-spacing': ['case', ['==', ['get', 'class'], 'city'], 0.12, 0],
          'text-max-width': 8,
        },
        paint: {
          'text-color': c.label,
          'text-halo-color': c.labelHalo,
          'text-halo-width': 1.4,
        },
      },
      {
        id: 'road-label',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'transportation_name',
        minzoom: 14,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': FONT,
          'text-size': ['interpolate', ['linear'], ['zoom'], 14, 9.5, 18, 12],
          'symbol-placement': 'line',
          'text-max-angle': 30,
        },
        paint: {
          'text-color': c.labelRoad,
          'text-halo-color': c.labelHalo,
          'text-halo-width': 1.2,
        },
      },
    ],
  } as StyleSpecification;
}
