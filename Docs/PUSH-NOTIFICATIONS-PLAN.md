# Plan v2 — Notificaciones Push del Ecosistema Rabbitty

> **Estado:** diseño aprobado para implementación por fases. Reemplaza la v1 (2026-10-17) —
> conserva su arquitectura (`notify()` central) y la actualiza con todo lo construido desde
> entonces: motor de proximidad global, geofencing (app cerrada), membresías, ratings,
> propinas y el diagnóstico de entrega.
> **Fecha:** 2026-11-02 · Rama base: `main`

---

## 1. Estado real del pipeline (verificado en código y prod, 2026-11-02)

| Pieza | Estado | Evidencia |
|---|---|---|
| Sender APNs (0 deps, HTTP/2 + JWT) | ✅ | `telegram-miniapp/src/lib/push/apns.ts` |
| Envs APNs en Vercel | ✅ confirmado por el dueño | `APNS_KEY_ID/TEAM_ID/BUNDLE_ID/PRIVATE_KEY/ENV` |
| Registro de devices (iOS) | ✅ | `pushDevices` + `/api/notifications/push-token` (3 iOS activos) |
| Token higiene (deactiva 410/Unregistered) | ✅ | `apns.ts:55-60, 218-225` |
| Deep-links en push (`data.route`) | ✅ (nueva convención: rutas in-app `/chat/x`, `/memberships`, `/pay/x`, `/affiliate/x`) | tap → `router.push` en `AuthProvider:215-221` |
| Motor de proximidad GLOBAL (antes solo home) | ✅ | `ProximityEngine` en layout raíz: ping al abrir +4s, al resumir y cada 3 min |
| Ofertas flash de proximidad (server) | ✅ | `ping/route.ts` — cooldown 12h, campaña activa ≥ tasa base |
| Prompt de check-in | ✅ in-app (≤40m + quieto) | `confirmPresence` del ping + modal en `ProximityEngine` |
| Chat: notifs se marcan leídas al abrir/responder | ✅ | `chat/history/route.ts` (update type=CHAT route=/chat/{otherId}) |
| Membresías: alta/caja/Stripe webhook/renovación/revocación/canje → notificación | ✅ | `memberships.ts` + webhook Stripe (entitlements creados) |
| **Push de proximidad con app CERRADA** | ❌ | Requiere geofencing nativo — **diseño en §3** |
| **Android (FCM)** | ❌ | `sendPushToUsers` filtra `platform='ios'`; tokens Android se registran pero no reciben — **diseño en §4** |
| `notify()` central con preferencias/quiet-hours/dedupe | ❌ | Los ~30 senders aún insertan + envían inline — **diseño en §2** |
| Preferencias por tipo / quiet hours | ❌ | Hoy solo 3 toggles globales (`userSettings`: nativePush/inAppBell/email) |
| `notificationDeliveries` (auditoría de entrega) | ❌ | Hoy solo logs `[APNs] ✓/✗` en Vercel (fase intermedia) |
| Badge count en ícono de app | ⚠️ parcial | `aps.badge` soportado por el sender; nadie lo envía |

---

## 2. Arquitectura v2: un solo canal, `notify()`

### 2.1 Principio
Toda notificación nace de **un solo punto**: `notify()` en `telegram-miniapp/src/lib/push/notify.ts` (ya es la puerta S2S de `miniappClient`). El resto de la app (30 call sites) termina invocándolo o pasando por `/api/notifications` (que lo envuelve).

```
evento de negocio (60 call sites: chat, mint, membresías, POS, waitlist, cron…)
  └─ notify({ userId, type, title, message, route, threadId?, dedupeKey?, priority?, data? })
       ├─ 1. preferencias del usuario por TIPO (notificationPreferences) + quiet hours → ¿push o solo in-app?
       ├─ 2. dedupeKey (idempotencia: webhook doble / retry no duplica)
       ├─ 3. INSERT notifications (in-app, badge/unread)
       ├─ 4. pushDevices activos → APNs (hoy) / FCM (después)
       └─ 5. notificationDeliveries ← resultado por device (auditoría)
```

### 2.2 Cambios de datos (una migración, `0022`)

| Tabla | Cambio | Motivo |
|---|---|---|
| `notificationPreferences` (nueva) | `userId`, `type` (enum §5), `enabled`, `channel` (push/inApp/ambos), `quietStart`, `quietEnd`, `tz` | opt-in/out por categoría (estilo X) + horas de silencio |
| `notificationDeliveries` (nueva) | `notificationId`, `deviceId`, `channel`, `status`, `reason`, `createdAt` | auditoría + métricas de entrega (complementa los logs `[APNs]`) |
| `notifications` | `+ dedupeKey text unique nullable`, `+ priority text` | idempotencia |
| `pushDevices` | `+ tz text`, `+ appVersion text` | quiet hours por zona; segmentación |

