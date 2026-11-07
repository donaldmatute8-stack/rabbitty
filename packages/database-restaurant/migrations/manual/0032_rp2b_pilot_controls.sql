-- ── RP-2B · Controles del piloto económico ──────────────────────────────────
-- Idempotente. No modifica datos existentes.
--   psql "$RESTAURANT_DATABASE_URL" -f packages/database-restaurant/migrations/manual/0032_rp2b_pilot_controls.sql
--
-- `pilotEnabled=true` = el afiliado entra al piloto. Los topes son por periodo
-- (`periodDays`) y por operación. 0 = sin allowance para esa operación.
-- Sin fila: no participa del piloto (si RABBITTY_BUNZ_PILOT=true, se bloquea).

CREATE TABLE IF NOT EXISTS "bunz_economic_limits" (
  "affiliateId" text PRIMARY KEY NOT NULL,
  "pilotEnabled" boolean DEFAULT false NOT NULL,
  "periodDays" integer DEFAULT 7 NOT NULL,
  "maxEmissionBunz" real DEFAULT 0 NOT NULL,
  "maxRedemptionBunz" real DEFAULT 0 NOT NULL,
  "maxSettlementBunz" real DEFAULT 0 NOT NULL,
  "notes" text,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
