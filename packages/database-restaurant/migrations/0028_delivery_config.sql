-- ── Cobro de envío a domicilio ────────────────────────────────────────────
--
-- El POS ya sabe cobrar la entrega cuando asigna repartidor: suma `deliveryFee`
-- a la orden sólo si nadie lo cobró antes (`alreadyCharged`). Lo que faltaba era
-- que el cliente pudiera ver y pagar ese envío desde la app, y que el negocio
-- pudiera configurarlo.
--
-- `deliveryConfig` (jsonb, nullable, aditivo):
-- {
--   "enabled": true,
--   "mode": "FLAT" | "PROVIDER",
--   "baseFee": 45,            // MXN, tarifa plana
--   "freeOver": 600,          // MXN de subtotal para envío gratis (opcional)
--   "etaMinutes": 40,
--   "notes": "Envíos dentro de Bucerías"
-- }
--
-- Sin configuración NO se cobra y la app lo dice ("por confirmar"), nunca en
-- silencio: `deliveryQuote` devuelve `source = 'UNCONFIGURED'`.

ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "deliveryConfig" jsonb;

COMMENT ON COLUMN "restaurants"."deliveryConfig" IS
  'Config de envío: {enabled, mode:FLAT|PROVIDER, baseFee, freeOver, etaMinutes, notes}';
