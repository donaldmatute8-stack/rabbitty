# Rabbitty Ride · Plan y viabilidad del stack geo

> **Documento de análisis y planeación.** No implementa nada, no autoriza
> operación y no sustituye una decisión de producto. Sirve para tener el mapa
> técnico preparado antes de construir.
>
> **Fecha:** 8 de noviembre de 2026.
> **Estado:** borrador para revisión.
> **Decisión previa relacionada:** `Docs/COLA-ITERACIONES.md` → “Rabbitty Ride
> (fase posterior, decisión de arquitectura)”.

---

## 1. Qué es Rabbitty Ride (según la decisión vigente)

La implementación interna de envíos, pedidos y repartidores: Rabbitty como
operador (su propio “Uber”), no solo como interfaz de terceros.

Decisiones ya tomadas:

- **App/servicio separado** para repartidores, con su propio build, sesión, mapa
  y navegación.
- **Integración seamless** con Rabbitty: identidad, pedido y estado compartidos.
- **También como servicio extra**: un Rabbitter puede pedir un Ride fuera del
  flujo de pedidos.
- **Encaje técnico:** un adapter más (`RABBITTY_RIDE`) de la capa de entregas.
  No se rehace la orden ni la UI del afiliado.
- **Requisitos previos:** cuentas de repartidor, verificación, pagos/liquidación,
  seguro, soporte y tracking en tiempo real.
- **Orden:** después de Fase 1 (Uber Direct sandbox) y Fase 2 (Move).

> **Aclaración pendiente:** la decisión habla de repartidores/envíos, pero también
> de “pedir un Ride” como Uber. Son dos alcances distintos: **last-mile delivery**
> y **ride-hailing de pasajeros**. El geo es similar; la operación, el seguro y la
> regulación no. Esta es la pregunta #1 del final.

---

## 2. Estado actual del repo (hechos verificables)

| Pieza | Estado actual | Implicación |
|---|---|---|
| App | Next.js 16 + **Capacitor 8** (iOS/Android/Telegram), no React Native | `@rnmapbox/maps` no aplica directamente |
| Mapas web | **Leaflet** + tiles CartoDB/OSM (`InteractiveMap.tsx`) | Raster, sin vector/3D |
| Mapas iOS | **MKMapView** nativo (`RabbittyNativeMapView.swift`) | Dependiente de Apple, sin Android nativo equivalente |
| Arquitectura de mapas | `mapArchitecture.ts` compara Leaflet, **MapLibre GL** y Apple MapKit | Ya existe la decisión conceptual; falta ejecutar |
| Geo en DB | `lat`/`lng` como `real` en `ownedBusinesses` y `branches` | Sin PostGIS, sin índice espacial |
| “Cerca de mí” | Haversine en JS sobre `limit(200)` negocios (`/api/location/ping`) | Confirma el escaneo completo que describe el análisis |
| Geocoding | **Nominatim (OSM)** en el alta (`landing-page/src/app/api/apply/route.ts`) | No usa Google ni Mapbox |
| Realtime | **Centrifugo** (chat) + Redis; SSE en KDS | Base reutilizable para tracking |
| Background location | `@capacitor-community/background-geolocation`, `UIBackgroundModes=location`, `distanceFilter: 50m` | Ya hay base para seguimiento en segundo plano |
| Ride | `RABBITTY_RIDE` es un **stub de delivery** en `deliveryProviders.ts` | No hay matching, dispatch ni ETA |
| Move | `/move` hace deep-link a Uber; dice “pronto Rabbitty Ride” | No hay ride propio todavía |

---

## 3. Stack propuesto (texto original)

> **Geo premium**
>
> Ningún proveedor gana en todo:
>
> | Capa | Proveedor | Por qué |
> |---|---|---|
> | Render | Mapbox GL (`@rnmapbox/maps`) | vectorial 60fps, offline real, mejor SDK RN |
> | Direcciones | Google Places/Geocoding | Mapbox falla con direcciones mexicanas informales |
> | Ruteo/ETA | Mapbox → luego OSRM self-hosted | a escala baja el costo 90% |
>
> Uber dejó Google por costo — todo-Google no escala.
>
> Lo que hace que “se sienta Uber”:
>
> - **PostGIS obligatorio** (GiST + KNN); con lat/lng sueltos cada “cerca de mí”
>   es un escaneo completo.
> - **Tracking por WebSocket**, no REST, con frecuencia adaptativa (3s en
>   movimiento, 30s disponible, apagado en background).
> - El **ranking usa ETA real**, no distancia en línea recta.
> - **Costo controlado:** ~USD 80–150/mes a 1.000 rescates con cache agresivo.

