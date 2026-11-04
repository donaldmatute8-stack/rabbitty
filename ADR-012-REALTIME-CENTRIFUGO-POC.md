# ADR-012 · Realtime con Centrifugo — PoC local (Fase 2) **GO**

**Fecha:** 2026-11-04 · **Estado:** PoC validada en local · **Deploy:** pendiente (decisión de costo)

---

## Decisión

Usar **Centrifugo OSS v6** como transporte de mensajería en tiempo real, con
**Postgres como única fuente de verdad**. Centrifugo no guarda el chat: solo
entrega eventos y conserva historial temporal para recovery.

La PoC se hizo **aislada** (canal `chat:demo`), sin tocar el chat real, y
**local en Docker** (costo cero), como pide el plan.

---

## Resultado: 7/7 criterios · GO

Servidor **v6.10.2** (`centrifugo/centrifugo:v6`, motor `memory`, `localhost:8000`).

| # | Criterio | Resultado |
|---|---|---|
| 1 | Conexión sin token | ❌ rechazada · `disconnected 3501` |
| 2 | Conexión con token firmado | ✅ `connected` |
| 3 | Subscribe sin token de suscripción | ❌ nunca llega a `subscribed` |
| 4 | Subscribe con token de suscripción | ✅ `subscribed` |
| 5 | Publish desde el cliente | ❌ rechazado · código `103` |
| 6 | Latencia publish(API)→recibir (n=100) | ✅ **p50 6 ms · p95 15 ms · max 20 ms** |
| 7 | Recovery (3 mensajes publicados con el cliente caído) | ✅ **3/3 recuperados** |

Criterio del plan para pasar a Fase 3: p95 < 300 ms · sin pérdida en reconexión ·
seguridad verificada contra la versión real. **Cumplido.**

---

## Cómo reproducirlo

```bash
cd telegram-miniapp
docker compose -f docker-compose.centrifugo.yml up -d      # contenedor + healthcheck
node scripts/centrifugo-poc.mjs                            # 7 criterios, exit 0
docker compose -f docker-compose.centrifugo.yml down
```

Archivos:
- `telegram-miniapp/docker/centrifugo/config.json` — configuración (dev).
- `telegram-miniapp/docker-compose.centrifugo.yml` — contenedor + healthcheck.
- `telegram-miniapp/scripts/centrifugo-poc.mjs` — suite de verificación.
- `telegram-miniapp/src/lib/realtime/centrifugo.ts` — firma de tokens.
- `telegram-miniapp/src/app/api/realtime/centrifugo/route.ts` — emisión de tokens.

---

## Modelo de seguridad (verificado, no supuesto)

| Pieza | Regla |
|---|---|
| Token de **conexión** | HS256 `{ sub: userId, exp: now+600 }` |
| Token de **suscripción** | HS256 `{ sub: userId, channel: "chat:conv_<id>", exp: now+600 }` |
| Autorización de canal | `allow_subscribe_for_client: false` → **todo canal exige token** |
| Publish del cliente | **deshabilitado**; solo el servidor publica con `http_api.key` |
| Emisión | `POST /api/realtime/centrifugo` firma el token de suscripción **solo** tras verificar pertenencia con `resolveConversationAccess` (404/403 si no) |
| Degradación | sin `CENTRIFUGO_TOKEN_SECRET` → `enabled:false` y el cliente sigue en polling |

---

## Aprendizajes de v6 (la config cambió respecto a v5)

- `token_hmac_secret_key` → ahora **`client.token.hmac_secret_key`**.
- `api_key` → **`http_api.key`**.
- `allowed_origins` → **`client.allowed_origins`**.
- `admin` es **objeto** `{enabled, password, secret}` (no booleano).
- **No existe `/health`** (404): el healthcheck usa `/`.
- Sin token → evento **`disconnected` 3501**; subscribe sin token → **`unsubscribed` silencioso**.

> Si en el futuro se actualiza la imagen, correr `centrifugo checkconfig` **y** el
> script de la PoC: la config de v6 no es compatible con la de v5.

---

## Variables de entorno (para el deploy)

