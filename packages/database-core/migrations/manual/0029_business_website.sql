-- 0029_business_website.sql
-- Perfil público del negocio: sitio web configurable desde el admin (antes el
-- móvil caía a un fallback hardcodeado porque la columna no existía).
-- Idempotente: se puede re-ejecutar sin efectos.

ALTER TABLE "ownedBusinesses"
  ADD COLUMN IF NOT EXISTS "website" text;

COMMENT ON COLUMN "ownedBusinesses"."website" IS
  'Sitio web oficial del negocio (lo configura el afiliado/admin). NULL = no mostrar enlace.';