### 2.3 Preferencias en la UI (ya existe el esqueleto)
La pantalla Ajustes → Notificaciones (3 switches) se extiende a **lista por categoría** (Chat, Recompensas, Proximidad, Membresías, Órdenes/Caja, Marketing, Sistema) — misma UI estilo X, un switch por fila, mapea 1:1 a `notificationPreferences.type`. Los 3 switches existentes quedan como "maestros" (push nativo on/off, campana, email).

---

## 3. Proximidad con app CERRADA — geofencing (diseño elegido: opción A)

### 3.1 Cómo funciona (patrón Uber/Maps)
```
[app abierta] GET /api/location/geofences (≤20 comercios a ≤5km, radio 100-150m)
[engine] registra vallas nativas (CLCircularRegion iOS / GeofencingClient Android)
[app cerrada] el OS monitorea las vallas con antenas celulares (batería ≈ 0)
[cruzas una valla] OS despierta la app en background → POST ping source:'geofence'
[server] evalúa → APNs push "⚡ 15% Bunz en 626 Café" → tap → app abre en el comercio
```

### 3.2 Implementación
1. Plugin: `@capacitor-community/background-geolocation` (gratis). iOS usa `significant-location-changes` (~500m de granularidad, funciona con app suspensa); Android usa geofencing real. Upgrade posterior a la opción B (`@transistorsoft`, $399 una vez) solo si se necesita precisión de "cruzaste la puerta".
2. `Info.plist`: `UIBackgroundModes` += `location`; textos de permiso (`NSLocationAlwaysAndWhenInUseUsageDescription`): *"Rabbitty usa tu ubicación para avisarte de ofertas y check-in cuando llegas a un comercio"*.
3. Consentimiento: sheet propio antes del permiso del OS ("Activa las alertas al llegar al local"), apagable en Ajustes → Notificaciones (respetamos el toggle maestro).
4. Engine global (ya existe): al abrir y al cambiar de zona → refresca vallas; callback `onGeofence` → ping con `source:'geofence'` + `stationary:true`.
5. Server: cero cambios — `ping/route.ts` ya evalúa, notifica y crea presencia. Telemetría `[PING_EVAL]` y `[APNs]` ya desplegada.

### 3.3 Límites honestos
- iOS: con app **forzada a cerrar** (swipe-up), significant-location-changes sigue despertando la app (es el punto del API) — con precisión de ~500m.
- Máximo 20 vallas por app en iOS (por eso el endpoint devuelve solo las cercanas y el engine las refresca al moverse de zona).
- El permiso "Permitir siempre" es necesario y Apple lo revisa: el caso de uso (ofertas al llegar) es legítimo y estándar.

---

## 4. Android / FCM (hueco completo, diseño)

1. **Firebase project** + `google-services.json` (Android) — configuración del usuario.
2. Server: `firebase-admin` (SDK) + cuenta de servicio en Vercel (`FIREBASE_SERVICE_ACCOUNT`).
3. `sendPushToUsers`: en vez de filtrar `platform='ios'` y solo APNs → **fan-out por plataforma**: iOS → APNs; Android → FCM (`messaging.send({ token, notification, data })` con `android.channel_id` por tipo).
4. Canales de notificación Android (para que el usuario los regule por categoría en el OS): `chat` (high), `rewards` (default), `proximity` (default), `orders`, `marketing` (silent).
5. La app nativa ya registra tokens en `pushDevices` con `platform` — no cambia nada del cliente salvo el config de Firebase.

---

## 5. Catálogo unificado de eventos (matriz v2)

Convenciones: **route** = ruta in-app (el tap navega); **quiet-able** = respeta horas de silencio; **dedupeKey** para idempotencia.

