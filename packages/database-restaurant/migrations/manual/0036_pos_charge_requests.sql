-- ── Confirmación de cobro del Rabbitter (escaneo en POS) ────────────────────
-- El POS pide autorización a la app antes de ejecutar el cargo. Es una
-- autorización, no el pago: al aprobar, el POS sigue con su flujo normal.
CREATE TABLE IF NOT EXISTS "pos_charge_requests" (
  "id" text PRIMARY KEY NOT NULL,
  "branchId" text NOT NULL,
  "customerId" text NOT NULL,
  "staffId" text,
  "method" text NOT NULL,
  "amount" real NOT NULL,
  "tipAmount" real DEFAULT 0 NOT NULL,
  "items" jsonb NOT NULL,
  "businessName" text,
  "status" text DEFAULT 'PENDING' NOT NULL,
  "orderId" text,
  "respondedAt" timestamp,
  "expiresAt" timestamp NOT NULL,
  "createdAt" timestamp DEFAULT now(),
  "updatedAt" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "pos_charge_requests_customer_idx" ON "pos_charge_requests" ("customerId");
CREATE INDEX IF NOT EXISTS "pos_charge_requests_status_idx" ON "pos_charge_requests" ("status");
