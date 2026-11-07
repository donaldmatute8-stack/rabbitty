-- ── MCCE · Términos de recuperación y cobertura ──────────────────────────────
-- Idempotente. No modifica datos existentes.
--   psql "$CORE_DATABASE_URL" -f packages/database-core/migrations/manual/0043_mcce_terms.sql

ALTER TABLE "merchant_capacity_accounts"
  ADD COLUMN IF NOT EXISTS "creditDisbursed" real DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "merchant_capacity_accounts"
  ADD COLUMN IF NOT EXISTS "creditRepaid" real DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "merchant_capacity_accounts"
  ADD COLUMN IF NOT EXISTS "retainShare" real DEFAULT 0.4 NOT NULL;
--> statement-breakpoint
ALTER TABLE "merchant_capacity_accounts"
  ADD COLUMN IF NOT EXISTS "coverageDays" integer DEFAULT 7 NOT NULL;
--> statement-breakpoint

UPDATE "merchant_capacity_accounts"
SET "creditDisbursed" = 1200,
    "creditRepaid" = 0,
    "creditOutstanding" = 1200,
    "retainShare" = 0.4,
    "coverageDays" = 30,
    "updatedAt" = now()
WHERE "affiliateId" = 'fb7f4847-920f-4482-8ae3-c810a20e75ad';
