-- ── Evidencia de aceptación de Términos y Aviso de Privacidad (Rabbitters) ──
-- Idempotente. Se llena en el onboarding y en el login OTP cuando el usuario
-- acepta la versión vigente.
--
--   psql "$CORE_DATABASE_URL" -f packages/database-core/migrations/manual/0053_user_consent.sql

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "termsAcceptedAt" timestamp,
  ADD COLUMN IF NOT EXISTS "termsVersion" text,
  ADD COLUMN IF NOT EXISTS "privacyAcceptedAt" timestamp,
  ADD COLUMN IF NOT EXISTS "privacyVersion" text,
  ADD COLUMN IF NOT EXISTS "consentIp" text,
  ADD COLUMN IF NOT EXISTS "consentUserAgent" text;
