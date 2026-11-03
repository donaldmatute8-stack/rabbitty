# ADR-010 — Mensajería: decisiones de Fase 0 (RABBITTY MENSAJES)

> **Estado:** Aceptado · **Fecha:** 2026-11-03 · **Rama:** `feat/mensajeria`
> **Contexto:** plan completo en `RABBITTY-MENSAJES-PLAN.md` (local, gitignored) —
> este ADR versiona las decisiones del PR de Fase 0 para que queden en el
> historial compartido (petición del asesor, §6 del dictamen).

## Decisión A — Cursor compuesto (Fase 0.2/0.3)

- **Cursor = `(createdAt, id)` ordenado**, codificado `v1:<epochMs>:<id>`.
- Un solo `lastMessageId` no sirve: uuid v4 no representa orden y hay empates
  de timestamp; el desempate por id da orden total.
- El código vive en `packages/events/src/chatCursor.ts` (contrato compartido,
  re-exportado por la miniapp) y el delta/paginación en `GET /api/chat/history`
  (`after` = delta desde el cursor confirmado; `before` = carga de antiguos;
  sin cursor = últimas 50).
- El cursor **avanza cuando el cliente procesó el lote** (al pintar), no al
  recibir la respuesta HTTP.

## Decisión B — Idempotencia de envío en Fase 0 (no Fase 1)

- `messages.clientMessageId` (null-able, del cliente) + **UNIQUE parcial**
  `(conversationId, clientMessageId)`. Enviado tras timeout → reintento → el
  server regresa el MISMO mensaje (`replayed: true`), cero duplicados.
- Es requisito del outbox confiable: si el cliente reintenta su POST, el
  `clientMessageId` no cambia ⇒ el outbox no recibe un segundo evento.
- La respuesta del bot (Bunzy) y el AUTO_REPLY fuera de horario usan claves
  derivadas (`bot_{msgId}`, `auto:{conv}:{window}`) — el AUTO_REPLY pierde su
  race SELECT-then-INSERT con la misma constraint.

## Decisión C — Notificación de chat transaccional

- El evento `chat_msg:{messageId}` se escribe en `notifications_outbox`
  **dentro de la misma transacción** que inserta el mensaje y actualiza la
  conversación. El `void fire-and-forget` de `notifyChatRecipient` se degrada
  a best-effort **post-commit** (Telegram DM + replay idempotente por
  dedupeKey — el outbox lleva la autoridad).
- Entrega **at-least-once**: el worker puede republicar; dedupeKey server-side
  + dedupe por `messageId` en el cliente ⇒ cero duplicados a la vista.

## Decisión D — GET no muta estado (.7)

- `GET /api/chat/history` ya **no marca leídos** (ni readAt ni campana).
- Nuevo `POST /api/chat/mark-read`: marca `readAt` de los mensajes del otro y
  la campana del hilo. El cliente lo llama con **pantalla visible** (precarga,
  background y retry no "leen" por el usuario).
- El admin ya tenía su versión (H-CHAT-TRUTH, `customerChat.markRead`) —
  con esto, móvil y admin comparten la MISMA verdad de lectura.

## Decisión E — Rate limit (0.8) con regla "reutilizar primero"

- El limiter existente (`packages/api/src/middleware/rateLimit.ts`) es tRPC-
  acoplado (Redis si `REDIS_URL`, memoria si no). La miniapp no puede importar
  el paquete api — se documenta una contraparte autocontenida
  (`telegram-miniapp/src/lib/chatRateLimit.ts`) con el mismo patrón.
- **Por identidad autenticada** (`chat_send:{userId}`, 20/min), nunca por IP.
- Require backend distribuido nuevo? No: mismo Redis que ya corre (P0 push).
  Si algún día se saca Redis, el fallback memoria opera por instancia serverless
  — límite global no garantizado; decisión aceptada y limitada al MVP.

## Decisión F — Cero media nueva en jsonb (0.9)

- `type:'VOICE'` con `metadata.voiceDataUrl` se **capa a 200KB** en el server.
  No es la solución final (esa es storage de objetos, workstream media M-3);
  congela el TOAST bloat de Neon mientras tanto. La voz histórica se migra
  en ese workstream, nunca en este PR.

## Índices/migración

- `0028_chat_fase0.sql` (aplicada a prod con psql, norma DRIFT-001): 5 índices
  (conversaciones en ambas orientaciones, lastMessageAt, mensajes por
  conversation+createdAt+id para el cursor, sender+readAt para unread) +
  columna `clientMessageId` + UNIQUE parcial. Rollback documentado en el
  archivo SQL.

## Fuera de alcance de este PR (recuerda del plan)

- Realtime (Centrifugo): Fase 2 PoC local, GO/NO-GO antes de Fase 3.
- Storage de media (M-3), presencia `chatConnections` (Fase 3), grupos.
- Ningún writer económico de Bunzy cambió: los contratos `metadata.kind`
  (ORDER/TRANSFER/RECEIVE_QR) quedaron intactos (verificado por diff).
