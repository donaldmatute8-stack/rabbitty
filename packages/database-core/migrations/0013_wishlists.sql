-- Lista de deseos + regalos sociales (2026-11-16)
-- Aditivo: crea 4 tablas. Una lista por usuario; expiración a 90 días.

CREATE TABLE IF NOT EXISTS "wishlists" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" text,
  "visibility" text NOT NULL DEFAULT 'PRIVATE',   -- PRIVATE | CIRCLE | LINK
  "birthdayAt" timestamp,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp DEFAULT now(),
  "updatedAt" timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "wishlists_user_uq" ON "wishlists" ("userId");

CREATE TABLE IF NOT EXISTS "wishlist_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "wishlistId" uuid NOT NULL REFERENCES "wishlists"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,                            -- PRODUCT | CUSTOM
  "businessId" text REFERENCES "ownedBusinesses"("id") ON DELETE SET NULL,
  "menuItemId" text,
  "title" text NOT NULL,
  "imageUrl" text,
  "priceSnapshot" real,
  "note" text,
  "priority" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'ACTIVE',         -- ACTIVE | GIFTED | PURCHASED | EXPIRED
  "expiresAt" timestamp NOT NULL DEFAULT now() + interval '90 days',
  "createdAt" timestamp DEFAULT now(),
  "updatedAt" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "wishlist_items_list_idx" ON "wishlist_items" ("wishlistId", "status");

CREATE TABLE IF NOT EXISTS "wishlist_shares" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "wishlistId" uuid NOT NULL REFERENCES "wishlists"("id") ON DELETE CASCADE,
  "groupId" text NOT NULL,
  "createdAt" timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "wishlist_shares_uq" ON "wishlist_shares" ("wishlistId", "groupId");

CREATE TABLE IF NOT EXISTS "wishlist_pledges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "itemId" uuid NOT NULL REFERENCES "wishlist_items"("id") ON DELETE CASCADE,
  "giverId" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "message" text,
  "status" text NOT NULL DEFAULT 'PLEDGED',        -- PLEDGED | CANCELLED
  "createdAt" timestamp DEFAULT now(),
  "updatedAt" timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "wishlist_pledges_uq" ON "wishlist_pledges" ("itemId", "giverId");
