# Actualización · Proximidad, Google Maps y “Parked Car” para comercios

> **Estado:** ⏸️ **Pospuesto** hasta que Apple apruebe la app nativa
> (`com.rabbitty.app`). La proximidad en segundo plano **no es viable en la mini
> app de Telegram**; depende del binario nativo y de permisos de ubicación
> “Always”.
>
> **Fecha:** 2026-11-20 · **Autor:** Marco / Rabbitty
> **Hoja de ruta:** [`Docs/ROADMAP/SIGUIENTE.md`](./SIGUIENTE.md) → sección 8
> (y la FASE 16 del roadmap largo en `DOCS/ROADMAP.md`)
> **App nativa:** [`ROADMAP-NATIVE-POS.md`](../../ROADMAP-NATIVE-POS.md)
> **App Store (rechazo 3.1.1 y reglas):** [`Docs/APP-STORE/3.1.1-ALTA-NEGOCIO.md`](../APP-STORE/3.1.1-ALTA-NEGOCIO.md)
>
> **Qué es este documento.** La estrategia completa para usar proximidad,
> Google Maps Platform y la señal de “auto estacionado” con comercios. No es
> una promesa de producto ni un compromiso de fechas: es el plan que ejecutaremos
> cuando la app nativa esté autorizada.

---

## 1. La idea en una frase

**No vendemos “notificaciones cerca de ti”. Vendemos “llegaste, estacionaste y
el comercio ya sabe que vienes”.**

- **Google** aporta el contexto del lugar y la ruta (Places, Maps, Routes).
- **“Parked car”** aporta el momento de máxima intención: el cliente ya llegó,
  dejó el auto y está caminando.
- **El POS** aporta la atribución real: ticket, cliente y oferta en la misma
  transacción.

Esa combinación es la que Google Maps no puede cerrar sola.

---

## 2. Qué es “parked car” y qué sí se puede hacer

| Concepto | ¿Se puede? | Nota |
|---|---|---|
| Leer el “auto estacionado” que el usuario guardó en **Google Maps** | **No** | Es una función de consumidor, **sin API pública**. No se debe prometer. |
| **Inferir** que estacionó y va caminando al comercio | **Sí, con el app nativo** | Movimiento conduciendo → quieto → caminando; Bluetooth del auto; velocidad; cercanía. |
| **Validar** el estacionamiento con el comercio | **Sí** | QR en ticket/valet/estacionamiento + POS. Es la jugada más defendible. |

**Conclusión:** “parked car” no es un dato que Google preste; es una **señal que
Rabbitty construye** (manual o inferida) y que se monetiza con **validación en el
comercio**.

---

## 3. La señal de llegada en 3 niveles

### Nivel 0 — Manual (semana 1)

El usuario toca **“Estacioné”** en la app. Se guarda un pin temporal, hora y
comercio destino.

- Cero fricción técnica, cero batería, cero permisos de fondo.
- Uso: “Tu mesa está a 4 min caminando”, “valida tu estacionamiento con consumo”.

### Nivel 1 — Geocerca + permanencia (2–4 semanas)

El app nativo monitorea **geocercas** de comercios (no GPS continuo). Entra a la
geocerca, se queda > 3–5 min y no va a más de X km/h → “llegó”.

- **Android:** Geofencing API (hasta ~100 regiones).
- **iOS:** `CLCircularRegion` (**máximo 20 regiones**; hay que rotar las más
  cercanas) + `CLVisit`.

### Nivel 2 — Inferencia de estacionamiento (4–8 semanas)

Conduciendo → quieto → caminando, o desconexión del Bluetooth del auto. Es lo más
parecido a “parked car” sin pedirle permiso a Google.

**Regla de oro:** la inferencia vive en el dispositivo. Al servidor solo sube
“estacionó: sí/no”, geocerca y hora; **nunca la traza**.

> **Dependencia dura:** solo funciona en el **app nativo** (`com.rabbitty.app`),
> no en la mini app de Telegram. La mini app puede hacer “cerca de ti” en primer
> plano y check-in manual; el fondo es del nativo.

---

## 4. Jugadas con comercios

### A. Validación de estacionamiento con consumo

El comercio paga o reembolsa 1–2 h de estacionamiento si el ticket supera un
mínimo.

**Flujo:** cliente estaciona → app detecta o él marca “Estacioné” → oferta
“estacionamiento validado con $250” → paga en el POS → el POS imprime/QR valida
el ticket del estacionamiento.

