-- ── Mercado Pago: configuración por sucursal ────────────────────────────────
-- Credenciales cifradas (AES-256-GCM) + metadata no sensible. Separado de
-- merchant_payment_accounts (Stripe Connect) para no romper su UNIQUE.
CREATE TABLE IF NOT EXISTS "merchant_payment_provider_configs" (
  "id" text PRIMARY KEY NOT NULL,
  "branchId" text NOT NULL,
  "provider" text NOT NULL,
  "status" text DEFAULT 'DISCONNECTED' NOT NULL,
  "mode" text DEFAULT 'test' NOT NULL,
  "credentials" jsonb,
  "metadata" jsonb,
  "createdAt" timestamp DEFAULT now(),
  "updatedAt" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "merchant_payment_provider_branch_provider_idx"
  ON "merchant_payment_provider_configs" ("branchId", "provider");