| # | Evento | Destinatario | type | Prio | Route | Cooldown/dedupe | Estado |
|---|---|---|---|---|---|---|---|
| 1 | Chat nuevo mensaje | destinatario | CHAT | high | `/chat/{senderId}` | threadId=conv; no push si está en el chat (read-sync ya implementado) | ✅ |
| 2 | Bunz recibidos (mint/cashback) | cliente | REWARD | normal | `/profile/wallet` | dedupeKey `pos_rwd_{orderId}` | ✅ |
| 3 | Bunz canjeados | usuario | REWARD | normal | `/profile/wallet` | dedupeKey canje | ✅ |
| 4 | Transferencia P2P recibida | receptor | TRANSFER | high | `/profile/wallet` | dedupeKey transfer | ✅ |
| 5 | Referido completado | inviter | REFERRAL | normal | `/referral` | — | ✅ |
| 6 | Nivel/logro/hat-trick | usuario | LEVELUP/ACHIEVEMENT | normal | `/profile/gamification` | dedupeKey nivel | ✅ |
| 7 | **Oferta flash de proximidad** | cliente cerca | LOYALTY_OFFER | normal | `/affiliate/{businessId}` | cooldown 12h por negocio | ✅ |
| 8 | **Prompt de check-in** | cliente cerca (≤40m) | CHECKIN_PROMPT | normal | (in-app modal; push solo si viene del geofence) | 12h sesiones; "Ahora no" 2h | ✅ in-app · ⏳ push vía geofence (§3) |
| 9 | Cuenta lista (Enviar Cuenta) | cliente | AFFILIATE | high | `/pay/{orderId}` | dedupeKey orderId | ✅ |
| 10 | Membresía otorgada/activada/renovada/revocada | miembro | REWARD/SYSTEM | normal | `/memberships` | dedupeKey evento | ✅ |
| 11 | Canje de cortesía (aviso al otorgante) | otorgante | AFFILIATE | low | `/memberships` | por ciclo | ✅ |
| 12 | Nueva comanda / llegada de cliente (dueño) | owner | SYSTEM | high | `/business-dashboard` | — | ✅ |
| 13 | **Propinas: resumen al cierre de caja** | owner/cajero | SYSTEM | low | `/cash-shifts` | por turno | ⏳ F2 |
| 14 | **Rating recibido** (opcional, anti-spam) | owner | SYSTEM | low | `/ratings` | máx 1/día | ⏳ F2 |
| 15 | Waitlist/mesa lista | usuario | WAITLIST | high | `/affiliate/{id}` | — | ✅ |
| 16 | Cumpleaños/bono | usuario | BONUS | low | `/profile` | anual | ✅ |
| 17 | Marketing/campañas (opt-in) | segmento | MARKETING | low | config | rate-limit global | ⏳ F3 |
| 18 | Pagos/liquidación Stripe (recibo) | cliente | RECEIPT | low | `/profile/wallet` | dedupeKey payment | ⏳ F2 |

---

## 6. Quiet hours + permisos

- **Quiet hours default**: 22:00–08:00 en la zona del device (`pushDevices.tz`, capturada al registrar token; editable en preferencias). En quiet: solo in-app (el push se pospone o se omite según tipo; CHAT de prioridad high siempre pasa — como WhatsApp).
- **MARKETING** siempre opt-in explícito (nunca default on).
- Rate-limit global: máx ~8 push/usuario/día fuera de chat (ya existe rate-limit por ruta; se añade contador diario en `notificationDeliveries`).
- Los 3 switches maestros actuales (push nativo / campana / email) se mantienen por encima de las categorías.

## 7. Fases de implementación (roadmap v2)

| Fase | Entregable | Alcance |
|---|---|---|
| **P1** | `notify()` central + migración `0022` (prefs, deliveries, dedupeKey) + convertir los ~30 call sites | el 100% del catálogo con push real (incluye eventos que hoy solo in-app) |
| **P2** | Preferencias por categoría en Ajustes (UI estilo X) + quiet hours + badge count | control del usuario completo |
| **P3** | Geofencing (§3): plugin + endpoint geofences + consentimiento + rebuild nativo | push con app cerrada |
| **P4** | Android/FCM (§4) | paridad multiplataforma |
| **P5** | `notificationDeliveries` métricas + eventos 13/14/18 (propinas al cierre, rating, recibos) + i18n | operación y pulido |

**Orden recomendado:** P1 → P2 (una sesión), P3 + rebuild nativo (otra), P4/P5 después.

## 8. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Apple revisa el uso de location en background | Texto de permiso honesto + consentimiento previo + toggle claro; caso de uso estándar de retail |
| Spam/fatiga de notificaciones | Quiet hours + cooldowns por tipo + rate-limit diario + MARKETING opt-in |
| Tokens inválidos (app desinstalada) | Ya resuelto: deactivación automática en 410/Unregistered |
| Duplicados por webhooks/retries | `dedupeKey` UNIQUE en la tabla + guards existentes |
| 401 "ciegos" tipo push-check | `notificationDeliveries` guarda reason por device — diagnóstico sin adivinar |
| Privacidad (coords) | Los logs nunca llevan coordenadas (`[PING_EVAL]` solo dist/accuracy); el geofence solo vive en el device |
