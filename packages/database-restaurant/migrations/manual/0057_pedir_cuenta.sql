-- 0057 · "Pedir la cuenta" desde el comandero (ADR-025 D5)
-- Aditiva: marca de tiempo en la orden. Sin ella, todo sigue igual.

BEGIN;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS "billRequestedAt" timestamp;
COMMENT ON COLUMN orders."billRequestedAt" IS
  'El mesero pidió la cuenta desde el comandero. La caja la cobra; el comandero no.';

CREATE INDEX IF NOT EXISTS orders_bill_requested_idx
  ON orders ("billRequestedAt") WHERE "billRequestedAt" IS NOT NULL;

COMMIT;
