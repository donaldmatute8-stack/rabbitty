-- 0042_pos_terminal_usage.sql
-- Telemetría de adopción de la sesión de terminal (Fase 2 del ADR-014).
--
-- ADITIVO: dos columnas nullable/default sobre una tabla que hoy está vacía en
-- producción. No cambia el comportamiento del POS (el flag sigue apagado).

ALTER TABLE "pos_terminal_sessions"
  ADD COLUMN IF NOT EXISTS "useCount" integer NOT NULL DEFAULT 0;

ALTER TABLE "pos_terminal_sessions"
  ADD COLUMN IF NOT EXISTS "lastUsedAt" timestamp;

-- Consultas de adopción: sesiones usadas recientemente.
CREATE INDEX IF NOT EXISTS "pos_terminal_sessions_last_used_idx"
  ON "pos_terminal_sessions" ("lastUsedAt");