---

## 4. Correcciones necesarias para Rabbitty

### 4.1 Render: `@rnmapbox/maps` no aplica

Rabbitty es **Next.js + Capacitor**, no React Native. Opciones reales:

| Opción | Pros | Contras | Veredicto |
|---|---|---|---|
| **MapLibre GL JS** en WebView | Gratis, vectorial, 60fps WebGL, ya contemplado en `mapArchitecture.ts`, funciona en iOS/Android/Telegram | Offline real limitado; ~200 KB gzipped | **Recomendado para empezar** |
| Plugin nativo MapLibre/Mapbox para Capacitor | Mejor rendimiento y offline | Más trabajo nativo iOS/Android | Si el offline es requisito |
| Apple MapKit iOS + MapLibre Android/web | Mejor batería iOS, cero costo de tiles | Dos implementaciones; sin paridad visual | Híbrido válido |
| Mapbox GL JS + plugin nativo Mapbox | Tráfico/offline gestionado, ecosistema | Costo y vendor lock-in | Solo si se necesita tráfico/offline premium |

**Corrección:** el render no debería ser `@rnmapbox/maps`. La ruta de menor
fricción es **MapLibre GL**.

### 4.2 Background: “apagado” solo cuando no hay viaje

La regla “apagado en background” es correcta para un conductor disponible o
inactivo, pero **no para un viaje activo**. En viaje, el tracking debe continuar
en segundo plano (con permiso de ubicación “always” y justificación en tiendas).

Propuesta:

| Estado | Frecuencia | Background |
|---|---|---|
| En viaje | 5–10 s o 20–50 m | **Sí**, con permiso “always” |
| Disponible | 30 s | Limitado / significant-change |
| Inactivo | Apagado | No |

### 4.3 Otros ajustes

- **PostGIS:** correcto y prioritario.
- **“Uber dejó Google por costo”:** dirección correcta, pero no es una regla
  universal. Uber usa mezcla de proveedores y mapas propios. Lo que importa es
  el modelo de uso de Rabbitty.
- **“Mapbox falla con direcciones mexicanas informales”:** plausible, pero Google
  también falla. La solución robusta es **Google + pin manual + confirmación del
  cliente**.
- **“Offline real”:** las regiones offline de Mapbox RN no se trasladan al
  WebView. Si es requisito, usar PMTiles/MapLibre offline o plugin nativo.

---

## 5. Viabilidad por capa

| Capa | Veredicto | Notas |
|---|---|---|
| **Render** | Viable con MapLibre GL | No usar `@rnmapbox/maps`; evaluar plugin nativo si el offline es crítico |
| **Direcciones** | Viable con Google Places/Geocoding | Session tokens, cache, sesgo a México (`country:mx`, `language:es`), pin manual |
| **Ruteo/ETA** | Viable con Mapbox Directions/Matrix | OSRM/Valhalla self-hosted solo a mayor volumen |
| **PostGIS** | **Obligatorio** | Neon soporta PostGIS; `geography(Point,4326)`, GiST, KNN |
| **Tracking WebSocket** | Viable con Centrifugo + Redis | Canales por viaje, autorización, presencia, historial corto |
| **Ranking ETA** | Viable | Prefiltro KNN 2–3 km + ETA real de top 8–12; cache H3/S2 |
| **Offline** | No automático en Capacitor | PMTiles/MapLibre offline o plugin nativo |

### 5.1 PostGIS: qué implica

1. Habilitar la extensión en Neon (`CREATE EXTENSION IF NOT EXISTS postgis`).
2. Agregar `location geography(Point,4326)` a `ownedBusinesses` (y sucursales si
   aplica), con backfill desde `lat`/`lng`.
3. Índice `GIST (location)`.
4. Reescribir `/api/location/ping` y el ranking con `ST_DWithin`, `ST_Distance`
   y KNN `<->`.
5. Medir latencia y plan de consulta antes/después.
6. Mantener `lat`/`lng` por compatibilidad o migrar por completo.

