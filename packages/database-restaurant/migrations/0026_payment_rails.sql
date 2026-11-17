-- ── Rieles de cobro: lectores y costo por proveedor (18-nov-2026) ───────────
--
-- Aditivo. Prepara Rabbitty Pay sin cambiar el cobro actual:
--   · terminal_readers: el lector físico (Stripe S710 hoy, hardware de marca
--     cuando exista adquirente que lo certifique) con su TMS e inyección de llaves.
--   · provider_fees: tarifa por riel para saber cuánto cuesta cada uno y poder
--     negociar/cambiar sin reescribir reportes.
--   · payment_intents.providerAccountId: la cuenta del comercio en ESE riel
--     (hoy `merchantId` apunta a la sucursal, no al riel).

CREATE TABLE IF NOT EXISTS "terminal_readers" (
  "id" text PRIMARY KEY,
  "branchId" text NOT NULL REFERENCES "branches"("id") ON DELETE CASCADE,
  "provider" text NOT NULL,                    -- STRIPE | RABBITTY_PAY | MERCADO_PAGO
  "providerReaderId" text,                     -- tmr_... en Stripe; deviceId en PSP propio
  "label" text NOT NULL,
  "kind" text NOT NULL DEFAULT 'SMART',        -- SMART | MPOS | TAP_TO_PHONE
  "connection" text NOT NULL DEFAULT 'NETWORK',-- NETWORK | BLUETOOTH | USB
  "status" text NOT NULL DEFAULT 'PENDING',    -- PENDING | ACTIVE | OFFLINE | DISABLED
  "keyInjectionProvider" text,                 -- quién inyecta DUKPT
  "tmsProvider" text,                          -- quién administra firmware/llaves
  "serialNumber" text,                         -- serie física (acta de comodato)
  "metadata" jsonb,
  "lastSeenAt" timestamp,
  "createdAt" timestamp DEFAULT now(),
  "updatedAt" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "terminal_readers_branch_idx"
  ON "terminal_readers" ("branchId", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "terminal_readers_provider_uq"
  ON "terminal_readers" ("provider", "providerReaderId")
  WHERE "providerReaderId" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "provider_fees" (
  "id" text PRIMARY KEY,
  "provider" text NOT NULL,                    -- STRIPE | MERCADO_PAGO | RABBITTY_PAY
  "scope" text NOT NULL DEFAULT 'GLOBAL',      -- GLOBAL | BUSINESS | BRANCH
  "scopeId" text,                              -- businessId o branchId cuando aplica
  "scheme" text NOT NULL DEFAULT 'CARD',       -- CARD | AMEX | DEBIT | CASH
  "fixedMxn" real NOT NULL DEFAULT 0,
  "percent" real NOT NULL DEFAULT 0,           -- 0.036 = 3.6 %
  "ivaPercent" real NOT NULL DEFAULT 0.16,
  "notes" text,
  "activeFrom" timestamp DEFAULT now(),
  "activeTo" timestamp,
  "createdAt" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "provider_fees_lookup_idx"
  ON "provider_fees" ("provider", "scope", "scopeId", "activeFrom" DESC);

ALTER TABLE "payment_intents"
  ADD COLUMN IF NOT EXISTS "providerAccountId" text;

COMMENT ON COLUMN "payment_intents"."providerAccountId" IS
  'Cuenta del comercio en el riel (acct_... en Stripe). Permite cambiar de proveedor sin perder trazabilidad.';
