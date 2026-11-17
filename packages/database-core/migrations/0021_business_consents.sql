-- Aceptación de documentos por parte del negocio (afiliado). Aditivo.
--
-- El Rabbitter ya registra su aceptación en `users` (versión, fecha, IP). El
-- afiliado no tenía nada: este libro guarda, por negocio y por documento, la
-- versión aceptada con quién y desde dónde, que es la prueba que se necesita
-- si alguien discute las condiciones del servicio.

CREATE TABLE IF NOT EXISTS "business_consents" (
  "id" text PRIMARY KEY,
  "businessId" text NOT NULL,
  "doc" text NOT NULL,              -- TERMS | PAYMENTS | PRIVACY | EQUIPMENT | BUNZ
  "version" text NOT NULL,
  "acceptedAt" timestamptz NOT NULL DEFAULT now(),
  "acceptedByUserId" text,
  "acceptedByEmail" text,
  "ip" text,
  "userAgent" text
);

CREATE UNIQUE INDEX IF NOT EXISTS "business_consents_uq"
  ON "business_consents" ("businessId", "doc", "version");

CREATE INDEX IF NOT EXISTS "business_consents_business_idx"
  ON "business_consents" ("businessId", "acceptedAt" DESC);
