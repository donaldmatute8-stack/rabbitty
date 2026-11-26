-- ── Fondo de crecimiento "La Madriguera" · Fase 1 (solo lectura) ───────────
-- ADR-CORE-011. Aditiva: no toca ledger_entries ni saldos.
-- El asiento contable vive en "ledger_entries" con subject sys_growth_fund.
-- Ninguna bandera se enciende con esta migración.

CREATE TABLE IF NOT EXISTS "fund_contributions" (
  "id" text PRIMARY KEY,
  "source" text NOT NULL,                 -- coop | user | affiliate | match
  "subjectId" text NOT NULL,              -- usr_/biz_/sys_treasury
  "amount" integer NOT NULL,
  "ledgerEntryId" text,
  "program" text NOT NULL DEFAULT 'madriguera',
  "periodStart" timestamp,
  "idempotencyKey" text NOT NULL UNIQUE,
  "createdAt" timestamp DEFAULT now(),
  "updatedAt" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "fund_contributions_program_idx"
  ON "fund_contributions" ("program", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "fund_contributions_source_idx"
  ON "fund_contributions" ("program", "source", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS "referral_coop_commitments" (
  "id" text PRIMARY KEY,
  "affiliateId" text NOT NULL,
  "source" text NOT NULL DEFAULT 'coop',
  "periodStart" timestamp NOT NULL,
  "periodEnd" timestamp NOT NULL,
  "pctBasis" real,
  "committed" integer NOT NULL DEFAULT 0,
  "spent" integer NOT NULL DEFAULT 0,
  "returned" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'ACTIVE',
  "createdAt" timestamp DEFAULT now(),
  "updatedAt" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "referral_coop_commitments_affiliate_idx"
  ON "referral_coop_commitments" ("affiliateId", "status", "periodStart" DESC);

CREATE TABLE IF NOT EXISTS "platform_budgets" (
  "id" text PRIMARY KEY,
  "program" text NOT NULL,
  "periodStart" timestamp NOT NULL,
  "periodEnd" timestamp NOT NULL,
  "budgeted" integer NOT NULL,
  "spent" integer NOT NULL DEFAULT 0,
  "createdAt" timestamp DEFAULT now(),
  "updatedAt" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_budgets_program_period_uidx"
  ON "platform_budgets" ("program", "periodStart");

ALTER TABLE "referrals"
  ADD COLUMN IF NOT EXISTS "rewardedAt" timestamp,
  ADD COLUMN IF NOT EXISTS "tranchesPaid" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "ledgerEntryId" text,
  ADD COLUMN IF NOT EXISTS "coopAmount" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "treasuryAmount" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "coopCommitmentId" text;

COMMENT ON TABLE "fund_contributions" IS
  'Aportes al fondo La Madriguera (ADR-CORE-011). Fase 1: solo lectura.';
