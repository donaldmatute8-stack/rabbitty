-- 0051_business_address_data.sql
-- Dirección estructurada del negocio (pickup para Uber Direct / repartidores).

ALTER TABLE "ownedBusinesses" ADD COLUMN IF NOT EXISTS "addressData" jsonb;
