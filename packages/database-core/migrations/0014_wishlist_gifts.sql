-- Vales de regalo de la lista de deseos (2026-11-16)
CREATE TABLE IF NOT EXISTS "wishlist_gifts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "itemId" uuid NOT NULL REFERENCES "wishlist_items"("id") ON DELETE CASCADE,
  "giverId" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "amount" real NOT NULL,
  "currency" text NOT NULL DEFAULT 'MXN',
  "status" text NOT NULL DEFAULT 'PENDING',   -- PENDING | PAID | REDEEMED | EXPIRED | REFUNDED
  "paymentProvider" text,                     -- STRIPE
  "providerSessionId" text,
  "providerPaymentIntentId" text,
  "voucherCode" text UNIQUE,
  "paidAt" timestamp,
  "claimedAt" timestamp,
  "expiresAt" timestamp,
  "createdAt" timestamp DEFAULT now(),
  "updatedAt" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "wishlist_gifts_item_idx" ON "wishlist_gifts" ("itemId");
CREATE INDEX IF NOT EXISTS "wishlist_gifts_code_idx" ON "wishlist_gifts" ("voucherCode");