```bash
# Backend (server-only)
CENTRIFUGO_TOKEN_SECRET=<secreto HS256 de >=32 chars>
# Cliente (público)
NEXT_PUBLIC_CENTRIFUGO_URL=wss://<host>/connection/websocket
# Solo PoC local (permite el canal chat:demo)
REALTIME_POC_ENABLED=1
```

---

## Pendiente (Fase 3 en adelante)

1. **Hosting:** decidir Railway y aceptar el costo del servicio (OSS no cobra
   licencia, el hosting sí).
2. **Device real:** WebSocket desde el WebView con la app en segundo plano.
3. **Canales por conversación** (`chat:conv_<id>`) + presencia por sesiones
   (nunca por GPS) según Fase 3 del plan.
4. **Worker del outbox** publicando a Centrifugo (Fase 4) — el mensaje se
   persiste en Postgres primero; Centrifugo es solo el aviso.

---

## Fase 3 · Presencia por sesiones (implementada)

**Tabla `chat_connections`** (migración `0031`): `userId`, `sessionId`, `platform`,
`connectedAt`, `lastSeenAt`, `disconnectedAt` + índice único `(userId, sessionId)`.

Reglas:
- "En línea" = **la app está conectada**, nunca GPS ni estar en el local
  (`presenceSessions` sigue siendo de analytics y no se reutiliza).
- **Multi-device**: la presencia se deriva de las sesiones activas
  (`BOOL_OR(disconnectedAt IS NULL AND lastSeenAt > now() - 90s)`); si un device
  cae, el otro mantiene online al usuario.
- **TTL 90 s** para desconexión abrupta + cierre limpio por `DELETE`.
- **Typing sin DB**: si realtime está activo, `/api/chat/typing` publica un evento
  transient y **no escribe** en Postgres (columnas legacy solo como fallback).

Archivos: `src/lib/realtime/presence.ts`, `src/app/api/chat/presence/route.ts`
(POST heartbeat + DELETE cierre), `src/app/api/chat/typing/route.ts`.

## Fase 4 · Outbox de eventos de chat (implementada)

**Tabla `chat_event_outbox`** (misma migración): el evento se inserta **en la
misma transacción** del `INSERT` del mensaje → nunca hay mensaje sin aviso.

- `enqueueChatEvent(tx, …)` dentro de la tx de `/api/chat/send`.
- Worker `processChatOutboxBatch()`: reclama con `FOR UPDATE SKIP LOCKED`,
  publica a Centrifugo (`X-API-Key`), reintenta con backoff exponencial (máx 8)
  y marca `PROCESSED` / `FAILED`. Piggyback tras el envío + cron de piso
  (`POST /api/cron/chat-outbox`, `Authorization: Bearer CRON_SECRET`).
- Cliente `useRealtimeChat`: pide tokens, se suscribe a `chat:conv_<id>`,
  entrega mensajes (el caller deduplica por `id`), typing, y heartbeat de
  presencia. **Si el backend no lo habilita, no hace nada** y el chat sigue con
  su polling: degradación limpia.
- Contrato del evento: `{ eventId, eventType: 'message.created' | 'typing',
  messageId, conversationId, senderId, content, type, metadata, createdAt }`.
  `eventType` identifica el evento; `type` es el tipo de mensaje (TEXT/VOICE).

## Validaciones ejecutadas (2026-11-04)

| Prueba | Resultado |
|---|---|
| `scripts/centrifugo-poc.mjs` (seguridad + latencia + recovery) | ✅ 7/7 · p95 15 ms |
| `scripts/chat-realtime-e2e.mjs` (contrato worker↔cliente) | ✅ 5/5 · tercero no entra · cliente no publica (103) |
| Worker real contra Postgres (dev server + cron) | ✅ `processed:1 published:1` y el cliente recibió el evento |

## Antes de activarlo en producción

1. Desplegar Centrifugo (Railway) y definir `CENTRIFUGO_*` + `NEXT_PUBLIC_CENTRIFUGO_URL`.
2. Configurar el cron `chat-outbox` cada 1–2 min.
3. Probar en device: mensaje con la app abierta (<500 ms), recepción con la app
   en segundo plano, reconexión tras modo avión, y "En línea" multi-device.
4. Canary: primero interno, luego % de usuarios.
