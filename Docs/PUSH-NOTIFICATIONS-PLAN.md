# Plan v2.1 — Notificaciones en tiempo real del Ecosistema Rabbitty

> **Estado:** diseño v2.1 — incorpora las condiciones del review técnico (realtime como capa
> propia, outbox transaccional, semántica de entrega, geofencing con matriz nativa, paridad
> Android completa). **No se ejecuta sin aprobar P0.**
> **Fecha:** 2026-11-02 · Rama base: `main`
> **Principio rector:** *push no es el motor de tiempo real de Rabbitty — es uno de sus canales.*
> La meta no es mandar muchas notificaciones: es que cada evento importante actualice el estado
> correcto, llegue a la persona correcta, por el canal correcto, sin duplicarse ni perderse.

---

## 0. Las tres capas (concepto que ordena todo el sistema)

| Capa | Función | Mecanismo |
|---|---|---|
| **1. Eventos de negocio** | El hecho real ocurre: pago confirmado, cuenta enviada, Bunz minteado, mensaje nuevo, llegada al local | Emisión dentro de la transacción de negocio → **outbox durable** (§2) |
| **2. Realtime in-app** | La pantalla abierta se actualiza al instante (wallet, orden, chat, presencia) | Suscripción por evento (SSE/WebSocket) — el contrato de eventos es el mismo del outbox |
| **3. Push** | Avisa/despierta cuando la app NO está activa | APNs/FCM vía worker |

Ejemplos del contrato:
- El negocio envía la cuenta → la pantalla del Rabbitter cambia en vivo; si no está en la app, push.
- Un pago se confirma → orden + wallet se actualizan en vivo; push es el aviso adicional.
- Un mensaje llega → chat se actualiza en vivo; app cerrada → notificación.
- Un cliente llega al comercio → presencia/ofertas se evalúan **aunque la app esté cerrada** (geofencing §6) — no depende de que esté abierta.

**Regla de diseño:** ningún módulo escribe "directo a APNs" ni consulta por polling su propio dominio — todos publican/consumen eventos del mismo contrato.

---

## 1. Estado real del pipeline (verificado, 2026-11-02)

| Pieza | Estado | Evidencia |
|---|---|---|
| Sender APNs (HTTP/2 + JWT, 0 deps) | ✅ | `telegram-miniapp/src/lib/push/apns.ts` |
| Envs APNs en Vercel (4/4 confirmadas por el dueño) | ✅ | + verificación runtime: `/api/notifications/push-check` |
| Registro de devices iOS + higiene (410 → desactiva) | ✅ | `pushDevices`, `push-token/route.ts`, `apns.ts:55-60,218-225` |
| Deep-links: `data.route` → `router.push` al tocar | ✅ | `AuthProvider:215-221` |
| Motor de proximidad GLOBAL (cualquier pantalla) | ✅ | `ProximityEngine` (layout raíz): ping +4s, al resumir, cada 3 min |
| Ofertas flash / prompt de check-in (server-side) | ✅ | `ping/route.ts` — cooldown 12h, `[PING_EVAL]`/`[APNs]` con telemetría |
| Chat read-sync (notifs se limpian al abrir/responder) | ✅ | `chat/history/route.ts` |
| Membresías: alta/caja/Stripe/renovación/revocación/canje → notif | ✅ | `memberships.ts` + webhook Stripe |
| Push con app CERRADA | ❌ | → P4 geofencing (§6) |
| Android (FCM) | ❌ | → P3 paridad (§7) |
| `notify()` central + outbox + preferencias por tipo | ❌ | → P0/P1 (§2-§5) — **nada de esto existe todavía** |
| Métricas de entrega | ❌ | solo logs `[APNs]` → P0 registros mínimos |

---

## 2. Outbox transaccional (P0 — la pieza de confiabilidad)

**Problema que resuelve:** hoy el envío es inline al flujo de negocio — si el proceso muere entre el insert y APNs, la notificación se pierde; si APNs es lento, retrasa el POS; si el webhook reintenta, duplica.

### 2.1 Arquitectura
```
Evento de negocio
      │ (misma transacción)
      ▼
notificaciones_outbox (durable: {id, userId, type, payload, dedupeKey UNIQUE, status, attempts, runAfter})
      │
      ▼
Notification Worker (cada ~15-30s; Vercel cron o invocation piggyback)
      ├─ toma batch status=QUEUED (FOR UPDATE SKIP LOCKED)
      ├─ preferencias por tipo + quiet hours → ¿push, solo in-app, o descartar?
      ├─ INSERT notifications (in-app)
      ├─ Realtime fan-out (fase P2; hoy no-op)
      ├─ APNs/FCM → notificationDeliveries (resultado por device)
      └─ retry con backoff (status RETRYING, runAfter exponencial; FAILED tras N intentos)
```

