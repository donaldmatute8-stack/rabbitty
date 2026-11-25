-- ── Rabbit Chair · activación por el dueño ─────────────────────────────────
-- La experiencia NO aparece en el POS ni se puede crear hasta que el dueño la
-- active literalmente en el admin (Marketing → Rabbit Chair).
--
-- Aditiva: una columna por defecto en false. Ningún negocio la tiene activa
-- hasta que su dueño la encienda.

ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "rabbitChairEnabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "rabbitChairEnabledAt" timestamp;
ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "rabbitChairEnabledBy" text;

COMMENT ON COLUMN "restaurants"."rabbitChairEnabled" IS
  'El dueño activó Rabbit Chair (La Silla). Sin esto el POS no muestra la experiencia.';
