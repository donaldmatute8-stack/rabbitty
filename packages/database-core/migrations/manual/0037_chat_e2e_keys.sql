-- 0037_chat_e2e_keys.sql
-- E2E para chats PEER (Rabbiter ↔ Rabbitter). El servidor NUNCA ve la clave de
-- conversación ni el contenido en claro: solo claves públicas y sobres cifrados.
--
-- Identidad: par de claves ECDH P-256 por DISPOSITIVO (no por cuenta), porque
-- la clave privada no debe poder exportarse. Aquí solo se guarda la pública.
-- Idempotente.

CREATE TABLE IF NOT EXISTS "user_device_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL,
  -- Identificador estable del dispositivo (generado en el cliente y guardado
  -- en su almacenamiento local). Cambiar de dispositivo = nueva identidad.
  "deviceId" text NOT NULL,
  -- Clave pública ECDH P-256 (raw uncompressed, base64url).
  "publicKey" text NOT NULL,
  "createdAt" timestamp DEFAULT now(),
  "lastSeenAt" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_device_keys_uq"
  ON "user_device_keys" ("userId", "deviceId");

-- Clave de conversación envuelta POR DISPOSITIVO del destinatario.
-- Formato del sobre: ephemeralPub(65 bytes raw) || iv(12) || ciphertext
-- (todo base64url). Sin la clave privada del dispositivo no se puede abrir.
CREATE TABLE IF NOT EXISTS "conversation_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversationId" text NOT NULL,
  "recipientUserId" uuid NOT NULL,
  "recipientDeviceId" text NOT NULL,
  "wrappedKey" text NOT NULL,
  "createdAt" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "conversation_keys_uq"
  ON "conversation_keys" ("conversationId", "recipientDeviceId");

CREATE INDEX IF NOT EXISTS "conversation_keys_user_idx"
  ON "conversation_keys" ("recipientUserId");

-- Marca del mensaje cifrado. `content` guarda el base64 de iv||ciphertext.
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "encrypted" boolean NOT NULL DEFAULT false;