- **Regla de oro:** la transacción de negocio NUNCA llama al proveedor de push — solo escribe el outbox. Un fallo de APNs jamás rompe un pago (hoy los sends son best-effort inline, riesgo latente).
- **Sin infra nueva:** el worker corre como Vercel cron (ya tenemos el patrón: memberships/expire-orders) + invocación piggyback en cada request para baja latencia cuando el servidor está caliente.
- Evolución futura: si el volumen lo exige, el worker se muda a un servicio dedicado (Railway) — el contrato outbox no cambia.

### 2.2 Semántica de entrega (estados reales, sin promesas falsas)
| Estado | Significado | Quién lo escribe |
|---|---|---|
| `QUEUED` | Rabbitty aceptó el evento | outbox (tx de negocio) |
| `SENT` | entregado al transport (HTTP request hecho) | worker |
| `PROVIDER_ACCEPTED` | APNs/FCM respondió 200 | worker (por device) |
| `DELIVERED` | confirmación de entrega del device (cuando el proveedor la da — **no todos los canales la garantizan**) | feedback/extension cuando exista |
| `OPENED` | el usuario tocó la notificación | cliente (pushNotificationActionPerformed → report) |
| `RETRYING` | fallo temporal (5xx/timeout) con backoff programado | worker |
| `FAILED` | fallo permanente (token inválido, config rota) | worker |

**Regla de comunicación:** nunca prometemos "entrega garantizada" por `PROVIDER_ACCEPTED`. Métricas operables: tokens inválidos, usuarios con push apagado, errores de config, latencia evento→envío, latencia de apertura, tasa de fallo por plataforma/versión.

---

## 3. Contrato de eventos (estable, para todo Rabbitty)

Un solo catálogo tipado (shared package `@rabbitty/events` — ya existe el bus) usado por: outbox, realtime (futuro), scores (Rabbitty Score F2+), y auditoría.

```ts
// El MISMO contrato para: outbox → push, realtime in-app, métricas
interface RabbittyEvent<T extends EventName> {
  id: string;              // event id (idempotencia)
  name: T;                 // ORDER_PAID, ACCOUNT_BILL_SENT, CHAT_MESSAGE, BUNZ_MINTED, ARRIVAL…
  occurredAt: string;      // ISO
  actor?: { userId?: string; role?: string };
  subject: { userId?: string; businessId?: string; branchId?: string; orderId?: string; conversationId?: string };
  payload: EventPayloads[T];
}
```
Los payloads ya existen hoy en los `bus.emit` (ORDER_PAID/ORDER_VOIDED/BUNZ_REWARD/…) — P0 los tipa y les agrega los que faltan (ACCOUNT_BILL_SENT, ARRIVAL, TIP_PAYOUT…). Rabbitty Score F2 consume este mismo contrato para sus señales — **por eso P0 va primero**.

---

## 4. Preferencias: 3 planos distintos (no confundirlos)

| Plano | Qué es | Dónde vive | Ejemplo |
|---|---|---|---|
| **Canal** | Por dónde recibe: push / campana in-app / email | `userSettings` (3 switches maestros, ya existen) | push nativo on/off |
| **Categoría** | Qué tipos quiere: chat / recompensas / proximidad / membresías / órdenes / marketing / sistema | `notificationPreferences` (nueva, por type) | proximidad off, chat on |
| **Estado del sistema** | Realidad del device: permiso OS, token válido, canal bloqueado, quiet hours | OS + `pushDevices` + `notificationDeliveries` | permiso iOS denegado |

Reglas:
- El **switch maestro no puede habilitar push si el OS lo tiene denegado** — la UI muestra el estado real del sistema y el botón lleva a Ajustes del teléfono.
- **MARKETING** siempre opt-in explícito; **críticos de operación** no se silencian por quiet hours (ver §5); CHAT high pasa quiet hours (como WhatsApp) pero agrupado.

## 5. Clases de eventos (tratamiento por clase)

| Clase | Ejemplos | Push | Quiet hours | Rate-limit |
|---|---|---|---|---|
| **Críticos de operación** | Cuenta enviada, pago confirmado, orden lista | Realtime + push | NO se silencian | sin límite (dedupe por orden) |
| **Comunicación** | Chat, respuesta del comercio | Realtime + push agrupado (threadId) | CHAT high pasa; otros respetan | agrupado por hilo |
| **Engagement** | Bunz, logros, referidos | push configurable | respeta quiet | máx N/día |
| **Marketing** | Ofertas, campañas, proximidad | **opt-in explícito** | respeta quiet | cooldown 12h + presupuesto |

Catálogo completo con clase por evento: ver matriz v2 (conservada abajo §8) — se añade la columna `class` al estandarizar tipos.

---

## 6. Geofencing (P4) — con honestidad de plataforma