**Por qué funciona:** el comercio gana ticket promedio; el estacionamiento gana
flujo; Rabbitty cobra por validación o comisión. **Quién paga:** el comercio
(créditos de validación) o el operador del parking (demanda).

### B. “Park & Walk” en zonas turísticas

El cliente estaciona una vez y camina a 2–3 comercios. Rabbitty arma una **ruta
caminando** (Google Routes) y cada comercio valida una parte.

Ejemplo: Bucerías / Sayulita. Un solo estacionamiento, varios consumos, una sola
atribución. Es un **producto propio**: “park once, walk the block”.

### C. Curbside / “ya llegué en el auto”

Para pickup: el cliente avisa “estoy afuera en el auto” y el comercio saca el
pedido sin que se estacione. No requiere validación de parking; requiere
**detección de llegada** y una notificación al POS.

### D. Mesa / tiempo de llegada

“Vas a llegar en 6 min caminando; tu mesa estará lista.” Google Routes da el ETA;
Rabbitty lo cruza con la reserva/fila. Reduce mesas vacías y mejora la rotación.

### E. Estacionamiento como comercio de la red

Se suman estacionamientos, valets y garajes como afiliados. El cliente ve
“estaciona aquí” con precio y disponibilidad; el estacionamiento paga por
aparecer o por validación; el comercio compra validaciones. Rabbitty se vuelve el
**intermediario de la última cuadra**.

---

## 5. Qué usar de Google (y qué no)

| Pieza | Uso | Límite |
|---|---|---|
| **Places API (New)** | POI, `place_id`, horarios, `parkingOptions`, nivel de precio | Costo por llamada; cachear solo `place_id` y datos permitidos |
| **Routes API** | Caminando del auto al comercio, ETA | Costo por ruta; no abusar |
| **Maps SDK** | Mapa de comercio, parking y ruta | Requiere app nativa/web |
| **Geofencing API** | Android: geocercas | Solo Android |
| **CoreMotion / Activity Recognition** | Inferir conducir / estacionar / caminar | Requiere permisos; no perfecto |
| **Business Profile API** | Horarios, fotos, reseñas del comercio | Requiere aprobación; no es el core |
| **Google Wallet** | Pases / ofertas | Opcional; no resuelve atribución |
| **Google Ads** | Adquisición de comercios, no proximidad | Store visits es modelado, no determinístico |
| **“Parked car” de Maps** | **No hay API** | No prometerlo |

**Google no da la atribución.** Da el mapa, el lugar y la ruta. La atribución la
da el POS de Rabbitty.

---

## 6. Arquitectura de la señal (conceptual)

```
App nativa (GPS/geocerca/motion)
   │  evento grueso: geofence_enter, parked=true/false, dwell, ETA
   ▼
Servidor Rabbitty
   │  offer engine: comercio, horario, capacidad, presupuesto, radio
   ▼
Notificación / oferta (Bunz, validación parking, curbside)
   ▼
POS: QR/ticket + customerId + offerId
   ▼
Atribución: visita → ticket → comisión/CPA
```

Reglas:

- **La ubicación exacta se queda en el teléfono.** Al servidor sube la geocerca y
  el evento, no la traza.
- **K-anonimato ≥ 5** para ofertas y métricas agregadas (ya existe en el ping de
  ubicación).
- **Frecuencia máxima:** 1 oferta de proximidad cada X horas; nada mientras
  conduce.
- **Opt-in explícito** y botón “no molestar”.

### Piezas existentes que se reutilizan

- `/api/location/ping`: señal de ubicación, k-anonimato, ofertas de proximidad y
  check-in.
- Ofertas/Bunz y doble cashback por fidelidad.
- POS: cobro, ticket, QR, `customerId`, atribución.
- App nativa: Capacitor, push, permisos de cámara/Bluetooth ya configurados.

### Piezas nuevas (cuando se ejecute)

- Detección en dispositivo (geocercas, motion, “Estacioné”).
- Modelo de eventos: `parking_events`, `proximity_offers`, `parking_validations`.
- Motor de ofertas por radio/horario/presupuesto/capacidad.
- Panel del comercio: radio, tope por cliente, presupuesto, validaciones.
- Conciliación con estacionamientos/valets.

---

## 7. Privacidad y legal (México)

