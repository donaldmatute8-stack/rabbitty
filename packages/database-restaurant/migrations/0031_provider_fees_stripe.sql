-- ── Costo real del riel: tarifa de Stripe en México ────────────────────────
--
-- La conciliación usaba una estimación hardcodeada (2.9 % + $2.50), que no
-- corresponde a la tarifa mexicana ni incluye IVA. Con esta fila, el "neto
-- liquidado al comercio" se calcula con el costo real del procesador.
--
-- Es dato de operación (contrato con el PSP), no de negocio del inquilino: se
-- edita en la tabla si cambia la tarifa. `percent` va sobre el neto fiat,
-- `fixedMxn` por transacción exitosa, `ivaPercent` sobre la comisión del PSP.

INSERT INTO "provider_fees" (
  "id", "provider", "scope", "scopeId", "scheme", "percent", "fixedMxn", "ivaPercent", "notes", "activeFrom"
)
SELECT
  gen_random_uuid()::text,
  'STRIPE',
  'GLOBAL',
  NULL,
  'CARD_MX',
  0.036,
  3,
  0.16,
  'Tarifa estándar Stripe México (3.6% + $3 + IVA sobre la comisión)',
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM "provider_fees" WHERE "provider" = 'STRIPE' AND "scope" = 'GLOBAL'
);

COMMENT ON TABLE "provider_fees" IS
  'Costo por riel de cobro. La conciliación usa la fila activa más reciente; sin filas cae a un estimado.';
