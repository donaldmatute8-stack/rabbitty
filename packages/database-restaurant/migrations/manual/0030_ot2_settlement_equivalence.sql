-- ── OT-2 · Equivalente Bunz de la liquidación (multi-instrumento) ────────────
-- Idempotente. No modifica datos existentes.
--   psql "$RESTAURANT_DATABASE_URL" -f packages/database-restaurant/migrations/manual/0030_ot2_settlement_equivalence.sql
--
-- `settledBunz`     = Bunz realmente movidos.
-- `settledFiatMxn`  = MXN realmente pagados.
-- `settledEquivalentBunz` = suma de ambos expresada en Bunz (tasa por operación).
-- Permite liquidar en Bunz, en fiat o mixto sin depender de una paridad global.

ALTER TABLE "bunz_obligations"
  ADD COLUMN IF NOT EXISTS "settledEquivalentBunz" real DEFAULT 0 NOT NULL;
