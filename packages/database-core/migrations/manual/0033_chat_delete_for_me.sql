-- 0033_chat_delete_for_me.sql
-- "Eliminar para mí": ocultamiento POR USUARIO (no borra la fila ni afecta al otro).
-- Se usa cuando: (a) el usuario lo pide, o (b) pasó la ventana para "para todos".
-- Idempotente.

CREATE TABLE IF NOT EXISTS "message_hides" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "messageId" uuid NOT NULL,
  "userId" uuid NOT NULL,
  "hiddenAt" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "message_hides_uq"
  ON "message_hides" ("messageId", "userId");

CREATE INDEX IF NOT EXISTS "message_hides_user_idx"
  ON "message_hides" ("userId");
