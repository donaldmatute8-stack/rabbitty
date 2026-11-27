-- Ajustes de tesorería con aprobación (owner solicita + God aprueba).
-- Aditiva. No mueve saldos por sí sola.

CREATE TABLE IF NOT EXISTS "business_balance_adjustments" (
  "id" text PRIMARY KEY,
  "businessId" text NOT NULL,
  "field" text NOT NULL DEFAULT 'BUNZ_BALANCE',
  "delta" integer NOT NULL,
  "reason" text NOT NULL,
  "requestedBy" text NOT NULL,
  "approvedBy" text,
  "status" text NOT NULL DEFAULT 'PENDING',
  "idempotencyKey" text NOT NULL UNIQUE,
  "beforeValue" integer,
  "afterValue" integer,
  "ledgerEntryId" text,
  "approvedAt" timestamp,
  "appliedAt" timestamp,
  "createdAt" timestamp DEFAULT now(),
  "updatedAt" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "business_balance_adjustments_business_idx"
  ON "business_balance_adjustments" ("businessId", "status", "createdAt" DESC);
