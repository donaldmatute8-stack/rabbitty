-- 0034_chat_conversation_kind_audience.sql
-- Hace EXPLÍCITA la diferencia entre chats de negocio y entre Rabbitters.
--
--   kind:     DIRECT  | GROUP
--   audience: BUSINESS | PEER
--
-- Antes se infería con "¿algún participante es un negocio?" — frágil (el
-- founder es dueño de su propio local y su chat de cliente se clasificaba mal).
-- Idempotente + backfill de lo existente.

ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "kind" text NOT NULL DEFAULT 'DIRECT';
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "audience" text NOT NULL DEFAULT 'BUSINESS';

-- Backfill: si NINGÚN participante es un negocio afiliado, es PEER.
UPDATE "conversations" c
SET "audience" = 'PEER'
WHERE NOT EXISTS (
  SELECT 1 FROM "ownedBusinesses" b
  WHERE b.id = c."participant1" OR b.id = c."participant2"
);

CREATE INDEX IF NOT EXISTS "conversations_audience_idx"
  ON "conversations" ("audience");

CREATE INDEX IF NOT EXISTS "conversations_kind_idx"
  ON "conversations" ("kind");
