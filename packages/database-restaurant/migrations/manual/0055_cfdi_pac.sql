-- 0055 · CFDI multi-tenant: credenciales PAC por negocio (Fase CFDI)
--
-- Diseño (Docs/POS-FASE-0/ADR-021-cfdi.md):
--   · Cada tenant conecta SU cuenta de PAC y paga sus propios timbres.
--   · Rabbitty solo guarda credenciales cifradas y llama al PAC.
--   · El canal entre Rabbitty y el PAC es el API del PAC, nunca un timbrado
--     compartido con el CSD de Rabbitty.
--
-- Aditiva: tablas nuevas + columnas nullable en `invoices`. Sin credenciales
-- configuradas, emitir falla con un mensaje claro (no se timbra nada).

BEGIN;

CREATE TABLE IF NOT EXISTS cfdi_credentials (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  -- Negocio (tenant) al que pertenecen las credenciales. Es el que paga.
  "businessId" text NOT NULL,
  -- facturama | finkok | ...
  provider text NOT NULL,
  -- sandbox | production
  environment text NOT NULL DEFAULT 'sandbox',
  -- Datos del emisor (los del CSD del tenant)
  "issuerRfc" text NOT NULL,
  "issuerName" text NOT NULL,
  "issuerTaxRegime" text NOT NULL,
  "issuerZipCode" text NOT NULL,
  -- JSON cifrado con ENCRYPTION_KEY (usuario/password del PAC, rutas del CSD)
  "credentials" text NOT NULL,
  "isActive" boolean NOT NULL DEFAULT true,
  "lastTestedAt" timestamp,
  -- OK | FAILED
  "lastTestStatus" text,
  "lastTestMessage" text,
  "createdAt" timestamp DEFAULT now(),
  "updatedAt" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS cfdi_credentials_business_provider_env_uq
  ON cfdi_credentials ("businessId", provider, environment);

CREATE INDEX IF NOT EXISTS cfdi_credentials_business_idx
  ON cfdi_credentials ("businessId", "isActive");

COMMENT ON TABLE cfdi_credentials IS
  'Credenciales del PAC de cada tenant (cifradas). El tenant paga sus timbres; Rabbitty solo integra.';

-- Trazabilidad del timbrado en la factura existente.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "businessId" text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS provider text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS environment text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "pacInvoiceId" text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "errorMessage" text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "issuedAt" timestamp;
-- Motivo de cancelación SAT (01 | 02 | 03 | 04) y UUID que la sustituye.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "cancellationMotive" text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "replacementUuid" text;

CREATE INDEX IF NOT EXISTS invoices_business_idx ON invoices ("businessId");
CREATE INDEX IF NOT EXISTS invoices_order_idx ON invoices ("orderId");

COMMENT ON COLUMN invoices."pacInvoiceId" IS
  'Id interno del PAC (Facturama Id). Distinto del UUID fiscal.';

COMMIT;
