-- 0044_onboarding_replay.sql
-- Re-onboarding de tenants existentes (una sola vez) con sus datos ya inyectados.
--
-- ADITIVO: columna nullable. NULL = pendiente de revisar; se marca al completar
-- (o al crear un negocio nuevo desde la miniapp, que ya hizo su onboarding).

ALTER TABLE "ownedBusinesses"
  ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" timestamp;

CREATE INDEX IF NOT EXISTS "ownedBusinesses_onboarding_idx"
  ON "ownedBusinesses" ("onboardingCompletedAt");
