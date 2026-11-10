-- 0039 · Campos personalizables de la tarjeta de membresía
--
-- La tarjeta se genera con el template compartido. Estos campos permiten que
-- cada tenant ajuste el icono por nicho, el texto extra y la frase inferior.

ALTER TABLE membership_plans
  ADD COLUMN IF NOT EXISTS "cardNiche" text NOT NULL DEFAULT 'other';

ALTER TABLE membership_plans
  ADD COLUMN IF NOT EXISTS "cardDetail" text;

ALTER TABLE membership_plans
  ADD COLUMN IF NOT EXISTS "cardTagline" text;

COMMENT ON COLUMN membership_plans."cardNiche" IS
  'Icono de la tarjeta: cafe, restaurant, gym, bakery, bar, beauty, retail, other.';
COMMENT ON COLUMN membership_plans."cardDetail" IS
  'Texto extra de la barra del negocio (ej. "Abierto de 8 a 22").';
COMMENT ON COLUMN membership_plans."cardTagline" IS
  'Frase inferior de la tarjeta (ej. "UNA FAMILIA, MÁS BENEFICIOS").';
