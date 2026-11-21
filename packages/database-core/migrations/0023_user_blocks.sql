-- ── Bloqueo persistente entre usuarios (App Store 1.2 · UGC) ────────────────
-- Antes el botón "bloquear" solo cambiaba el estado del cliente. Apple exige
-- que el bloqueo detenga mensajes y persista.

CREATE TABLE IF NOT EXISTS "user_blocks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "blockerId" text NOT NULL,
  "blockedId" text NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_blocks_uq" ON "user_blocks" ("blockerId", "blockedId");
CREATE INDEX IF NOT EXISTS "user_blocks_blocked_idx" ON "user_blocks" ("blockedId");