**Impacto:** elimina el `limit(200)` y el Haversine en JS; permite “cerca de mí”
real y ranking por distancia/ETA.

### 5.2 Tracking: diseño mínimo

- Canal por viaje: `ride:<rideId>` (autorizado por token).
- Eventos: `driver.location`, `ride.status`, `ride.eta`.
- WS para vivo; Postgres para histórico (puntos cada 10–20 s o 50 m, no cada 3 s).
- Fallback a REST batch si el WS se cae.
- Presencia para conductor y cliente.
- Historial de Centrifugo corto o desactivado (privacidad y costo).

### 5.3 Ranking por ETA

1. Prefiltro KNN: candidatos a 2–3 km.
2. Matriz de ETA para top 8–12 (no para todos).
3. Cache por celda H3/S2 y por minuto.
4. Recalcular solo si el conductor se mueve >100 m o cambia el estado.

---

## 6. Costo (orden de magnitud)

**Precios verificados en octubre–noviembre de 2026.** Verificar antes de
contratar; los free tiers cambian.

### 6.1 Supuestos

- 1,000 viajes/mes.
- 2 rutas por viaje (pickup y dropoff).
- 10 candidatos por matching (matrix).
- 1 sesión de dirección por viaje.
- Render con MapLibre + tiles libres (costo $0).

### 6.2 Costo estimado a 1,000 viajes/mes

| Proveedor | Consumo/mes | Free tier | Costo |
|---|---:|---:|---:|
| MapLibre + tiles libres | 1,000 map loads | — | **$0** |
| Mapbox Directions | ~2,000 requests | 100,000 | **$0** |
| Mapbox Matrix | ~10,000 elementos | 100,000 | **$0** |
| Google Geocoding | ~1,000 | 10,000 | **$0** |
| Google Autocomplete + Details Essentials | ~1,000 sesiones | 10,000 autocomplete / 10,000 details | **~$5–10** |
| **Total variable** | | | **~$5–20/mes** |

### 6.3 Escalado

| Viajes/mes | Costo variable aproximado | Nota |
|---:|---:|---|
| 1,000 | $5–20 | Todo dentro de free tiers salvo detalles |
| 10,000 | $100–350 | Autocomplete y matrix empiezan a pesar |
| 50,000 | $1,500–3,000 | OSRM/Valhalla self-hosted empieza a tener sentido |

**Conclusión:** el estimado de USD 80–150/mes es un **techo conservador** para
1,000 viajes/mes. El mayor riesgo de costo no es el mapa: es el autocomplete por
keystroke. Poner cuotas duras por API y cachear.

### 6.4 OSRM self-hosted

- Requiere datos OSM de México (varios GB), RAM 4–8 GB, actualizaciones y
  mantenimiento.
- Costo de infraestructura estimado: USD 20–50/mes en Railway, más operación.
- **No se justifica a 1,000 viajes/mes.** El break-even probable está en
  decenas de miles de viajes/mes.

---

## 7. Riesgos

| Riesgo | Por qué importa | Mitigación |
|---|---|---|
| **Regulatorio** | Si es pasajeros: permisos estatales, seguro, verificación de conductores, tarifas, seguridad | Definir alcance antes de construir; asesoría legal |
| **Seguro** | Cobertura para repartidores/conductores y mercancía | Póliza específica antes de operar |
| **Privacidad** | Ubicación es dato personal; tracking continuo | Consentimiento, retención, acceso, transparencia (RAT A02/A04/A12) |
| **Operación** | Matching, dispatch, cancelaciones, soporte, incidentes | Producto y operaciones, no solo geo |
| **Calidad de datos** | Direcciones informales de México | Google + pin manual + confirmación del cliente |
| **Batería** | Tracking continuo | Frecuencia adaptativa; medir consumo; opt-out |
| **Costo** | Autocomplete y matrix sin cache | Cuotas, sesiones, cache, monitoreo de usage |
| **Dependencia** | Vendor lock-in de Mapbox/Google | MapLibre + capa de abstracción de proveedor |

---

## 8. Fases recomendadas (sin implementar)

### Fase 0 · Base geo (2–4 semanas)

- Habilitar PostGIS en Neon.
- Migrar `lat`/`lng` a `geography` con backfill.
- Índice GiST y KNN.
- Reescribir `location/ping` y medir latencia/plan.
- **Criterio:** “cerca de mí” deja de ser escaneo completo.

