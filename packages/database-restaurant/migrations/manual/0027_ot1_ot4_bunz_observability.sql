-- ── OT-1 / OT-4 · Observabilidad económica (READ-ONLY para el pipeline) ──────
-- Idempotente. No modifica datos existentes. Norma DRIFT-001:
--   psql "$RESTAURANT_DATABASE_URL" -f packages/database-restaurant/migrations/manual/0027_ot1_ot4_bunz_observability.sql
--
-- OT-1: intentos de redención, también las cumplidas. Sin esto no hay `unmet`.
-- OT-4: snapshot diario de capacidad por afiliado. Sin esto no hay `coverageDays`.
--
-- Después de aplicar: `node scripts/capture-weekly.mjs` detecta las tablas y las usa.
-- Sin aplicar: el pipeline las declara como huecos (comportamiento actual).

CREATE TABLE IF NOT EXISTS "bunz_redemption_attempts" (
  "id" text PRIMARY KEY NOT NULL,
  "userHash" text NOT NULL,
  "branchId" text REFERENCES "branches"("id"),
  "orderId" text,
  "rewardId" text,
  "requestedAt" timestamp DEFAULT now() NOT NULL,
  "bunzRequested" real NOT NULL,
  "bunzFulfilled" real DEFAULT 0 NOT NULL,
  "status" text DEFAULT 'unfulfilled' NOT NULL,
  "reasons" text DEFAULT '[]' NOT NULL,
  "waitSeconds" integer,
  "fulfilledAt" timestamp,
  "fulfilledBranchId" text,
  "idempotencyKey" text NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "bunz_redemption_attempts_idempotencyKey_unique" UNIQUE("idempotencyKey")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bunz_attempts_requested_idx" ON "bunz_redemption_attempts" ("requestedAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bunz_attempts_user_idx" ON "bunz_redemption_attempts" ("userHash");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "bunz_capacity_daily" (
  "id" text PRIMARY KEY NOT NULL,
  "affiliateId" text NOT NULL,
  "date" text NOT NULL,
  "authorizedBunz" real DEFAULT 0 NOT NULL,
  "consumedBunz" real DEFAULT 0 NOT NULL,
  "source" text DEFAULT 'snapshot' NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bunz_capacity_daily_pk" ON "bunz_capacity_daily" ("affiliateId", "date");
