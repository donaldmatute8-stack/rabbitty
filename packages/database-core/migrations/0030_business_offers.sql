-- 0030 · Ofertas reales y canjes (Stock)
--
-- Por qué en CORE: una oferta pertenece al catálogo del negocio (igual que
-- `ownedBusinesses` o `affiliateCampaigns`), no a la operación del restaurante.
-- Así el canje (usuario + respaldo + oferta + redención + ledger) cabe en UNA
-- transacción, y funciona igual para un negocio Lite sin sucursal.
--
-- Aditiva e idempotente.

CREATE TABLE IF NOT EXISTS "business_offers" (
  "id"          text PRIMARY KEY,
  "businessId"  text NOT NULL,
  "branchId"    text,
  "title"       text NOT NULL,
  "description" text,
  "imageUrl"    text,
  "bunzCost"    integer NOT NULL,
  "fiatValue"   real,
  "menuItemId"  text,
  "stockTotal"  integer NOT NULL DEFAULT 0,
  "stockUsed"   integer NOT NULL DEFAULT 0,
  "perUserLimit" integer NOT NULL DEFAULT 1,
  "validFrom"   timestamp DEFAULT now(),
  "validUntil"  timestamp,
  -- ACTIVE | PAUSED | SOLD_OUT | EXPIRED
  "status"      text NOT NULL DEFAULT 'ACTIVE',
  "createdAt"   timestamp DEFAULT now(),
  "updatedAt"   timestamp DEFAULT now(),
  CONSTRAINT "business_offers_cost_positivo" CHECK ("bunzCost" > 0),
  CONSTRAINT "business_offers_stock_coherente" CHECK ("stockUsed" >= 0 AND "stockUsed" <= "stockTotal"),
  CONSTRAINT "business_offers_limite_positivo" CHECK ("perUserLimit" >= 1)
);

CREATE INDEX IF NOT EXISTS "business_offers_business_idx"
  ON "business_offers" ("businessId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "business_offers_publicables_idx"
  ON "business_offers" ("status", "bunzCost");

CREATE TABLE IF NOT EXISTS "offer_redemptions" (
  "id"             text PRIMARY KEY,
  "offerId"        text NOT NULL,
  "businessId"     text NOT NULL,
  "userId"         text NOT NULL,
  "code"           text NOT NULL,
  "bunzCost"       integer NOT NULL,
  -- RESERVED | VALIDATED | EXPIRED | CANCELLED
  "status"         text NOT NULL DEFAULT 'RESERVED',
  "reservedAt"     timestamp DEFAULT now(),
  "expiresAt"      timestamp NOT NULL,
  "validatedAt"    timestamp,
  "validatedBy"    text,
  "ledgerEntryId"  text,
  "idempotencyKey" text NOT NULL,
  "createdAt"      timestamp DEFAULT now(),
  "updatedAt"      timestamp DEFAULT now(),
  CONSTRAINT "offer_redemptions_costo_positivo" CHECK ("bunzCost" > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "offer_redemptions_code_uidx"
  ON "offer_redemptions" (upper("code"));
CREATE UNIQUE INDEX IF NOT EXISTS "offer_redemptions_idem_uidx"
  ON "offer_redemptions" ("idempotencyKey");
CREATE INDEX IF NOT EXISTS "offer_redemptions_business_idx"
  ON "offer_redemptions" ("businessId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "offer_redemptions_user_idx"
  ON "offer_redemptions" ("userId", "offerId", "status");
