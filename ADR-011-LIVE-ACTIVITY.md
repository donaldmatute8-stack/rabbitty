# ADR-011 · Live Activity del pedido en curso (iOS) + avisos "vivos"

**Fecha:** 2026-11-03 · **Estado:** implementado (iOS), Android pendiente de FCM

---

## Problema

El Rabbitter quiere ver su pedido como en Uber: una tarjeta **persistente en la
pantalla de bloqueo** que avanza sola (Recibido → Preparando → Listo →
Entregado), sin abrir la app. Una notificación normal no basta: se apila, se
descarta y no muestra progreso.

## Solución

| Capa | Pieza | Archivo |
|---|---|---|
| Contrato compartido | `RabbittyOrderActivityAttributes` | `ios/App/RabbittyOrderWidget/RabbittyOrderActivityAttributes.swift` |
| UI de bloqueo + Dynamic Island | Widget Extension `RabbittyOrderWidget` | `ios/App/RabbittyOrderWidget/RabbittyOrderLiveActivity.swift` |
| Puente JS ↔ ActivityKit | Plugin Capacitor `RabbittyLiveActivity` | `ios/App/App/RabbittyLiveActivityPlugin.swift` |
| Registro del plugin local | `RabbittyBridgeViewController` | `ios/App/App/SceneDelegate.swift` |
| JS | `syncOrderLiveActivity()` | `src/lib/liveActivity.ts` (lo llama `useOrderTracking`) |
| Token por actividad (DB) | `live_activity_tokens` | migración `0030` |
| API token | `POST /api/live-activity/token` | `src/app/api/live-activity/token/route.ts` |
| Push remoto | APNs `liveactivity` | `src/lib/push/apns.ts` + `/api/internal/live-activity/update` |
| Disparo desde el POS | `pos.setOrderStage` | `packages/api/src/routers/pos.ts` |

### Flujo

1. La app detecta un pedido activo (`/api/orders/active`) e inicia la actividad
   (`plugin.start`, idempotente por `orderId`).
2. ActivityKit emite un **push token por actividad** → se guarda en
   `live_activity_tokens` vía `/api/live-activity/token`.
3. El POS mueve la etapa → `setOrderStage`:
   - manda la notificación normal (con `collapse-id` por pedido → una sola
     notificación que evoluciona, no cuatro apiladas),
   - y llama `/api/internal/live-activity/update` → APNs push
     `apns-push-type: liveactivity` al token de la actividad.
   La tarjeta de bloqueo cambia **aunque la app esté cerrada**.
4. Al entregarse (`DONE`) se envía `event: "end"` → la tarjeta se despide.

## Decisiones

- **El plugin se registra por código** (`RabbittyBridgeViewController`), no en
  `packageClassList`: ese JSON lo regenera `cap sync` y perdería el registro.
- **`interruption-level: time-sensitive`** en los avisos de pedido: atraviesa
  Focus/No molestar. Si al App ID le falta la capability, iOS lo degrada a
  `active` sin fallar (no rompe nada).
- **`collapse-id` + `thread-id` por pedido**: una sola notificación viva.
- **La Live Activity es best-effort**: cualquier fallo se ignora y el
  tracking de la app sigue funcionando.

## Checklist de release (iOS)

1. **App ID** (`com.rabbitty.app`) en Apple Developer → activar
   *Time Sensitive Notifications* (si se quiere atravesar Focus).
2. El App ID del widget (`com.rabbitty.app.RabbittyOrderWidget`) debe existir:
   Xcode lo crea al archivar con *Automatically manage signing*.
3. Subir `CFBundleShortVersionString` / `CFBundleVersion` (hoy 2.4 / 12) antes
   del archive.
4. `xcodebuild -scheme App archive` y subir con Transporter/Organizer.
5. Probar en **device** (el simulador muestra la tarjeta, pero el push remoto
   necesita APNs real).

## Limitaciones conocidas

- **Force-quit** en iOS corta los pushes hasta reabrir la app (comportamiento
  de Apple, no nuestro).
- El usuario puede desactivar Live Activities por app en Ajustes → el plugin
  devuelve `supported: false` y todo sigue funcionando sin tarjeta.
- **Android**: no implementado. Requiere primero FCM (`google-services.json`),
  que hoy no existe; luego una notificación *ongoing* nativa (foreground
  service / NotificationCompat con progreso). Sin FCM el teléfono bloqueado no
  recibe nada, así que la tarjeta nativa sería inútil.

## Cómo se generó el target

`ios/App/add_live_activity_target.py` — idempotente, inserta el target
`RabbittyOrderWidget` en `App.xcodeproj` (target, fases, configuraciones,
dependencia y fase de embed). Si Xcode regenera el proyecto, se vuelve a
ejecutar.
