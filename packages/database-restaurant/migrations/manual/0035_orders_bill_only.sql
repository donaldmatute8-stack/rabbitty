-- ── Cuenta enviada al móvil (bill-only) ─────────────────────────────────────
-- Separa el cobro de una cuenta del flujo de pedido: estas órdenes no van a
-- KDS, no disparan seguimiento en la app y solo sirven para pagar/comprobante.
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "billOnly" boolean DEFAULT false NOT NULL;
