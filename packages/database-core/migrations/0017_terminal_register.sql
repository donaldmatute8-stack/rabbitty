-- Caja/registro por terminal (2026-11-16). Aditivo: default MAIN.
ALTER TABLE "pos_terminals" ADD COLUMN IF NOT EXISTS "registerId" text NOT NULL DEFAULT 'MAIN';
