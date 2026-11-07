-- ── MCCE · Capacidad comercial y cuentas de prueba ──────────────────────────
-- Idempotente. No modifica datos existentes.
--   psql "$CORE_DATABASE_URL" -f packages/database-core/migrations/manual/0041_mcce_capacity.sql

ALTER TABLE "ownedBusinesses"
  ADD COLUMN IF NOT EXISTS "sandbox" boolean DEFAULT false NOT NULL;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "merchant_capacity_accounts" (
  "affiliateId" text PRIMARY KEY NOT NULL,
  "status" text DEFAULT 'PROPOSED' NOT NULL,
  "authorizedTotal" real DEFAULT 0 NOT NULL,
  "promoAuthorized" real DEFAULT 0 NOT NULL,
  "creditAuthorized" real DEFAULT 0 NOT NULL,
  "provisioned" real DEFAULT 0 NOT NULL,
  "generated" real DEFAULT 0 NOT NULL,
  "committed" real DEFAULT 0 NOT NULL,
  "available" real DEFAULT 0 NOT NULL,
  "creditOutstanding" real DEFAULT 0 NOT NULL,
  "sandbox" boolean DEFAULT false NOT NULL,
  "notes" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "merchant_capacity_events" (
  "id" text PRIMARY KEY NOT NULL,
  "affiliateId" text NOT NULL,
  "type" text NOT NULL,
  "actor" text DEFAULT 'system' NOT NULL,
  "amount" real DEFAULT 0 NOT NULL,
  "metadata" jsonb,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "merchant_capacity_events_affiliate_idx"
  ON "merchant_capacity_events" ("affiliateId");
