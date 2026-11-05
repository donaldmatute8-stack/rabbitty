-- 0046_bunzy_connect_c2.sql
-- C2: preferencias por categoría + programación. Aditiva.

CREATE TABLE IF NOT EXISTS "bunzyPreferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "recipientType" text NOT NULL,
  "recipientId" text NOT NULL,
  "product" boolean NOT NULL DEFAULT true,
  "tips" boolean NOT NULL DEFAULT true,
  "news" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp DEFAULT now(),
  "updatedAt" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "bunzy_preferences_recipient_uidx"
  ON "bunzyPreferences" ("recipientType", "recipientId");

ALTER TABLE "bunzyBroadcasts" ADD COLUMN IF NOT EXISTS "scheduledAt" timestamp;
