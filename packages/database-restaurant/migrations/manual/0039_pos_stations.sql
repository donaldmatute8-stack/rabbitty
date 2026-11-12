-- 0039 · Estaciones de preparación (Fase 0C-1)
--
-- Introduce el concepto de estación (cocina, barra, fríos, expediter) y la
-- asociación producto/categoría → estación, más el snapshot por ítem.
--
-- ⚠️ Aditiva y compatible: todas las columnas nuevas son NULLABLE y no cambia
--    ninguna fila existente. Sin configuración, todo cae a la estación por
--    defecto (creada aquí), así que el POS se comporta exactamente igual.
--
-- Contexto: Docs/POS-FASE-0/ADR-023-estaciones-y-kds.md
-- Aplica a: base de restaurante (RESTAURANT_DATABASE_URL)
-- IMPORTANTE: la conexión pooled de Neon no resuelve `public` por defecto;
--             ejecutar con `SET search_path TO public;` en la misma sesión.

BEGIN;

-- 1. Estaciones por sucursal
CREATE TABLE IF NOT EXISTS stations (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "branchId" text NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name text NOT NULL,
  -- KITCHEN | BAR | EXPO | COLD
  type text NOT NULL DEFAULT 'KITCHEN',
  "printerId" text,
  "isActive" boolean NOT NULL DEFAULT true,
  "isDefault" boolean NOT NULL DEFAULT false,
  "sortOrder" integer NOT NULL DEFAULT 0,
  "createdAt" timestamp DEFAULT now(),
  "updatedAt" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS stations_branch_name_uidx
  ON stations ("branchId", lower(name));

-- Una sola estación por defecto por sucursal.
CREATE UNIQUE INDEX IF NOT EXISTS stations_branch_default_uidx
  ON stations ("branchId")
  WHERE "isDefault" = true;

-- 2. Asociación (heredable). El override vive en el producto.
ALTER TABLE menu_categories
  ADD COLUMN IF NOT EXISTS "stationId" text REFERENCES stations(id) ON DELETE SET NULL;

ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS "stationId" text REFERENCES stations(id) ON DELETE SET NULL;

-- 3. Snapshot por ítem: se congela al enviar la comanda y no se recalcula.
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS "stationId" text,
  ADD COLUMN IF NOT EXISTS "printerId" text,
  ADD COLUMN IF NOT EXISTS "sentToStationAt" timestamp;

CREATE INDEX IF NOT EXISTS order_items_station_idx
  ON order_items ("stationId", status);

-- 4. Estación por defecto en cada sucursal existente (una sola, "Cocina").
INSERT INTO stations ("branchId", name, type, "isDefault", "sortOrder")
SELECT b.id, 'Cocina', 'KITCHEN', true, 0
  FROM branches b
 WHERE NOT EXISTS (
   SELECT 1 FROM stations s WHERE s."branchId" = b.id AND s."isDefault" = true
 );

COMMENT ON TABLE stations IS
  'Estaciones de preparación por sucursal (ADR-023). Sin configuración, todo va a la default.';
COMMENT ON COLUMN order_items."stationId" IS
  'Snapshot de la estación al enviar la comanda; nunca se recalcula.';
COMMENT ON COLUMN menu_items."stationId" IS
  'Override por producto; si es NULL hereda la estación de su categoría.';

COMMIT;
