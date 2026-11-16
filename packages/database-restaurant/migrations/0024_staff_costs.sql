-- Costos de personal (2026-11-16). Aditivo: defaults 0.
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "hourlyRate" real NOT NULL DEFAULT 0;
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "commissionPct" real NOT NULL DEFAULT 0;
