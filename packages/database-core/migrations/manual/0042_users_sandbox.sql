-- ── MCCE · Usuarios de prueba ────────────────────────────────────────────────
-- Idempotente. No modifica datos existentes.
--   psql "$CORE_DATABASE_URL" -f packages/database-core/migrations/manual/0042_users_sandbox.sql

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "sandbox" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_sandbox_idx" ON "users" ("sandbox") WHERE "sandbox" = true;
