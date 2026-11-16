-- `wishlist_shares.updatedAt` (2026-11-16).
--
-- El esquema de `packages/database-core` declara `...timestamps` en
-- `wishlist_shares`, pero la tabla se creó sin `updatedAt`. Aditivo y nullable
-- con default: no afecta filas existentes.

ALTER TABLE "wishlist_shares" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp DEFAULT now();
