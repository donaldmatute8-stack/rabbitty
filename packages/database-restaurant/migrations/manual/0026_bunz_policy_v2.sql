-- ── H16-2: Pagos con Bunz — productos, % facturable y overrides por sucursal ──
-- Idempotente. Norma DRIFT-001:
--   psql "$CORE_DATABASE_URL" -f packages/database-restaurant/migrations/manual/0026_bunz_policy_v2.sql
ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "bunzMaxPctOfBill" integer DEFAULT 100 NOT NULL;
--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "bunzAllowedProducts" text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "bunzOverride" text DEFAULT '{}' NOT NULL;
