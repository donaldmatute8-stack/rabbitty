-- 0035_chat_group_members.sql
-- Base para GRUPOS de chat (Rabbiter ↔ Rabbitter).
--
-- Un DIRECT sigue usando participant1/2; un GROUP usa esta tabla. El backfill
-- crea los dos miembros de cada conversación existente para que, al migrar la
-- autorización, los 1:1 se comporten EXACTAMENTE igual.
-- Idempotente.

CREATE TABLE IF NOT EXISTS "conversation_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversationId" text NOT NULL,
  -- Puede ser un userId o un businessId (mismo criterio que participant1/2).
  "userId" text NOT NULL,
  -- ADMIN | MEMBER (el creador es ADMIN)
  "role" text NOT NULL DEFAULT 'MEMBER',
  "joinedAt" timestamp DEFAULT now(),
  "leftAt" timestamp,
  "lastReadAt" timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS "conversation_members_uq"
  ON "conversation_members" ("conversationId", "userId");

CREATE INDEX IF NOT EXISTS "conversation_members_user_idx"
  ON "conversation_members" ("userId");

-- ── Backfill de los DIRECT existentes (idempotente) ──
INSERT INTO "conversation_members" ("conversationId", "userId", "role")
SELECT id, "participant1", 'MEMBER'
FROM "conversations"
WHERE "participant1" IS NOT NULL AND "participant1" <> ''
ON CONFLICT DO NOTHING;

INSERT INTO "conversation_members" ("conversationId", "userId", "role")
SELECT id, "participant2", 'MEMBER'
FROM "conversations"
WHERE "participant2" IS NOT NULL AND "participant2" <> ''
ON CONFLICT DO NOTHING;
