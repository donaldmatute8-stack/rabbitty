-- ── MCCE · Recuperación dinámica con propuestas y aceptación ─────────────────
-- Idempotente. No modifica datos existentes.
--   psql "$CORE_DATABASE_URL" -f packages/database-core/migrations/manual/0044_mcce_recovery_proposals.sql

CREATE TABLE IF NOT EXISTS "merchant_recovery_terms" (
  "affiliateId" text PRIMARY KEY NOT NULL,
  "targetMonths" integer DEFAULT 18 NOT NULL,
  "minCoverageDays" integer DEFAULT 7 NOT NULL,
  "rateMin" real DEFAULT 0.2 NOT NULL,
  "rateMax" real DEFAULT 0.6 NOT NULL,
  "status" text DEFAULT 'ACTIVE' NOT NULL,
  "acceptedAt" timestamp,
  "acceptedBy" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "merchant_recovery_proposals" (
  "id" text PRIMARY KEY NOT NULL,
  "affiliateId" text NOT NULL,
  "periodStart" timestamp NOT NULL,
  "periodEnd" timestamp NOT NULL,
  "grossGenerated" real DEFAULT 0 NOT NULL,
  "proposedRate" real DEFAULT 0 NOT NULL,
  "proposedAmount" real DEFAULT 0 NOT NULL,
  "outstandingBefore" real DEFAULT 0 NOT NULL,
  "outstandingAfter" real DEFAULT 0 NOT NULL,
  "availableBefore" real DEFAULT 0 NOT NULL,
  "availableAfter" real DEFAULT 0 NOT NULL,
  "coverageBefore" real,
  "coverageAfter" real,
  "status" text DEFAULT 'PENDING' NOT NULL,
  "acceptedAt" timestamp,
  "acceptedBy" text,
  "evidence" jsonb,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "merchant_recovery_proposals_affiliate_idx"
  ON "merchant_recovery_proposals" ("affiliateId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "merchant_recovery_proposals_status_idx"
  ON "merchant_recovery_proposals" ("status");
