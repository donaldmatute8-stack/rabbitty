-- ── Rabbit Chair · lista de espera ──────────────────────────────────────────
-- Cuando la activación está llena, el cliente entra a la fila. Al liberarse un
-- lugar (hold vencido o cancelación) se invita al primero con un enlace y una
-- ventana corta para tomarlo.
--
-- Aditiva.

CREATE TABLE IF NOT EXISTS "rabbitChairWaitlist" (
  "id" text PRIMARY KEY,
  "activationId" text NOT NULL REFERENCES "rabbitChairActivations"("id") ON DELETE CASCADE,
  "userId" text,
  "guestName" text,
  "position" integer NOT NULL,
  /** WAITING | INVITED | CONVERTED | EXPIRED | CANCELLED */
  "status" text NOT NULL DEFAULT 'WAITING',
  "invitedAt" timestamp,
  "expiresAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "rabbitChairWaitlist_user_uidx"
  ON "rabbitChairWaitlist" ("activationId", "userId")
  WHERE "userId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "rabbitChairWaitlist_queue_idx"
  ON "rabbitChairWaitlist" ("activationId", "status", "position");

COMMENT ON TABLE "rabbitChairWaitlist" IS
  'Fila de Rabbit Chair por activación. INVITED = tiene ventana para tomar el lugar.';
