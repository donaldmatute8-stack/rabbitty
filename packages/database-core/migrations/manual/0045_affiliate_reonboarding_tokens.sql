-- ── Re-onboarding de afiliados existentes con token de un solo uso ───────────
-- Idempotente.
--   psql "$CORE_DATABASE_URL" -f packages/database-core/migrations/manual/0045_affiliate_reonboarding_tokens.sql

CREATE TABLE IF NOT EXISTS "affiliate_reonboarding_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "affiliateId" text NOT NULL,
  "tokenHash" text NOT NULL UNIQUE,
  "expiresAt" timestamp NOT NULL,
  "usedAt" timestamp,
  "createdBy" text,
  "metadata" jsonb,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_reonboarding_affiliate_idx"
  ON "affiliate_reonboarding_tokens" ("affiliateId");
