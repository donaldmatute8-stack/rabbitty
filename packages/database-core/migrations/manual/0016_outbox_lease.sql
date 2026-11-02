-- ── Outbox lease: guard de concurrencia para worker duplicado ──
-- Docs/PUSH-NOTIFICATIONS-PLAN.md §14-3 (P0 worker)
-- Idempotente. Aplicar manualmente a prod con psql (norma DRIFT-001):
--   psql "$CORE_DATABASE_URL" -f packages/database-core/migrations/manual/0016_outbox_lease.sql
ALTER TABLE "notifications_outbox" ADD COLUMN IF NOT EXISTS "lockedUntil" timestamp;
--> statement-breakpoint
DO $$ BEGIN
	CREATE INDEX IF NOT EXISTS "notifications_outbox_worker_idx"
		ON "notifications_outbox" ("status", "runAfter")
		WHERE "status" = 'QUEUED';
EXCEPTION WHEN others THEN NULL; END $$;
