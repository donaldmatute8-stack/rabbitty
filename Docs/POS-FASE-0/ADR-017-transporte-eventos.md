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
