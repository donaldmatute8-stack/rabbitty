-- ── OT-2 / OT-3 · Obligaciones y libro de doble entrada ─────────────────────
-- Idempotente. No modifica datos existentes. Norma DRIFT-001:
--   psql "$RESTAURANT_DATABASE_URL" -f packages/database-restaurant/migrations/manual/0028_ot2_ot3_bunz_books.sql
--
-- OT-2: obligaciones con ciclo de vida e historial de transiciones.
-- OT-3: libro Bunz; cada `groupId` debe balancear (Σ débitos = Σ créditos).

CREATE TABLE IF NOT EXISTS "bunz_obligations" (
  "id" text PRIMARY KEY NOT NULL,
  "affiliateId" text NOT NULL,
  "origin" text NOT NULL,
  "accruedAt" timestamp DEFAULT now() NOT NULL,
  "dueAt" timestamp NOT NULL,
  "amountBunz" real NOT NULL,
  "state" text DEFAULT 'OPEN' NOT NULL,
  "settledAt" timestamp,
  "instrument" text,
  "settledBunz" real DEFAULT 0 NOT NULL,
  "settledFiatMxn" real DEFAULT 0 NOT NULL,
  "writtenOffAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bunz_obligations_affiliate_idx" ON "bunz_obligations" ("affiliateId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bunz_obligations_state_idx" ON "bunz_obligations" ("state");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bunz_obligations_due_idx" ON "bunz_obligations" ("dueAt");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "bunz_obligation_events" (
  "id" text PRIMARY KEY NOT NULL,
  "obligationId" text NOT NULL REFERENCES "bunz_obligations"("id") ON DELETE CASCADE,
  "at" timestamp DEFAULT now() NOT NULL,
  "fromState" text NOT NULL,
  "toState" text NOT NULL,
  "actor" text DEFAULT 'system' NOT NULL,
  "note" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bunz_obligation_events_obligation_idx" ON "bunz_obligation_events" ("obligationId");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "bunz_ledger_entries" (
  "id" text PRIMARY KEY NOT NULL,
  "groupId" text NOT NULL,
  "ts" timestamp DEFAULT now() NOT NULL,
  "account" text NOT NULL,
  "direction" text NOT NULL,
  "amount" real NOT NULL,
  "refType" text NOT NULL,
  "refId" text,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bunz_ledger_group_idx" ON "bunz_ledger_entries" ("groupId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bunz_ledger_ref_idx" ON "bunz_ledger_entries" ("refType", "refId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bunz_ledger_ts_idx" ON "bunz_ledger_entries" ("ts");
