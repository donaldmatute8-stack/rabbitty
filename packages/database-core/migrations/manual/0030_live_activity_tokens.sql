-- 0030_live_activity_tokens.sql
-- Tokens de push POR ACTIVIDAD para el Live Activity del pedido (iOS 16.2+).
-- El device token de APNs no sirve para actualizar una Live Activity: cada
-- actividad emite su propio token. Idempotente.

CREATE TABLE IF NOT EXISTS "live_activity_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL,
  "orderId" text NOT NULL,
  "token" text NOT NULL UNIQUE,
  "platform" text NOT NULL DEFAULT 'ios',
  "createdAt" timestamp DEFAULT now(),
  "updatedAt" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "live_activity_tokens_order_idx"
  ON "live_activity_tokens" ("orderId");

CREATE INDEX IF NOT EXISTS "live_activity_tokens_user_idx"
  ON "live_activity_tokens" ("userId");
