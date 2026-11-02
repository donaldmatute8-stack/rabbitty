-- ── Rabbitty Score F3 (D-5): atribución de campaña en el alta del cliente ──
-- Ver Docs/RABBITTY-SCORE-PLAN.md §7 D-5. Idempotente. Norma DRIFT-001:
--   psql "$CORE_DATABASE_URL" -f packages/database-core/migrations/manual/0017_first_seen_campaign.sql
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "firstSeenCampaignId" text;
