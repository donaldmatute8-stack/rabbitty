-- ── Rabbit Chair · solicitudes de acceso ────────────────────────────────────
--
-- La landing privada (/rabbit-chair) puede abrirse sin token. En ese caso el
-- tenant pide acceso y la solicitud cae aquí para que God la revise desde
-- /god/rabbit-chair. Al aprobar se guarda el token firmado y se avisa al
-- tenant (push, correo y, si tiene Telegram, mensaje directo).
--
-- Aditiva: no toca ninguna tabla existente.

CREATE TABLE IF NOT EXISTS "rabbit_chair_requests" (
  "id" text PRIMARY KEY,
  "businessId" text,
  "businessName" text,
  "email" text NOT NULL,
  "name" text,
  "note" text,
  "status" text NOT NULL DEFAULT 'PENDING',
  "token" text,
  "resolvedAt" timestamp,
  "resolvedBy" text,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "rabbit_chair_requests_status_idx"
  ON "rabbit_chair_requests" ("status", "createdAt" DESC);

COMMENT ON TABLE "rabbit_chair_requests" IS
  'Solicitudes de acceso a Rabbit Chair desde la landing privada. God las aprueba en /god/rabbit-chair.';
