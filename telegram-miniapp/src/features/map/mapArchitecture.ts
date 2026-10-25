// Evaluador y Guía de Arquitectura de Mapas: Apple MapKit vs MapLibre vs Leaflet
// Rama: feat/mapa

export type MapEngineType = 'leaflet' | 'maplibre' | 'apple-maps-native';

export interface MapEngineConfig {
  id: MapEngineType;
  name: string;
  isNativeOnly: boolean;
  supportsWeb: boolean;
  requiresVectorTiles: boolean;
  costModel: 'free' | 'freemium-tokens' | 'apple-developer-included';
  pros: string[];
  cons: string[];
}

export const MAP_ENGINES: Record<MapEngineType, MapEngineConfig> = {
  leaflet: {
    id: 'leaflet',
    name: 'Leaflet (CartoDB Raster con Overzooming)',
    isNativeOnly: false,
    supportsWeb: true,
    requiresVectorTiles: false,
    costModel: 'free',
    pros: [
      'Estable y probado en producción',
      'Cero configuración nativa requerida',
      'Funciona 100% idéntico en iOS, Android y Telegram Mini App',
      'Overzooming hasta zoom 21 activo'
    ],
    cons: [
      'Mapas basados en imágenes raster (no rotan libremente en 3D)',
      'Mayor consumo de datos móviles al descargar tiles PNG'
    ]
  },
  maplibre: {
    id: 'maplibre',
    name: 'MapLibre GL (Vectores GPU WebGL / OpenFreeMap)',
    isNativeOnly: false,
    supportsWeb: true,
    requiresVectorTiles: true,
    costModel: 'free',
    pros: [
      'Renderizado vectorial acelerado por hardware a 60fps',
      'Rotación fluida y perspectiva 3D (pitch)',
      'Estilos dark/neon 100% personalizables con colores de Rabbitty',
      'Funciona de forma compartida en iOS Capacitor y en Telegram MiniApp'
    ],
    cons: [
      'Requiere cargar la librería de estilos vectoriales y gl-js (~200KB gzipped)'
    ]
  },
  'apple-maps-native': {
    id: 'apple-maps-native',
    name: 'Apple MapKit Nativo (MKMapView en Swift / Capacitor Bridge)',
    isNativeOnly: true,
    supportsWeb: false,
    requiresVectorTiles: false,
    costModel: 'apple-developer-included',
    pros: [
      'Rendimiento Metal de 120Hz ProMotion en iPhone',
      'Consumo mínimo de batería en iOS',
      'Modo oscuro de Apple nativo y respetado por el sistema',
      'Cero costo de servidores de teselas de terceros'
    ],
    cons: [
      'No se puede personalizar el color base de las calles y edificios (solo la capa de pines)',
      'Requiere fallback en Leaflet o MapLibre cuando se ejecuta en Android o Telegram Mini App',
      'Requiere puente nativo Swift en el directorio /ios'
    ]
  }
};
