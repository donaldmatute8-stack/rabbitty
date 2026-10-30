-- Deep-link persistente en el feed in-app (idempotente, sin tocar datos)
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "route" text;
