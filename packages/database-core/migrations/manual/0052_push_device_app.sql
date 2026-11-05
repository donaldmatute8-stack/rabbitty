-- 0052_push_device_app.sql
-- Push multi-app: distinguir el bundle que posee cada token (Rabbiter vs POS).

ALTER TABLE "pushDevices" ADD COLUMN IF NOT EXISTS "appId" text NOT NULL DEFAULT 'com.rabbitty.app';

CREATE INDEX IF NOT EXISTS "push_devices_app_idx" ON "pushDevices" ("appId", "isActive");
