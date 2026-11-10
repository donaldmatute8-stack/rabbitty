-- 0041 · Atribución de referidos en membresías
ALTER TABLE membership_subscriptions
  ADD COLUMN IF NOT EXISTS "referredByUserId" text;

COMMENT ON COLUMN membership_subscriptions."referredByUserId" IS
  'Rabbitter que compartió el plan (atribución de referido).';
