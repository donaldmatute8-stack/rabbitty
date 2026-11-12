-- 0038 · Integridad de órdenes (Fase 0B-1)
--
-- ⚠️ NO APLICADA. Esta migración debe correr primero en la base local/staging
--    y solo después en producción, junto con el código que la usa.
--    Motivo: al agregar columnas al esquema Drizzle, cualquier `SELECT *`
--    (`.select().from(orders)`) las incluye; sin la columna, Postgres falla.
--
-- Contexto: Docs/POS-FASE-0/ADR-018-integridad-ordenes.md
-- Aplica a: base de restaurante (RESTAURANT_DATABASE_URL)

BEGIN;

-- 1. Control de versión por orden (D-03)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "updatedByStaffId" text,
  ADD COLUMN IF NOT EXISTS "updatedByTerminalId" text;

COMMENT ON COLUMN orders.version IS
  'Versión optimista de la orden. Toda mutación la incrementa. Ver ADR-018.';
COMMENT ON COLUMN orders."updatedByStaffId" IS 'Último empleado que mutó la orden.';
COMMENT ON COLUMN orders."updatedByTerminalId" IS 'Última terminal que mutó la orden.';

-- 2. Bitácora append-only de mutaciones (trazabilidad)
CREATE TABLE IF NOT EXISTS order_events (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "orderId" text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  type text NOT NULL,
  "versionBefore" integer NOT NULL,
  "versionAfter" integer NOT NULL,
  "staffId" text,
  "terminalId" text,
  "idempotencyKey" text,
  payload jsonb,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

-- Idempotencia opcional: si viene clave, no se duplica el asiento.
CREATE UNIQUE INDEX IF NOT EXISTS order_events_idempotency_uidx
  ON order_events ("idempotencyKey")
  WHERE "idempotencyKey" IS NOT NULL;

CREATE INDEX IF NOT EXISTS order_events_order_idx
  ON order_events ("orderId", "createdAt" DESC);

COMMENT ON TABLE order_events IS
  'Append-only: qué mutó cada orden, con versión antes/después y actor. ADR-018 §6.2.';

-- 3. Índice de apoyo para detectar órdenes tocadas por varias terminales
CREATE INDEX IF NOT EXISTS orders_version_idx ON orders (version);

COMMIT;

-- NOTA: el trigger de invariante de totales (ADR-018 §8) NO se crea aquí.
-- Requiere: (a) validar la fórmula real con redondeos y descuentos,
--           (b) correr conciliación previa que reporte deriva actual.
-- Se agregará en una migración posterior (D-13).
