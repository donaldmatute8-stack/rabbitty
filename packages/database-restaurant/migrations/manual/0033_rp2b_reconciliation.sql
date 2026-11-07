-- ── RP-2B · Conciliación con pausa ──────────────────────────────────────────
-- Idempotente. No modifica datos existentes.
--   psql "$RESTAURANT_DATABASE_URL" -f packages/database-restaurant/migrations/manual/0033_rp2b_reconciliation.sql

CREATE TABLE IF NOT EXISTS "bunz_reconciliation_runs" (
  "id" text PRIMARY KEY NOT NULL,
  "startedAt" timestamp DEFAULT now() NOT NULL,
  "finishedAt" timestamp,
  "status" text DEFAULT 'RUNNING' NOT NULL, -- OK | ALERTS | ERROR
  "checks" jsonb,
  "alerts" jsonb,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bunz_recon_started_idx" ON "bunz_reconciliation_runs" ("startedAt");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "bunz_control_state" (
  "id" text PRIMARY KEY NOT NULL, -- 'global'
  "emissionPaused" boolean DEFAULT false NOT NULL,
  "redemptionPaused" boolean DEFAULT false NOT NULL,
  "settlementPaused" boolean DEFAULT false NOT NULL,
  "reason" text,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "bunz_control_state" ("id") VALUES ('global') ON CONFLICT ("id") DO NOTHING;
