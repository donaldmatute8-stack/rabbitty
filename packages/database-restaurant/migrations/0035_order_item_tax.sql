-- ── IVA por renglón ─────────────────────────────────────────────────────────
-- Contabilidad pidió IVA por producto. Hasta hoy el impuesto vive solo en la
-- orden, así que el reporte por producto tenía que prorratear. Con estas dos
-- columnas el renglón puede llevar su tasa y su importe exactos; las filas
-- históricas quedan NULL y el reporte prorratea con la tasa de su orden.
--
-- Aditiva.

ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "taxRate" real;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "taxAmount" real;

COMMENT ON COLUMN "order_items"."taxRate" IS 'Tasa de IVA aplicada al renglón (0.16 = 16%). NULL = histórica, se prorratea.';
COMMENT ON COLUMN "order_items"."taxAmount" IS 'IVA exacto del renglón en MXN. NULL = histórica, se prorratea.';
