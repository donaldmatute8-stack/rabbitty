-- ── OT-5 · Señales de abuso (append-only) ────────────────────────────────────
-- Idempotente. No modifica datos existentes. Norma DRIFT-001:
--   psql "$RESTAURANT_DATABASE_URL" -f packages/database-restaurant/migrations/manual/0029_ot5_abuse_signals.sql
--
-- Solo registra señales para revisión humana. No bloquea cobros ni redenciones.

CREATE TABLE IF NOT EXISTS "bunz_abuse_signals" (
  "id" text PRIMARY KEY NOT NULL,
  "detectedAt" timestamp DEFAULT now() NOT NULL,
  "userHash" text NOT NULL,
  "type" text NOT NULL,
  "severity" text NOT NULL,
  "affiliateId" text,
  "refType" text,
  "refId" text,
  "detail" jsonb,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bunz_abuse_detected_idx" ON "bunz_abuse_signals" ("detectedAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bunz_abuse_user_idx" ON "bunz_abuse_signals" ("userHash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bunz_abuse_type_idx" ON "bunz_abuse_signals" ("type");
