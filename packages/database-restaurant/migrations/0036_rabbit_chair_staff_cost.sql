-- ── Rabbit Chair · costo de staff extra ─────────────────────────────────────
-- Permite asignar un empleado (bartender/barista) a una activación y congelar
-- su costo al momento de crearla. Solo columnas nuevas: no toca datos previos.

ALTER TABLE "rabbitChairActivations"
  ADD COLUMN IF NOT EXISTS "staffId" text,
  ADD COLUMN IF NOT EXISTS "staffMinutes" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "staffCostCents" integer NOT NULL DEFAULT 0;

-- El reporte por producto cruza órdenes con lugares de La Silla.
CREATE INDEX IF NOT EXISTS "rabbitChairSlots_order_idx"
  ON "rabbitChairSlots" ("orderId");
