-- 0047_bunzy_connect_series.sql
-- C4: series recurrentes de comunicación. Aditiva.

CREATE TABLE IF NOT EXISTS "bunzySeries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "audienceScope" text NOT NULL,
  "businessId" text,
  "category" text NOT NULL,
  "cadenceDays" integer NOT NULL,
  "nextRunAt" timestamp NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "ctaLabel" text,
  "ctaUrl" text,
  "active" boolean NOT NULL DEFAULT true,
  "createdBy" text NOT NULL,
  "createdAt" timestamp DEFAULT now(),
  "updatedAt" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "bunzy_series_active_next_idx"
  ON "bunzySeries" ("active", "nextRunAt");
