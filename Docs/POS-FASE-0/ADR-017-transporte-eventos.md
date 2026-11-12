# ADR-017 · Transporte de eventos y aislamiento KDS

**Estado:** aprobado para diseño
**Fecha:** 11 de noviembre de 2026
**Decide:** D-02 (una librería, dos colas)
**Relacionado:** [`ADR-016`](./ADR-016-superficie-canonica.md) · [`ADR-020`](./ADR-020-impresion.md) · [`RIESGOS`](./RIESGOS.md)

---

## 1. Contexto

El KDS "en tiempo real" hoy **no recibe eventos de la caja**: las órdenes nacen en el servicio `admin` y el bus de eventos es en memoria del proceso que lo emite.

## 2. Evidencia

| Hecho | Ubicación |
|---|---|
| Bus en memoria (Map de listeners), sin cruzar procesos | `packages/events/src/bus.ts` |
| SSE del KDS se suscribe a ese bus local | `apps/kds/src/app/api/sse/route.ts` |
| Refresco real de la pantalla: polling 10 s | `apps/kds/src/app/page.tsx` → `refetchInterval: 10_000` |
| Sin replay: no hay `Last-Event-ID` ni cursor | `api/sse/route.ts` |
| Centrifugo ya desplegado | servicio Railway `rabbitty-realtime` (imagen `centrifugo/centrifugo:v6`) |
| Cliente Centrifugo ya en uso | `telegram-miniapp/src/lib/realtime/useRealtimeChat.ts` (`centrifuge@5.8`) |
| Patrón outbox probado en producción | `telegram-miniapp/src/lib/realtime/chatOutbox.ts` + cron `chat-outbox` |

## 3. Decisión

**Una sola implementación de publicación, dos colas.**

```
packages/realtime/
  claim.ts     ← claim con FOR UPDATE SKIP LOCKED, lease, backoff exponencial, MAX_ATTEMPTS
  publish.ts   ← HTTP API de Centrifugo (idéntico al actual)
  types.ts     ← contrato de evento y canal

chat_event_outbox   (intacta · producción · dueño: miniapp)
realtime_outbox     (nueva · POS/KDS · dueño: admin)
```

### 3.1 Por qué una tabla nueva y no generalizar la existente

| Bloqueo | Evidencia |
|---|---|
| `conversationId` es `NOT NULL` y el canal se deriva de ella | `chatChannel(conversationId)` en `chatOutbox.ts` |
| El publisher vive en `telegram-miniapp` con `@/db` app-local; los crons de POS viven en `apps/admin` (Railway) | import no compartible entre apps |
| Generalizar exige migrar filas de chat y coordinar despliegue de dos servicios | riesgo en producción sin beneficio funcional |

**Alternativa descartada:** una tabla única con `scope`. Motivo: obliga a tocar chat productivo y a releases sincronizados.

### 3.2 Canales y aislamiento

```
biz:{businessId}:branch:{branchId}:station:{stationId}
biz:{businessId}:branch:{branchId}:expediter
```

- Token de conexión con claims `{ sub: terminalId, info: { businessId, branchId, stationId, role } }`.
- Token **por canal exacto**; prohibido cualquier comodín (`*`).
- El emisor valida que `terminalId` pertenezca a ese `branchId` (tabla `pos_terminals` ya existente).
- Una cocina **no puede** suscribirse al canal de otro afiliado ni de otra sucursal.

### 3.3 Flujo

```
POS (tx)  →  orders + realtime_outbox        [atómico]
cron realtime-outbox (10 s) → Centrifugo HTTP API
KDS ← evento → si version > local: consulta snapshot de su estación
KDS al reconectar → GET /api/kds/snapshot?stationId=…&since=<seq>
```

La base de datos sigue siendo la fuente de verdad. Centrifugo **transporta**, no registra.

## 4. Contrato de evento

```json
{
  "eventId": "uuid",
  "eventType": "order.created | order.item.updated | order.voided | order.paid",
  "seq": 12345,
  "businessId": "…", "branchId": "…", "stationId": "…",
  "orderId": "…", "orderVersion": 7,
  "emittedAt": "2026-11-11T18:00:00Z",
  "payload": { "items": [ … ] }
}
```

Deduplicación en cliente por `eventId`; orden por `seq`. Entrega **at-least-once** (igual que chat).

## 5. Polling durante 30 días

Se mantiene `refetchInterval: 10_000` como red de seguridad. Retirarlo requiere:

- 30 días de observación continua,
- cero eventos perdidos,
- pruebas de reconexión documentadas,
- métricas de latencia p95.

## 6. Riesgos

| Riesgo | Mitigación |
|---|---|
| Evento duplicado en cliente | Dedupe por `eventId` |
| Evento perdido tras reconexión | `since=seq` + snapshot |
| Suscripción cruzada entre tenants | Token por canal + validación en emisor |
| Romper chat al extraer la librería | `chat_event_outbox` y su publisher **no se tocan** en 0B; se extrae solo lo genérico |
| Publisher caído | Backoff + `runAfter`, y polling como piso |

## 7. Criterios de aceptación

- [ ] Un solo worker, un set de métricas, una alerta.
- [ ] KDS reconectado reconstruye su estado desde base en <5 s.
- [ ] Test de aislamiento: token de sucursal A no puede suscribirse a canal de B.
- [ ] Chat sin cambios de comportamiento.

## 8. Rollback

Apagar el publisher de POS. El KDS queda con polling 10 s (comportamiento actual). Cero impacto en chat.

## 9. Evidencia

