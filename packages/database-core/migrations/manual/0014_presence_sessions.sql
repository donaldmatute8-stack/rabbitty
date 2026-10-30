-- ─────────────────────────────────────────────────────────────────────────────
-- Permanencia de rabbitters (presencia por GPS) — IDEMPOTENTE, solo CREATE.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "presenceSessions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "userId" text NOT NULL,
    "businessId" text NOT NULL,
    "source" text DEFAULT 'gps' NOT NULL,
    "startedAt" timestamp NOT NULL,
    "lastPingAt" timestamp NOT NULL,
    "endedAt" timestamp,
    "createdAt" timestamp DEFAULT now(),
    "updatedAt" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "presenceSessions_user_idx" ON "presenceSessions" ("userId");
CREATE INDEX IF NOT EXISTS "presenceSessions_business_idx" ON "presenceSessions" ("businessId");
CREATE INDEX IF NOT EXISTS "presenceSessions_open_idx" ON "presenceSessions" ("businessId", "endedAt");
