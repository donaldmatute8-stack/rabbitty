-- 0040 · Outbox de eventos en tiempo real para POS/KDS (Fase 0C-5)
--
-- Mismo patrón que `chat_event_outbox`: el evento se escribe en la MISMA
-- transacción que la orden, y un worker lo publica en Centrifugo con
-- at-least-once. La base sigue siendo la fuente de verdad.
--
-- Aditiva: tabla nueva. Sin worker activo, el KDS sigue con polling.
-- Contexto: Docs/POS-FASE-0/ADR-017-transporte-eventos.md

BEGIN;

CREATE TABLE IF NOT EXISTS realtime_outbox (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "businessId" text,
  "branchId" text NOT NULL,
  channel text NOT NULL,
  -- order.created | order.item.updated | order.paid | order.voided
  "eventType" text NOT NULL,
  "eventId" text NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  seq bigint GENERATED ALWAYS AS IDENTITY,
  -- QUEUED | SENT | FAILED
  status text NOT NULL DEFAULT 'QUEUED',
  attempts integer NOT NULL DEFAULT 0,
  "runAfter" timestamp NOT NULL DEFAULT now(),
  "lockedUntil" timestamp,
  "sentAt" timestamp,
  "createdAt" timestamp DEFAULT now(),
  "updatedAt" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS realtime_outbox_pending_idx
  ON realtime_outbox (status, "runAfter");

CREATE INDEX IF NOT EXISTS realtime_outbox_channel_idx
  ON realtime_outbox (channel, seq);

COMMENT ON TABLE realtime_outbox IS
  'Eventos POS/KDS pendientes de publicar (ADR-017). At-least-once; el cliente deduplica por eventId.';

COMMIT;