- `packages/events/src/bus.ts`
- `apps/kds/src/app/page.tsx`, `apps/kds/src/app/api/sse/route.ts`
- `telegram-miniapp/src/lib/realtime/chatOutbox.ts` (claim, lease, backoff, `MAX_ATTEMPTS = 8`)
- `telegram-miniapp/src/app/api/cron/chat-outbox/route.ts`


---

## 10. Implementación 0C-5 (12-nov-2026) — parte servidor

**Migración `0040`:** `realtime_outbox` (id, businessId, branchId, channel,
eventType, eventId único, payload, seq, status, attempts, runAfter, lockedUntil).

**Servicio `realtimeOutbox.ts`:**
- `stationChannel(businessId, branchId, stationId)` → `biz:{tenant}:branch:{b}:station:{s}`.
- `enqueueRealtimeEvent(tx, …)` — escribe en la MISMA transacción de la orden.
- `processRealtimeOutboxBatch(db)` — claim con `SKIP LOCKED`, publica a la HTTP API
  de Centrifugo, backoff exponencial, 8 intentos, `FAILED` al agotar.

**Emisores conectados:** `pos.addToCart` (`order.item.added`) y
`kds.updateOrderItemStatus` (`order.item.updated`), ambos al canal de la estación
del ítem.

**Worker:** `POST /api/cron/realtime-outbox` (auth `CRON_SECRET`/`RABBITTY_API_SECRET`).

### Validado en staging

```
evento encolado → publicado → status SENT (seq 1)
Centrifugo aceptó el publish
```

### Producción

```
deploy SUCCESS · / y /pos → 200
/api/cron/realtime-outbox → { configured: true }
outbox: 0 eventos (aún sin tráfico)
```

### Lo que falta para cerrar 0C-5

El **cliente**: `apps/kds` todavía usa polling. Para consumir el push hace falta:

1. Token de conexión por estación (`CENTRIFUGO_TOKEN_SECRET` en kds/admin).
2. Cliente `centrifuge` en `apps/kds` suscrito a su canal.
3. Mantener el polling 30 días como red de seguridad (decisión de dirección).

Mientras eso no exista, el servidor ya no pierde eventos: quedan en el outbox y el
KDS los recupera al refrescar (snapshot).

---

## 11. Implementación 0C-5 (12-nov-2026) — cliente y cierre

### Lo que se validó en producción antes del cliente

Con un cliente Node contra el Centrifugo real:

```
conectado → suscrito al canal de la estación
publisher del outbox → published: 1
publicación recibida: eventId coincide · seq 2 · status SENT
```

Eso confirmó que la firma, el canal y el worker funcionan. Faltaba el navegador.

### Namespace `biz` (hallazgo)

La primera suscripción real falló con `code 102 unknown channel`: Centrifugo
interpreta el prefijo antes de `:` como *namespace* y solo existía `chat`.
Se agregó al servicio `rabbitty-realtime`:

```json
{ "name": "biz", "presence": false, "join_leave": false,
  "history_size": 0, "history_ttl": "0s", "allow_subscribe_for_client": false }
```

Con `allow_subscribe_for_client: false` el cliente **debe** mandar token de
suscripción, que es justo lo que emite el servidor.

### Cliente del KDS

`apps/kds/src/hooks/useKdsRealtime.ts`:

- pide `/api/realtime/token?stationId=…` (el servidor decide el canal);
- abre `Centrifuge` con token de conexión y `getToken` para renovarlo;
- `newSubscription(channel, { token, getToken })` y `on("publication")`;
- agrupa ráfagas con un debounce de 250 ms y solo invalida la cola activa;
- al volver del segundo plano refresca y reconecta;
- sin estación elegida no se conecta (modo "todas" sigue con polling).

El polling de 10 s y el SSE se mantienen: el push adelanta el refresco, nunca
sustituye a la base. El estado se muestra en la cabecera
(*En vivo · Conectando · Solo polling*).

### Seguridad del canal (corregido)

La primera versión de `/api/realtime/token` firmaba **cualquier** canal que
empezara por `biz:`; con eso, adivinar un id ajeno bastaba para escuchar otro
negocio. Ahora:

1. el cliente manda `stationId`, nunca el canal;
2. `resolveKdsCaller` autentica por **token de terminal** o por **sesión**
   (misma pieza para tRPC y para el token);
3. la estación debe pertenecer a la sucursal del llamante;
4. una terminal atada a Barra no puede pedir el canal de Cocina.

### Contexto del KDS (bug de producción encontrado)

El handler tRPC del KDS exigía `BRANCH_ID` y no leía el token de terminal: en
producción devolvía **500** en *todas* las llamadas (`BRANCH_ID env var is
required`), así que la pantalla estaba caída. Se sustituyó por
`services/kdsContext.ts`, que replica el criterio del admin:

```
terminal POS (x-pos-terminal-token)  →  sucursal y estación del dispositivo
sesión NextAuth                      →  staff → sucursal, o negocio del dueño
BRANCH_ID                            →  solo si está configurado (staging)
nada                                 →  403 "Sin sucursal asignada"
```

### Validación en staging

```
sin token                 → 403 (antes: 500)
token de terminal         → 200 · estaciones correctas
getStationQueue(Barra)    → 200
getStationQueue(Cocina)   → 403 (terminal atada a Barra)
token realtime Barra      → 200 · canal biz:…:station:Barra
token realtime Cocina     → 403
suscripción con esos JWT  → aceptada por Centrifugo
```

### Producción

`POS_TERMINAL_SESSIONS=1` y `POS_OPERATOR_SESSIONS=1` también en el KDS, para
que una tablet pueda operar con su token sin sesión de admin.

### Pendiente

- Retirar el polling cuando se cumplan 30 días de estabilidad (decisión de
  dirección; hoy es la red de seguridad).
