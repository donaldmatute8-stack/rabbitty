-- ── Gratificaciones voluntarias (D-11) ── catálogo Rabbitty + modo por canal.
-- Server guard en gratuityRules (nada condicionado al método de pago, cap 15%).
-- Idempotente. Norma DRIFT-001:
--   psql "$CORE_DATABASE_URL" -f packages/database-restaurant/migrations/manual/0023_gratuity_config.sql
ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "gratuityMode" text DEFAULT 'OFF' NOT NULL;
--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "gratuityPcts" text DEFAULT '[]' NOT NULL;
