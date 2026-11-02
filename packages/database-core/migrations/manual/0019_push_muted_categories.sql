-- ── Push v2.1 §2.2/§2.3: preferencias por categoría (pushMutedCategories) ──
-- JSON string array de categorías silenciadas (miniapp settings). CRITICAL/SYSTEM
-- jamás se filtran en el worker. Idempotente. Norma DRIFT-001:
--   psql "$CORE_DATABASE_URL" -f packages/database-core/migrations/manual/0019_push_muted_categories.sql
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pushMutedCategories" text DEFAULT '[]' NOT NULL;
