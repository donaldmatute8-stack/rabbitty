-- 0042 · Programa de referidos de membresías
--
-- El tenant define la recompensa de un catálogo cerrado (hoy: Bunz; descuento y
-- días extra quedan catalogados como "pronto"). La recompensa en Bunz se paga con
-- la bóveda del comercio, con topes mensuales y totales: no se mintea de la nada.

CREATE TABLE IF NOT EXISTS membership_referral_programs (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "businessId" text NOT NULL REFERENCES "ownedBusinesses" ("id") ON DELETE CASCADE,
  "isActive" boolean NOT NULL DEFAULT false,
  "rewardType" text NOT NULL DEFAULT 'BUNZ',
  "bunzAmount" integer NOT NULL DEFAULT 100,
  "discountPct" integer NOT NULL DEFAULT 10,
  "extraTrialDays" integer NOT NULL DEFAULT 14,
  "triggerEvent" text NOT NULL DEFAULT 'FIRST_ACTIVATION',
  "maxRewardsMonthly" integer NOT NULL DEFAULT 5,
  "maxRewardsTotal" integer NOT NULL DEFAULT 100,
  "minReferredAccountAgeHours" integer NOT NULL DEFAULT 0,
  notes text,
  "createdAt" timestamp DEFAULT now(),
  "updatedAt" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS membership_referral_programs_business_uidx
  ON membership_referral_programs ("businessId");

CREATE TABLE IF NOT EXISTS membership_referral_rewards (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "businessId" text NOT NULL REFERENCES "ownedBusinesses" ("id") ON DELETE CASCADE,
  "referrerUserId" text REFERENCES "users" ("id") ON DELETE CASCADE,
  "referredUserId" text REFERENCES "users" ("id") ON DELETE CASCADE,
  "subscriptionId" text,
  "planId" text,
  "rewardType" text NOT NULL,
  value integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'GRANTED',
  reason text,
  "ledgerKey" text,
  "grantedAt" timestamp,
  "createdAt" timestamp DEFAULT now(),
  "updatedAt" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS membership_referral_rewards_referred_uidx
  ON membership_referral_rewards ("businessId", "referredUserId");

CREATE INDEX IF NOT EXISTS membership_referral_rewards_referrer_idx
  ON membership_referral_rewards ("referrerUserId", "createdAt");

COMMENT ON COLUMN membership_referral_programs."rewardType" IS
  'NONE | BUNZ | DISCOUNT_PCT | EXTRA_TRIAL_DAYS (los dos últimos aún no liquidan).';
COMMENT ON COLUMN membership_referral_rewards.status IS
  'GRANTED = pagado · PENDING = falta bóveda/tope · SKIPPED = regla anti-abuso.';
