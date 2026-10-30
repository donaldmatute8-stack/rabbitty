-- ─────────────────────────────────────────────────────────────────────────────
-- Membresías de cortesía (Fase 1) — IDEMPOTENTE, solo CREATE/ADD, cero datos tocados.
-- Origen comercial separado del proveedor de pago + revocación trazable + vigencia indefinida real.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "membership_subscriptions" ADD COLUMN IF NOT EXISTS "membershipOrigin" text;
ALTER TABLE "membership_subscriptions" ADD COLUMN IF NOT EXISTS "issuedByUserId" text;
ALTER TABLE "membership_subscriptions" ADD COLUMN IF NOT EXISTS "giftNote" text;
ALTER TABLE "membership_subscriptions" ADD COLUMN IF NOT EXISTS "noExpiration" boolean DEFAULT false NOT NULL;
ALTER TABLE "membership_subscriptions" ADD COLUMN IF NOT EXISTS "revokedAt" timestamp;
ALTER TABLE "membership_subscriptions" ADD COLUMN IF NOT EXISTS "revokedByUserId" text;
ALTER TABLE "membership_subscriptions" ADD COLUMN IF NOT EXISTS "revocationReason" text;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='membershipSubscriptions' AND column_name='currentPeriodEnd' AND is_nullable='NO') THEN
    ALTER TABLE "membership_subscriptions" ALTER COLUMN "currentPeriodEnd" DROP NOT NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "membershipSubscriptions_origin_idx" ON "membership_subscriptions" ("membershipOrigin");
