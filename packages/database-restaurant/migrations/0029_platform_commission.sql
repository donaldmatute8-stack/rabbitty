-- ── Comisión de plataforma (marketplace) ──────────────────────────────────
--
-- Distinta del excedente por uso del riel: `payment_intents.platformFeeCents`
-- (1 %) cubre el costo de cobrar con un método de pago; esta comisión es el
-- ingreso de Rabbitty por traer al cliente.
--
-- Reglas que implementa el servicio (`services/platformCommission.ts`):
-- - Sólo sobre la parte pagada en DINERO. **Bunz nunca paga comisión.**
-- - Se congela en la orden (`commissionPct`) para que un cambio de tarifa no
--   reescriba el historial ni la liquidación de meses pasados.
-- - Apagada por defecto: `enabled = false`. Nada se cobra hasta que el negocio
--   la acepte y se active (coherente con el contrato y con no cobrar en silencio).

ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "platformCommission" jsonb;

COMMENT ON COLUMN "restaurants"."platformCommission" IS
  'Comisión de plataforma: {enabled, pct, appliesTo:APP_ORDERS|ALL, minFeeMxn, notes}';

-- Foto de la comisión al momento de la venta (auditoría + liquidación)
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "commissionBaseCents" integer NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "commissionPct" real NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "commissionCents" integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "orders_commission_idx" ON "orders" ("branchId", "createdAt")
  WHERE "commissionCents" > 0;

COMMENT ON COLUMN "orders"."commissionBaseCents" IS
  'Base comisionable en centavos: total menos la parte pagada con Bunz';
COMMENT ON COLUMN "orders"."commissionPct" IS 'Tarifa congelada al momento de la venta (0.02 = 2 %)';
COMMENT ON COLUMN "orders"."commissionCents" IS 'Comisión de plataforma en centavos (0 si está apagada o fue 100 % Bunz)';
