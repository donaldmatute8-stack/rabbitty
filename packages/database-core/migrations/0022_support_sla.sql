-- ── Soporte 1:1 · SLA y estado del hilo ─────────────────────────────────────
-- El hilo de soporte vive en `conversations` (audience='SUPPORT').
-- Estas columnas permiten medir primera respuesta, resolver y filtrar en la
-- bandeja del equipo. Aditivas y con default: no tocan hilos existentes.

ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "supportStatus" text DEFAULT 'OPEN' NOT NULL;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "supportPriority" text DEFAULT 'NORMAL' NOT NULL;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "supportFirstResponseAt" timestamp;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "supportResolvedAt" timestamp;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "supportAssignee" text;
