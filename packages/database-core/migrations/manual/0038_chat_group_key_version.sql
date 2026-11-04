-- 0038_chat_group_key_version.sql
-- Versión de la clave E2E del grupo. Al cambiar la membresía (expulsar/salir)
-- el servidor la incrementa para que los clientes REGENEREN la clave: el que
-- salió no puede leer lo nuevo aunque conserve la clave vieja.
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "e2eKeyVersion" integer NOT NULL DEFAULT 1;

-- Versión del sobre (permite re-clave sin borrar historial de sobres).
ALTER TABLE "conversation_keys" ADD COLUMN IF NOT EXISTS "keyVersion" integer NOT NULL DEFAULT 1;
