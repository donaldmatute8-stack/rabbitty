-- Preferencias de consumo + medición de avisos (2026-11-15)
-- Aditivo: solo crea dos tablas y sus índices. No toca datos existentes.

CREATE TABLE IF NOT EXISTS "user_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "businessId" text REFERENCES "ownedBusinesses"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "refId" text NOT NULL,
  "label" text NOT NULL,
  "score" real NOT NULL DEFAULT 0,
  "signalCount" integer NOT NULL DEFAULT 0,
  "lastSeenAt" timestamp,
  "source" text NOT NULL DEFAULT 'ORDER',
  "explicit" boolean NOT NULL DEFAULT false,
  "createdAt" timestamp DEFAULT now(),
  "updatedAt" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_preferences_business_uq"
  ON "user_preferences" ("userId", "businessId", "kind", "refId")
  WHERE "businessId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "user_preferences_global_uq"
  ON "user_preferences" ("userId", "kind", "refId")
  WHERE "businessId" IS NULL;

CREATE INDEX IF NOT EXISTS "user_preferences_user_idx" ON "user_preferences" ("userId");

CREATE TABLE IF NOT EXISTS "preference_nudges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "businessId" text NOT NULL REFERENCES "ownedBusinesses"("id") ON DELETE CASCADE,
  "preferenceId" uuid NOT NULL REFERENCES "user_preferences"("id") ON DELETE CASCADE,
  "reason" text NOT NULL,
  "channel" text NOT NULL DEFAULT 'push',
  "sentAt" timestamp NOT NULL DEFAULT now(),
  "openedAt" timestamp,
  "convertedAt" timestamp,
  "dedupeKey" text NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS "preference_nudges_user_sent_idx" ON "preference_nudges" ("userId", "sentAt");
CREATE INDEX IF NOT EXISTS "preference_nudges_pref_sent_idx" ON "preference_nudges" ("preferenceId", "sentAt");
