-- 0031_chat_realtime_presence.sql
-- Fase 3 + 4 del plan de mensajería.
--   · chat_connections     → presencia por SESIONES (nunca por GPS), multi-device.
--   · chat_event_outbox    → evento de chat en la MISMA tx del INSERT del mensaje
--                            (at-least-once; el cliente dedupe por eventId).
-- Idempotente.

-- ── Presencia de app por sesión ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "chat_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL,
  "sessionId" text NOT NULL,
  "platform" text,
  "connectedAt" timestamp DEFAULT now(),
  "lastSeenAt" timestamp DEFAULT now(),
  "disconnectedAt" timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS "chat_connections_user_session_uq"
  ON "chat_connections" ("userId", "sessionId");

CREATE INDEX IF NOT EXISTS "chat_connections_user_seen_idx"
  ON "chat_connections" ("userId", "lastSeenAt");

-- ── Outbox de eventos de chat (publish a Centrifugo) ────────────────────────
CREATE TABLE IF NOT EXISTS "chat_event_outbox" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversationId" text NOT NULL,
  -- message.created | message.read | typing
  "type" text NOT NULL,
  -- Clave de idempotencia del evento (p. ej. msg:<messageId>)
  "eventId" text NOT NULL UNIQUE,
  "payload" jsonb NOT NULL,
  -- QUEUED | PROCESSED | FAILED
  "status" text NOT NULL DEFAULT 'QUEUED',
  "attempts" integer NOT NULL DEFAULT 0,
  "runAfter" timestamp NOT NULL DEFAULT now(),
  "lockedUntil" timestamp,
  "createdAt" timestamp DEFAULT now(),
  "updatedAt" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "chat_event_outbox_status_idx"
  ON "chat_event_outbox" ("status", "runAfter");
