-- 0045_bunzy_connect.sql
-- Bunzy Connect (C0): broadcasts institucionales + deliveries.
-- Aditiva: no toca tablas existentes ni borra datos.
-- Aplicar SOLO cuando se autorice la escritura (comparte Neon con producción).

CREATE TABLE IF NOT EXISTS "bunzyBroadcasts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "requestKey" text UNIQUE,
  "category" text NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "ctaLabel" text,
  "ctaUrl" text,
  "mediaKey" text,
  "audienceScope" text NOT NULL,
  "audienceFilter" jsonb,
  "status" text NOT NULL DEFAULT 'DRAFT',
  "contentHash" text NOT NULL,
  "createdBy" text NOT NULL,
  "publishedAt" timestamp,
  "createdAt" timestamp DEFAULT now(),
  "updatedAt" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "bunzy_broadcasts_status_idx"
  ON "bunzyBroadcasts" ("status", "createdAt");

CREATE TABLE IF NOT EXISTS "bunzyDeliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "broadcastId" uuid NOT NULL REFERENCES "bunzyBroadcasts"("id") ON DELETE CASCADE,
  "recipientType" text NOT NULL,
  "recipientId" text NOT NULL,
  "conversationId" text NOT NULL,
  "messageId" uuid,
  "status" text NOT NULL DEFAULT 'PENDING',
  "error" text,
  "deliveredAt" timestamp,
  "readAt" timestamp,
  "clickedAt" timestamp,
  "createdAt" timestamp DEFAULT now(),
  "updatedAt" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "bunzy_deliveries_broadcast_recipient_uidx"
  ON "bunzyDeliveries" ("broadcastId", "recipientType", "recipientId");

CREATE INDEX IF NOT EXISTS "bunzy_deliveries_recipient_idx"
  ON "bunzyDeliveries" ("recipientType", "recipientId");

-- Un solo hilo oficial de Bunzy por destinatario (participant1 = 'bunzy').
CREATE UNIQUE INDEX IF NOT EXISTS "conversations_bunzy_uidx"
  ON "conversations" ("participant2")
  WHERE "audience" = 'BUNZY';
