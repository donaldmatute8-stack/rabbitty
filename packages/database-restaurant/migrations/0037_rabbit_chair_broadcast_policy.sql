-- ── Rabbit Chair · política de avisos masivos ───────────────────────────────
-- 1 masivo por negocio al día (configurable), tope de 100 destinatarios
-- (configurable) y marca del último broadcast para poder contarlo.
-- Solo columnas nuevas con default: no toca filas existentes.

ALTER TABLE "restaurants"
  ADD COLUMN IF NOT EXISTS "rabbitChairMassDailyLimit" integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "rabbitChairMassRecipientCap" integer NOT NULL DEFAULT 100;

ALTER TABLE "rabbitChairActivations"
  ADD COLUMN IF NOT EXISTS "broadcastAt" timestamp;
