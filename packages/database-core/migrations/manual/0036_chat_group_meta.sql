-- 0036_chat_group_meta.sql
-- Metadatos de grupo (los DIRECT los dejan en NULL). Idempotente.
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "avatarUrl" text;
