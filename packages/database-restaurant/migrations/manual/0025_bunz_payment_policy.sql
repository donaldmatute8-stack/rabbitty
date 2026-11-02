-- ── H16: Pagos con Bunz — reglas comerciales del afiliado (Nivel B) ──
-- Catálogo del server en bunzPaymentsPolicy; el afiliado no toca reglas globales.
-- Idempotente. Norma DRIFT-001:
--   psql "$CORE_DATABASE_URL" -f packages/database-restaurant/migrations/manual/0025_bunz_payment_policy.sql
ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "bunzAvailabilityMode" text DEFAULT 'ALWAYS' NOT NULL;
--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "bunzSchedule" text DEFAULT '{}' NOT NULL;
--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "bunzMinOrderAmount" real DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "bunzMaxOrderAmount" real DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "bunzDailyLimit" integer DEFAULT 0 NOT NULL;
