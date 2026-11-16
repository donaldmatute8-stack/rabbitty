-- Reservas de mesa del restaurante (2026-11-16).
--
-- Contexto: `packages/database-restaurant` declara `reservations` con estas
-- columnas, pero en producción la tabla `reservations` nació con la forma de
-- `packages/database-core` (reservas de Bunz: businessId/title/bunzCost). Ambas
-- comparten la misma base, así que el router de reservas del restaurante fallaba.
--
-- Este parche es ADITIVO y todo nullable: no toca filas existentes (las de Bunz
-- quedan con estas columnas en NULL) y no altera ninguna consulta vieja.
-- El arreglo de fondo (separar las dos tablas) se hará aparte.

ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "branchId" text;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "tableId" text;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "customerName" text;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "customerPhone" text;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "partySize" integer;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "reservationTime" timestamp;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "notes" text;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp DEFAULT now();

CREATE INDEX IF NOT EXISTS "reservations_branch_time_idx" ON "reservations" ("branchId", "reservationTime");
