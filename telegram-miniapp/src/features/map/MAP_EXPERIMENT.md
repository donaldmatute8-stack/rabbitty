# 🗺️ Rabbit Map Benchmarks: Apple MapKit vs MapLibre vs Leaflet

**Rama:** `feat/mapa`  
**Objetivo:** Evaluar experimentalmente el motor de mapas óptimo para la app de usuarios de Rabbitty (iOS Nativo, Android y Telegram Mini App) separando la **Cartografía Base** de la **Capa Rabbitty**.

---

## 🏛️ Matriz Técnica y Comparativa

| Criterio | Apple MapKit Nativo (`MKMapView`) | MapLibre GL Vectorial (`OpenFreeMap`) | Leaflet Actual (CartoDB Raster) |
| :--- | :--- | :--- | :--- |
| **Tecnología** | Metal / Swift Nativo en iOS | WebGL / GPU Vector Tiles | DOM HTML + Raster PNG Tiles |
| **FPS / Rendimiento** | 120 FPS ProMotion en iPhone | 60 FPS fluido en WebGL | 45-60 FPS (según carga de DOM) |
| **Zoom y Rotación 3D** | Rotación 3D libre + inclinación nativa | Rotación 3D libre + inclinación (pitch) | Zoom 2D plano (no rota) |
| **Dark Mode** | Dark Mode nativo de Apple | Estilo Cyber/Neón HSL a medida | CartoDB Dark Matter |
| **Capa Rabbitty** | Pines Rabbitty, Bunz badges, Sheets | Pines Rabbitty, Bunz badges, Sheets | Pines Rabbitty, Bunz badges, Sheets |
| **Compatibilidad** | Solo iOS (requiere fallback web) | iOS + Android + Telegram Mini App | iOS + Android + Telegram Mini App |
| **Costos / Límites** | Incluido en cuenta Apple Developer | Gratis sin API Key (OpenFreeMap) | Gratuito (CartoDB Open Basemaps) |

---

## 📋 Pasos para la Prueba Práctica en iOS (Cuando se retome esta rama)

1. **Prueba MapKit Nativo en Swift:**
   - Crear un archivo `RabbittyMapView.swift` dentro de `telegram-miniapp/ios/App/App/`.
   - Montar `MKMapView` con `overrideUserInterfaceStyle = .dark`.
   - Renderizar los pines de prueba con las coordenadas de Huatulco y badges de Bunz.
2. **Prueba MapLibre GL Vectorial:**
   - Cargar `maplibre-gl` con el endpoint libre `https://tiles.openfreemap.org/styles/dark`.
   - Comparar el rendimiento táctil y la carga de memoria frente a Leaflet.
3. **Decisión Arquitectónica:**
   - Si MapKit Nativo ofrece el 90% de la identidad con la *Capa Rabbitty* y sin costo de tiles, se adopta como vista nativa en iOS con fallback a Leaflet/MapLibre en Telegram.