- La ubicación precisa es dato personal sensible en la práctica. Se necesita
  **aviso de privacidad específico**, consentimiento separado y finalidad clara.
- **No rastrear empleados** ni menores; no usar para discriminación de precios.
- Retención corta: el pin del auto se borra al cerrar la visita (24 h).
- Google Maps Platform exige **no re-identificación** y límites de caché.
- Si hay socio de estacionamiento, entra a la **matriz de tratamientos** como
  encargado/corresponsable (ver [`Docs/legal/16-MATRIZ-TRATAMIENTOS.md`](../legal/16-MATRIZ-TRATAMIENTOS.md)).

---

## 8. Fases y esfuerzo (para cuando Apple apruebe)

| Fase | Qué | Esfuerzo | Dependencia |
|---|---|---|---|
| **F0** | Botón “Estacioné” + geocerca de 626 + validación manual en POS | 1–2 semanas | App nativa aprobada |
| **F1** | Geocercas automáticas + dwell + ETA caminando (Routes) + panel del comercio | 3–5 semanas | F0 |
| **F2** | Inferencia de estacionamiento (motion/Bluetooth) + “Park & Walk” + convenio con 1 estacionamiento | 6–8 semanas | F1 |
| **F3** | Business Profile sync, Wallet passes, autoservicio, CPAs y créditos de validación | posterior | F2 |

**Piloto recomendado:** 626 Café + 2 comercios caminables + 1 estacionamiento en
Bucerías, 4 semanas, con grupo de control (sin oferta) para medir **lift
incremental**, no solo canjes.

---

## 9. Métricas

- Llegada detectada → oferta vista → visita → ticket (embudo).
- **Lift incremental** vs. grupo de control.
- Tasa de falsos positivos (drive-by contado como llegada).
- Validaciones de parking por comercio.
- Costo por visita incremental (Google + incentivo).
- Batería/permisos: % de usuarios que aceptan “siempre” en iOS.
- Fatiga: opt-out y “no molestar”.

---

## 10. Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| “Me está siguiendo” | Lenguaje simple; pin temporal; borrar al cerrar |
| Batería | Geocercas + significant-change, no GPS continuo |
| iOS 20 regiones | Rotar las 20 más cercanas; `CLVisit` como respaldo |
| Falsos positivos | Dwell + velocidad + confirmación (“¿llegaste?”) |
| Costo de Google | Cachear `place_id`; rutas solo al abrir detalle |
| Comercio abusa (autocanje) | QR firmado + validación en POS + límite por cliente |
| Estacionamiento informal | Validación por foto/QR + conciliación manual al inicio |
| Notificación mientras conduce | Suprimir si velocidad > 20 km/h |
| Rechazo de Apple por ubicación | Justificar “Always” con la propuesta de valor; explicar en el review; fallback manual |

---

## 11. Modelo de negocio (hipótesis)

| Fuente | Quién paga | Cuándo |
|---|---|---|
| Validación de estacionamiento | Comercio (créditos) | Por validación canjeada |
| Visita incremental | Comercio | Por visita atribuida (CPA) |
| Presencia de estacionamiento | Operador de parking | Por aparición o por cliente referido |
| Campañas de proximidad | Comercio | Presupuesto por campaña (Bunz) |

**Unidad económica a validar:** costo de Google + incentivo vs. ticket
incremental. Si el CPA supera el margen del comercio, no escala.

---

## 12. Decisiones pendientes

1. ¿“Parked car” como **señal de llegada** o como **validación de estacionamiento**?
   (Recomendación: empezar por validación; la señal después.)
2. ¿Piloto en **Bucerías/Sayulita** con estacionamiento real o solo geocerca?
3. ¿El comercio paga **por validación**, **por visita** o **por campaña**?
4. ¿Android primero (más fácil) o iOS primero?
5. ¿Estacionamientos/valets como **afiliados** desde el día uno o solo convenio
   del piloto?

---

## 13. Criterio de arranque

No se empieza hasta que se cumplan **las tres**:

1. Apple aprobó la app nativa y el binario está en producción.
2. Permiso de ubicación “Always” justificado y aprobado en la revisión.
3. Un comercio y un estacionamiento piloto confirmados con ticket promedio
   suficiente para que la validación tenga sentido.

Cuando se cumplan, se actualiza este documento con fechas y se mueve la FASE 16
de `⏸️` a `🚧` en la hoja de ruta.
