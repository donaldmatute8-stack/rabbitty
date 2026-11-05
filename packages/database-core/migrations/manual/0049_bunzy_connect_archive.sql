-- 0049_bunzy_connect_archive.sql
-- Bunzy Connect: estado del comunicado por destinatario (UNREAD → OPENED → ARCHIVED).
-- Aditiva: no toca datos existentes.

ALTER TABLE "bunzyDeliveries" ADD COLUMN IF NOT EXISTS "archivedAt" timestamp;

CREATE INDEX IF NOT EXISTS "bunzy_deliveries_recipient_archive_idx"
  ON "bunzyDeliveries" ("recipientType", "recipientId", "archivedAt");
