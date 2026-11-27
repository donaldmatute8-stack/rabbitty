-- Marca de datos de prueba/mock en transacciones de emisión. Aditiva.
ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "isTest" boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "transactions_is_test_idx"
  ON "transactions" ("isTest") WHERE "isTest" = true;
