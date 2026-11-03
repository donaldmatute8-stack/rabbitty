-- H22 · Push v2.1 §4 — plano CANAL separado del plano CATEGORÍA.
--
-- `pushMutedCategories` (plano categoría): el Rabbitter no quiere ese tipo de
--   aviso → no se crea campana y no sale push.
-- `pushInAppEnabled` (plano canal): el Rabbitter no quiere campana, pero el
--   push nativo SÍ sale y marca el badge iOS (semántica tipo Facebook).
--
-- Aditivo y con default: no rompe filas existentes (todas quedan con campana ON,
-- que es el comportamiento actual).
--
-- Aplicar con psql (norma DRIFT-001), nunca `db:migrate` automático:
--   psql "$CORE_DATABASE_URL" -1 -v ON_ERROR_STOP=1 -f packages/database-core/migrations/manual/0027_push_in_app_enabled.sql

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "pushInAppEnabled" boolean NOT NULL DEFAULT true;
