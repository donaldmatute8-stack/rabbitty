-- 0040 · Marketplace de membresías
--
-- Habilita descubrimiento y compra in-app. Los planes siguen siendo por
-- negocio; el marketplace solo expone los que el tenant publica.

ALTER TABLE membership_plans
  ADD COLUMN IF NOT EXISTS "isMarketplaceVisible" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "featuredUntil" timestamp,
  ADD COLUMN IF NOT EXISTS "foundingSlots" integer,
  ADD COLUMN IF NOT EXISTS "publishedAt" timestamp;

ALTER TABLE membership_plan_versions
  ADD COLUMN IF NOT EXISTS "trialDays" integer;

ALTER TABLE membership_subscriptions
  ADD COLUMN IF NOT EXISTS "acquisitionSource" text,
  ADD COLUMN IF NOT EXISTS "checkoutSessionId" text;

CREATE INDEX IF NOT EXISTS membership_plans_marketplace_idx
  ON membership_plans ("isMarketplaceVisible", category);

CREATE INDEX IF NOT EXISTS membership_plans_featured_idx
  ON membership_plans ("featuredUntil");

COMMENT ON COLUMN membership_plans."isMarketplaceVisible" IS
  'true = aparece en Descubrir del marketplace.';
COMMENT ON COLUMN membership_plans."foundingSlots" IS
  'Cupo de miembros fundadores; el badge se muestra mientras queden.';
COMMENT ON COLUMN membership_subscriptions."acquisitionSource" IS
  'MARKETPLACE | POS | GIFT | PROMO | AFFILIATE_PAGE.';
