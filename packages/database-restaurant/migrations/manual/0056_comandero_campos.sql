-- 0056 · Comandero: alergias, nombre del comensal y tipo de terminal
--
-- Contexto: Docs/POS-FASE-0/ADR-025-comandero-y-dispositivos.md
-- Aditiva. Sin valores por defecto peligrosos; todo nullable salvo `kind`.

BEGIN;

-- ── Order items ─────────────────────────────────────────────────────────────
-- Alergias: catálogo + nota libre (se guarda como texto legible para cocina).
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS allergies text;
COMMENT ON COLUMN order_items.allergies IS
  'Alergias del comensal (catálogo + nota libre). Se imprime y se muestra en el KDS.';

-- Nombre con el que se entrega el platillo ("para Luis", "para la señora del fondo").
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS "guestName" text;
COMMENT ON COLUMN order_items."guestName" IS
  'Nombre del comensal al que pertenece el platillo. El mesero entrega por nombre.';

-- ── Terminales ──────────────────────────────────────────────────────────────
-- Qué puede hacer el dispositivo: cobrar, tomar pedidos o solo mostrar cocina.
ALTER TABLE pos_terminals ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'CASHIER';
COMMENT ON COLUMN pos_terminals.kind IS
  'CASHIER | COMANDERO | KDS. El servidor lo usa para no dejar cobrar desde un comandero.';

CREATE INDEX IF NOT EXISTS order_items_guest_idx ON order_items ("guestName");

COMMIT;
