-- 0048_bunzy_connect_queue_retry.sql
-- C4 hardening: lock y reintentos de la cola. Aditiva.

ALTER TABLE "bunzyDeliveries" ADD COLUMN IF NOT EXISTS "attempts" integer NOT NULL DEFAULT 0;
ALTER TABLE "bunzyDeliveries" ADD COLUMN IF NOT EXISTS "lockedUntil" timestamp;
