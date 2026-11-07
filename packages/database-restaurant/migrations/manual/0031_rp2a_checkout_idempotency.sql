-- ── RP-2A · Idempotencia del cobro ──────────────────────────────────────────
-- Idempotente. No modifica datos existentes.
--   psql "$RESTAURANT_DATABASE_URL" -f packages/database-restaurant/migrations/manual/0031_rp2a_checkout_idempotency.sql

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "idempotencyKey" text;
--> statement-breakpoint
-- Índice único completo: en Postgres los NULL son distintos, así que las
-- órdenes sin clave conviven sin problema (y `ON CONFLICT` puede inferirlo).
CREATE UNIQUE INDEX IF NOT EXISTS "orders_idempotency_key_idx"
  ON "orders" ("idempotencyKey");
