-- A/B del aviso "ya te alcanza": brazo asignado por usuario (2026-11-16)
ALTER TABLE "preference_nudges" ADD COLUMN IF NOT EXISTS "arm" text NOT NULL DEFAULT 'treatment';
CREATE INDEX IF NOT EXISTS "preference_nudges_arm_idx" ON "preference_nudges" ("arm");
