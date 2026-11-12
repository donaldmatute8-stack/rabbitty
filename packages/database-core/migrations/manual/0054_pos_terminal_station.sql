-- 0054 · Terminal POS atada a una estación (Fase 0C-4b)
--
-- Permite que una tablet de cocina quede fija a su estación: el servidor usa la
-- estación del token, no la que pida el cliente. Cierra el aislamiento real
-- entre cocina y barra.
--
-- Aditiva: columna nullable. Sin asignar, la terminal se comporta como hoy.
-- Contexto: Docs/POS-FASE-0/ADR-023-estaciones-y-kds.md

ALTER TABLE pos_terminals
  ADD COLUMN IF NOT EXISTS "stationId" text;

COMMENT ON COLUMN pos_terminals."stationId" IS
  'Estación fija de esta terminal (0C-4b). Si existe, manda sobre la del cliente.';