**Diseño (mantenido de v2):** `GET /api/location/geofences` (≤20 comercios a ≤5km, radio 100-150m) → engine registra vallas nativas → OS despierta la app al cruzar → ping `source:'geofence'` → todo lo demás (presencia/push/ofertas) ya funciona server-side.

**Precisión de producto:** la valla (100-150m) sirve para **ofertas de proximidad**; NO demuestra que el usuario **entró** al establecimiento ni que consumió. Presencia y check-in siguen siendo señales separadas (`source: gps|scan|geofence` — y el check-in requiere confirmación del usuario o scan).

**⚠️ Lo que el review exige y queda como criterio de P4:**
- iOS distingue 3 escenarios distintos: app **suspendida** / **terminada por el OS** / **force-quit por el usuario**. NO prometer despertar tras force-quit sin validarlo — iOS la conducta con force-quit no está garantizada para todos los APIs.
- **Matriz de pruebas nativas obligatoria antes de dar P4 por terminado** (dispositivos reales, iOS + Android):

| Escenario | iOS | Android |
|---|---|---|
| App abierta | ✅ trivial | ✅ trivial |
| App suspendida (background) | probar | probar |
| Terminada por el OS | probar | probar |
| Force-quit del usuario | probar (esperar: probablemente NO despierta) | probar |
| Permiso "Always" concedido vs "While using" | documentar diferencia | documentar |
| Reconstrucción de vallas al cambiar de zona | probar (moverse >5km y volver) | probar |
| Batería/restricciones del fabricante (Android) | n/a | probar (Xiaomi/Samsung matan background) |
| Evento de SALIDA de valla (para cerrar presencia) | probar | probar |

- Verificar capacidades reales del plugin elegido (registro/actualización de regiones, enter/exit, suspensión, terminación, permisos Always) **antes** de escribir el flujo final. Si el plugin gratuito no cubre iOS terminada, documentarlo y decidir: aceptar la limitación (app abierta reciente sí funciona) o subir a la opción pagada.

---

## 7. Android / FCM (P3) — paridad COMPLETA, no "ya manda FCM"

Checklist de cierre de fase (todo probado en device real):
- [ ] Registro del token FCM + asociación user/device
- [ ] Renovación de token (rotación) → upsert correcto
- [ ] Desactivación de tokens inválidos (messaging errors)
- [ ] Push en: foreground (banner), background (system tray), app terminada (cold start)
- [ ] Tap → deep-link al destino correcto (data.route)
- [ ] Canales Android por categoría (chat/rewards/proximity/orders/marketing) + comportamiento al desactivar un canal
- [ ] Prioridades y quiet hours respetadas
- [ ] Compatibilidad entre versiones de app (token viejo app antigua)

---

## 8. Catálogo de eventos (matriz v2 conservada + clase)

| # | Evento | Destinatario | type | Clase | Route | Estado |
|---|---|---|---|---|---|---|
| 1 | Chat nuevo mensaje | destinatario | CHAT | Comunicación | `/chat/{senderId}` | ✅ |
| 2 | Bunz recibidos (mint/cashback) | cliente | REWARD | Engagement | `/profile/wallet` | ✅ |
| 3 | Bunz canjeados | usuario | REWARD | Engagement | `/profile/wallet` | ✅ |
| 4 | Transferencia P2P | receptor | TRANSFER | Comunicación | `/profile/wallet` | ✅ |
| 5 | Referido completado | inviter | REFERRAL | Engagement | `/referral` | ✅ |
| 6 | Nivel/logro/hat-trick | usuario | LEVELUP/ACHIEVEMENT | Engagement | `/profile/gamification` | ✅ |
| 7 | Oferta flash de proximidad | cliente cerca | LOYALTY_OFFER | Marketing | `/affiliate/{businessId}` | ✅ |
| 8 | Prompt de check-in | cliente ≤40m | CHECKIN_PROMPT | Marketing | in-app modal / push vía geofence | ✅ in-app · ⏳ P4 |
| 9 | Cuenta lista (Enviar Cuenta) | cliente | AFFILIATE | Crítico | `/pay/{orderId}` | ✅ |
| 10 | Membresía otorgada/activada/renovada/revocada | miembro | REWARD/SYSTEM | Crítico | `/memberships` | ✅ |
| 11 | Canje de cortesía (al otorgante) | otorgante | AFFILIATE | Engagement | `/memberships` | ✅ |
| 12 | Nueva comanda / llegada (dueño) | owner | SYSTEM | Crítico | `/business-dashboard` | ✅ |
| 13 | Propinas al cierre de caja | owner/cajero | SYSTEM | Crítico | `/cash-shifts` | ⏳ P5 |
| 14 | Rating recibido (anti-spam: máx 1/día) | owner | SYSTEM | Engagement | `/ratings` | ⏳ P5 |
| 15 | Waitlist/mesa lista | usuario | WAITLIST | Crítico | `/affiliate/{id}` | ✅ |
| 16 | Cumpleaños/bono | usuario | BONUS | Engagement | `/profile` | ✅ |
| 17 | Marketing/campañas (opt-in) | segmento | MARKETING | Marketing | config | ⏳ P5 |
| 18 | Recibo de pago Stripe | cliente | RECEIPT | Crítico | `/profile/wallet` | ⏳ P5 |

