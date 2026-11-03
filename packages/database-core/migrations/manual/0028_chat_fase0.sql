-- Mensajería Fase 0 (plan RABBITTY-MENSAJES-PLAN §4) — solo aditivo.
-- Documento ADR versionado del cambio: ADR-010-MENSAJERIA-FASE0.md (repo root).
--
-- Puntos:
-- 1) Cero índices en chat (seq scans en inbox/unread/history) → 5 índices.
-- 2) `messages.clientMessageId` + UNIQUE parcial → idempotencia de envío
--    (requisito del outbox at-least-once; el outbox puede republicar, el
--    cliente no debe ver duplicados).
--
-- Aplicar con psql (norma DRIFT-001), nunca db:migrate:
--   psql "$CORE_DATABASE_URL" -1 -v ON_ERROR_STOP=1 -f packages/database-core/migrations/manual/0028_chat_fase0.sql
-- Rollback documentado al final del archivo (comentado).

-- ── 1. Índices de conversaciones (ambas orientaciones del par) ──
CREATE INDEX IF NOT EXISTS conversations_p1_idx
  ON "conversations" ("participant1", "participant2", "updatedAt");
CREATE INDEX IF NOT EXISTS conversations_p2_idx
  ON "conversations" ("participant2", "participant1", "updatedAt");
CREATE INDEX IF NOT EXISTS conversations_last_message_idx
  ON "conversations" ("lastMessageAt");

-- ── 2. Índices de mensajes (cursor compuesto + scan de unread) ──
CREATE INDEX IF NOT EXISTS messages_conv_created_idx
  ON "messages" ("conversationId", "createdAt", "id");
CREATE INDEX IF NOT EXISTS messages_sender_read_idx
  ON "messages" ("senderId", "readAt");

-- ── 3. Idempotencia de envío ──
ALTER TABLE "messages"
  ADD COLUMN IF NOT EXISTS "clientMessageId" text;

CREATE UNIQUE INDEX IF NOT EXISTS messages_client_id_uidx
  ON "messages" ("conversationId", "clientMessageId")
  WHERE "clientMessageId" IS NOT NULL;

-- ── Rollback (documentado, reversa exacta) ──
-- DROP INDEX IF EXISTS messages_client_id_uidx;
-- DROP INDEX IF EXISTS messages_sender_read_idx;
-- DROP INDEX IF EXISTS messages_conv_created_idx;
-- DROP INDEX IF EXISTS conversations_last_message_idx;
-- DROP INDEX IF EXISTS conversations_p2_idx;
-- DROP INDEX IF EXISTS conversations_p1_idx;
-- ALTER TABLE "messages" DROP COLUMN IF EXISTS "clientMessageId";
