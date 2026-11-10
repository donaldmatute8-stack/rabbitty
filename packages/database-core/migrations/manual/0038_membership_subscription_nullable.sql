-- 0038 · membership_subscriptions: plan y fin de periodo opcionales
--
-- Motivo: las membresías de cortesía y los planes gratuitos no tienen plan
-- versionado ni fecha de fin:
--   · grantCourtesy inserta planVersionId = NULL.
--   · Un plan con priceFiat = 0 se emite con noExpiration = true y
--     currentPeriodEnd = NULL.
--
-- La base de producción tenía ambas columnas NOT NULL (drift respecto al
-- schema de Drizzle, que ya las declara opcionales). Sin este cambio, una
-- cortesía falla al insertar.

ALTER TABLE membership_subscriptions
  ALTER COLUMN "planVersionId" DROP NOT NULL;

ALTER TABLE membership_subscriptions
  ALTER COLUMN "currentPeriodEnd" DROP NOT NULL;
