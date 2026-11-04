-- 0032_chat_edit_delete_reactions.sql
-- Editar / borrar / reacciones (estilo WhatsApp/Telegram) para 1:1.
-- Idempotente.

-- Edición: marca de tiempo (el contenido se sobreescribe; la UI muestra "editado").
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "editedAt" timestamp;

-- Borrado: soft-delete. `deletedForAll` = se oculta para ambos lados; el
-- contenido se conserva en la fila para auditoría/moderación (no se expone).
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "deletedAt" timestamp;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "deletedForAll" boolean NOT NULL DEFAULT false;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "deletedBy" uuid;

-- Reacciones: 1 por usuario/emoji/mensaje (tocar la misma la quita).
CREATE TABLE IF NOT EXISTS "message_reactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "messageId" uuid NOT NULL,
  "userId" uuid NOT NULL,
  "emoji" text NOT NULL,
  "createdAt" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "message_reactions_uq"
  ON "message_reactions" ("messageId", "userId", "emoji");

CREATE INDEX IF NOT EXISTS "message_reactions_msg_idx"
  ON "message_reactions" ("messageId");
