-- 0039_chat_e2e_key_versions.sql
-- AUDITORÍA DE RE-CLAVE: guardar una llave por VERSIÓN, no sobreescribir.
--
-- Antes el único era (conversationId, recipientDeviceId) y el POST reemplazaba
-- el sobre al re-clavear → el historial anterior quedaba ILEGIBLE.
-- Ahora se conserva cada versión y cada mensaje recuerda con cuál se cifró.
DROP INDEX IF EXISTS "conversation_keys_uq";

CREATE UNIQUE INDEX IF NOT EXISTS "conversation_keys_uq"
  ON "conversation_keys" ("conversationId", "recipientDeviceId", "keyVersion");

ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "e2eKeyVersion" integer;
