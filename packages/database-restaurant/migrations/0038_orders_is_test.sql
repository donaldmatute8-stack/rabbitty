-- Marca de datos de prueba/mock en órdenes. Aditiva.
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "isTest" boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "orders_is_test_idx"
  ON "orders" ("isTest") WHERE "isTest" = true;
