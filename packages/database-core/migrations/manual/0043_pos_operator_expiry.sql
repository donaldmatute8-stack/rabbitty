-- 0043_pos_operator_expiry.sql
-- Fase 3 del ADR-014: turno del empleado sobre la terminal (PIN + staff.pinCode).
--
-- ADITIVO: una columna nullable y un índice. Con POS_OPERATOR_SESSIONS apagado,
-- nada de esto se usa (el POS sigue igual que en Fase 2).

ALTER TABLE "pos_operator_sessions"
  ADD COLUMN IF NOT EXISTS "expiresAt" timestamp;

-- Buscar el turno abierto de una terminal es la consulta caliente.
CREATE INDEX IF NOT EXISTS "pos_operator_sessions_open_idx"
  ON "pos_operator_sessions" ("terminalId", "endedAt");
