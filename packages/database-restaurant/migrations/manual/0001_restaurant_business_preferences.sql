-- ── Preferencias del negocio en restaurantes ────────────────────────────────
-- Idempotente. La app usaba localStorage; ahora se sincroniza por negocio.
--   psql "$RESTAURANT_DATABASE_URL" -f packages/database-restaurant/migrations/manual/0001_restaurant_business_preferences.sql

ALTER TABLE "restaurants"
  ADD COLUMN IF NOT EXISTS "businessType" text DEFAULT 'restaurant' NOT NULL;
--> statement-breakpoint
ALTER TABLE "restaurants"
  ADD COLUMN IF NOT EXISTS "activeModules" text DEFAULT '[]' NOT NULL;
