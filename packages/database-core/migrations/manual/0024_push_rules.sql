-- ── Push v2.1 §2.4: reglas de notificaciones por Rabbitter (JSON opt-in) ──
-- pushRules = {"proximidadAllAlerts":true} bloquea el anti-spam de 12h por usuario.
-- Idempotente. Norma DRIFT-001:
--   psql "$CORE_DATABASE_URL" -f packages/database-core/migrations/manual/0024_push_rules.sql
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pushRules" text DEFAULT '{}' NOT NULL;
