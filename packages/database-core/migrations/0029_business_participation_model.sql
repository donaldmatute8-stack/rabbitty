-- 0029 · Modelo de participación del negocio (POS | LITE)
--
-- Por qué existe: no todos los comercios van a usar nuestro POS/admin. Un
-- negocio "LITE" participa del ecosistema Bunz (perfil, respaldo, ofertas y
-- validación de canjes desde el teléfono) sin caja, mesas, KDS ni comisión por
-- pedido. El modelo se decide al aprobar el alta (God), no lo cambia el tenant.
--
-- Aditiva: default 'POS' = el comportamiento actual. No toca datos existentes.

ALTER TABLE "ownedBusinesses"
  ADD COLUMN IF NOT EXISTS "participationModel" text NOT NULL DEFAULT 'POS';

COMMENT ON COLUMN "ownedBusinesses"."participationModel" IS
  'POS = usa el sistema del local · LITE = solo perfil, ofertas y canjes (sin POS)';

CREATE INDEX IF NOT EXISTS "ownedBusinesses_participation_idx"
  ON "ownedBusinesses" ("participationModel");
