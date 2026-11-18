-- ── Tienda de productos para nichos de comida (café, panadería, restaurante) ──
--
-- Por qué en `menu_items` y no en una tabla nueva:
-- un producto se vende igual que un platillo —misma categoría, mismo carrito,
-- misma orden, mismo ticket, mismo POS y mismos reportes—. Duplicar el modelo
-- habría obligado a duplicar carrito, checkout, contabilidad y tickets. Lo único
-- que cambia es cómo se presenta y si necesita envío.
--
-- El STOCK no se guarda aquí: vive en `inventory_items` y se descuenta con la
-- receta 1:1 (`menu_item_ingredients` con quantityRequired = 1) que el POS ya
-- procesa al cobrar (`inventory_movements`). Así el inventario, sus alertas de
-- bajo stock y su historial siguen siendo una sola fuente de verdad.
--
-- `kind`:
--   DISH    → platillo/bebida de menú (comportamiento actual, valor por defecto)
--   PRODUCT → artículo de tienda: se muestra en la pestaña Tienda, puede pedir
--             dirección de envío y se vende por unidad.

ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "kind" text NOT NULL DEFAULT 'DISH';
ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "requiresShipping" boolean NOT NULL DEFAULT false;
ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "weightGrams" integer;
ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "maxPerOrder" integer;

-- El POS/KDS filtra por kind; el catálogo del cliente también.
CREATE INDEX IF NOT EXISTS "menu_items_kind_idx" ON "menu_items" ("branchId", "kind");

-- Comentarios para quien lea la base desde psql
COMMENT ON COLUMN "menu_items"."kind" IS 'DISH = menú · PRODUCT = tienda';
COMMENT ON COLUMN "menu_items"."requiresShipping" IS 'Producto que necesita dirección de entrega (tienda)';
COMMENT ON COLUMN "menu_items"."weightGrams" IS 'Peso del producto en gramos (cotización de envío)';
COMMENT ON COLUMN "menu_items"."maxPerOrder" IS 'Tope de unidades por pedido (stock limitado / preventa)';