---

## 9. Cambios de datos (una migración, en P0)

| Tabla | Cambio |
|---|---|
| `notifications_outbox` (nueva) | `id`, `userId`, `type`, `payload` jsonb, `dedupeKey` UNIQUE nullable, `status` (QUEUED/PROCESSED/FAILED), `attempts`, `runAfter`, `createdAt` |
| `notificationPreferences` (nueva) | `userId`, `type`, `enabled`, `channel`, `quietStart/End`, `tz` |
| `notificationDeliveries` (nueva) | `notificationId`, `deviceId`, `channel`, `status` (según §2.2), `reason`, `createdAt` |
| `notifications` | `+ dedupeKey UNIQUE nullable`, `+ priority` |
| `pushDevices` | `+ tz`, `+ appVersion` |

---

## 10. Roadmap v2.1 (reordenado según review)

| Fase | Entregable | Por qué en ese orden |
|---|---|---|
| **P0** | Contrato de eventos tipado + outbox + worker + estados de entrega + telemetría | plataforma confiable ANTES de sumar canales — sin esto, notify() hereda el riesgo de perder eventos |
| **P1** | `notify()` central + migración + conversión de los ~30 emisores | el 100% del catálogo con push real |
| **P2** | Realtime in-app (SSE/WebSocket sobre el mismo contrato): órdenes, pagos, chat, wallet, presencia | la app abierta se actualiza sola (experiencia Uber) |
| **P3** | APNs (ya) + FCM Android con paridad completa (§7) | multiplataforma ANTES de complejidad de ubicación |
| **P4** | Geofencing (§6) + matriz de pruebas nativas + consentimiento | push con app cerrada — sobre plataforma ya confiable |
| **P5** | Métricas operables + preferencias avanzadas + eventos 13/14/17/18 + badge + i18n | pulido |

## 11. Criterios de aceptación globales

- Ningún flujo de negocio depende del proveedor de push (outbox lo desacopla) — medible: latencia evento→QUEUED <50ms, y cero llamadas APNs dentro de transacciones de negocio.
- Toda notificación tiene: `dedupeKey` (cuando aplica), `route` navegable, `type` con preferencia, y registro de entrega.
- Un evento nunca se pierde: outbox con retry/backoff y `FAILED` observable.
- Realtime y push salen del MISMO contrato — agregar un canal no toca módulos de negocio.
- P4 no se cierra sin la matriz nativa de §6 completa y documentada.

## 12. Riesgos y mitigaciones (conservados)

| Riesgo | Mitigación |
|---|---|
| Fatiga de notificaciones | Quiet hours + cooldowns + rate-limit + MARKETING opt-in |
| Tokens muertos | Desactivación automática (ya) + métricas de invalidación |
| Duplicados (webhooks/retries) | dedupeKey UNIQUE + guards existentes |
| Apple y location en background | Consentimiento honesto + toggle + matriz nativa §6 |
| Latencia del worker (cron 30s) | Piggyback invocation en requests calientes + prioridad por clase (críticos se procesan en el mismo tick) |

---

## 13. Log de implementación

| Fecha | Fase | Qué |
|---|---|---|
| 2026-11-02 | **P0 ✅ (commit `364c2e6`)** | Contrato tipado en `packages/events` (NotificationEventType/RabbittyEvent/EventClass) · `notifications_outbox` + `notificationDeliveries` en prod (migración manual `0012`) · `lib/push/outbox.ts` (enqueue idempotente + batch con estados QUEUED→SENT→PROVIDER_ACCEPTED/RETRYING/FAILED, backoff 30s→15m, 4 intentos) · `POST /api/notifications` ahora encola + piggyback worker · worker cron + workflow GH cada 5 min · push-check muestra la cola viva. |
| — | **P1 ⏳** | Convertir los ~30 call sites inline (chat, memberships, ping, cron) → `enqueueOutbox`. |
| — | **P2 ⏳** | Realtime in-app sobre el mismo contrato (SSE/WebSocket). |
| — | **P3 ⏳** | FCM Android con checklist de paridad §7. |
| — | **P4 ⏳** | Geofencing (matriz nativa §6, requiere rebuild). |
| — | **P5 ⏳** | Métricas/deliveries UI, badge, recibos, i18n. |