### Fase 1 · Mapas, direcciones y ETA

- MapLibre GL en la app (web/Capacitor).
- Google Geocoding/Places con sesiones y cache + pin manual.
- Mapbox Directions/Matrix para ETA (o alternativa).
- Tracking en Centrifugo reutilizando background location.
- **Criterio:** un viaje de prueba se ve en vivo y el ETA es real.

### Fase 2 · Operación

- Matching y ranking.
- Dispatch, estados, cancelaciones.
- Cuentas de repartidor, verificación, pagos/liquidación.
- Si es pasajeros: permisos y seguro antes de operar.
- **Criterio:** un viaje completo de punta a punta con soporte.

### Fase 3 · Escala

- OSRM/Valhalla self-hosted si el volumen lo justifica.
- Cache H3/S2.
- Optimización de batería y costo.
- **Criterio:** costo por viaje estable y latencia objetivo.

---

## 9. Preguntas abiertas (para decidir antes de construir)

1. **¿Rabbitty Ride es pasajeros o reparto de última milla?**
   Define regulación, seguro, verificación y operación.
2. **¿“1,000 rescates” es por mes o por día?**
   Cambia el modelo de costo y la decisión de OSRM self-hosted.
3. **¿Flota propia o marketplace de conductores?**
   Cambia identidad, pagos, seguro y soporte.
4. **¿Ciudades de lanzamiento?**
   Define datos OSM/Google, permisos estatales y cobertura.
5. **¿El offline es requisito real o nice-to-have?**
   Define MapLibre WebView vs plugin nativo.
6. **¿Presupuesto mensual y latencia objetivo?**
   Define free tiers, cache y proveedor.
7. **¿El cobro ocurre dentro de la app o solo se conecta al proveedor?**
   Define pagos, comisiones y conciliación.
8. **¿Quién atiende incidentes y cancelaciones?**
   Define soporte y SLA.
9. **¿Se comparte la ubicación del repartidor con el cliente en todo momento?**
   Define privacidad, retención y UX.
10. **¿Se permite tracking en segundo plano “always”?**
    Define permisos de tienda y política de privacidad.

---

## 10. Qué no hacer todavía

- No implementar `@rnmapbox/maps` (no aplica a Capacitor).
- No self-hostear OSRM a 1,000 viajes/mes.
- No apagar el tracking en background durante un viaje activo.
- No usar autocomplete sin sesiones/cache.
- No prometer “offline real” sin plugin nativo o PMTiles.
- No operar pasajeros sin permisos y seguro.
- No mezclar datos de sandbox con métricas de Ride.

---

## 11. Referencias de código

| Tema | Ruta |
|---|---|
| Decisión previa de Ride | `Docs/COLA-ITERACIONES.md` |
| Arquitectura de mapas | `telegram-miniapp/src/features/map/mapArchitecture.ts` |
| Mapa web actual | `telegram-miniapp/src/features/map/InteractiveMap.tsx` |
| Mapa nativo iOS | `telegram-miniapp/ios/App/App/RabbittyNativeMapView.swift` |
| Proximidad actual | `telegram-miniapp/src/components/ProximityEngine.tsx`, `telegram-miniapp/src/app/api/location/ping/route.ts` |
| Geocoding actual | `landing-page/src/app/api/apply/route.ts` |
| Adapter de entregas | `packages/api/src/services/deliveryProviders.ts` |
| Realtime | `telegram-miniapp/src/lib/realtime/*`, `telegram-miniapp/docker/centrifugo/*` |
| Esquema geo | `packages/database-core/src/schema/index.ts`, `packages/database-restaurant/src/schema/index.ts` |
| Move (deep-link Uber) | `telegram-miniapp/src/app/move/page.tsx` |

---

## 12. Resumen ejecutivo

- La dirección es correcta: **PostGIS + ETA real + WS adaptativo + cache**.
- El stack propuesto necesita **tres correcciones**: MapLibre en vez de
  `@rnmapbox/maps`; background ON en viaje activo; costo real menor al estimado a
  1,000 viajes/mes.
- Lo urgente es **PostGIS**; lo demás se puede construir por fases.
- Antes de escribir código, resolver las **10 preguntas abiertas**, empezando por
  “pasajeros vs. delivery” y “1,000 por mes vs. por día”.
