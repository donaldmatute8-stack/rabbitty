/**
 * ── Existencias de los productos de tienda ────────────────────────────────
 *
 * El stock NO vive en el producto: se deriva de la receta contra `inventory_items`
 * (la misma fuente que descuenta el POS y la app al cobrar). Esta consulta se
 * usaba en tres lugares (admin, catálogo del cliente e invariantes), así que vive
 * aquí una sola vez.
 *
 * - Recetas con sub-recetas: se expanden con un CTE recursivo, con tope de
 *   profundidad para no colgarse con un ciclo mal cargado.
 * - Un producto **sin receta** no controla existencias: no aparece en el mapa.
 * - `stock` es la cantidad de unidades que se pueden vender: `floor(inventario /
 *   requerido)` tomando el insumo más restrictivo.
 */

import { sql, type SQLWrapper } from "drizzle-orm";

type SqlRunner = { execute: (query: SQLWrapper | string) => Promise<unknown> };

export interface ProductStock {
  /** Unidades vendibles antes de quedarse sin insumo. */
  stock: number;
  /** ¿Está por debajo del mínimo del insumo? */
  lowStock: boolean;
  /**
   * Insumo único de la receta resuelta (receta 1:1). Permite ajustar existencias
   * desde la tienda; con recetas compuestas es null y se administra en Inventario.
   */
  itemId: string | null;
}

function rowsOf(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) return result as Array<Record<string, unknown>>;
  const maybe = result as { rows?: Array<Record<string, unknown>> } | null;
  return maybe?.rows ?? [];
}

/**
 * Mapa `menuItemId → { stock, lowStock }`. Los productos sin receta no aparecen.
 */
export async function getProductStockMap(
  db: SqlRunner,
  productIds: string[],
): Promise<Map<string, ProductStock>> {
  const out = new Map<string, ProductStock>();
  if (productIds.length === 0) return out;

  const idList = sql.join(
    [...new Set(productIds)].map((id) => sql`${id}`),
    sql`, `,
  );

  const res = await db.execute(sql`
    WITH RECURSIVE req AS (
      SELECT mi."menuItemId" AS root_id,
             mi."inventoryItemId" AS inv_id,
             mi."subRecipeId" AS sub_id,
             mi."quantityRequired"::numeric AS qty,
             0 AS depth
      FROM "menu_item_ingredients" mi
      WHERE mi."menuItemId" IN (${idList})
      UNION ALL
      SELECT r.root_id, mi."inventoryItemId", mi."subRecipeId",
             (r.qty * mi."quantityRequired")::numeric, r.depth + 1
      FROM req r
      JOIN "menu_item_ingredients" mi ON mi."menuItemId" = r.sub_id
      WHERE r.sub_id IS NOT NULL AND r.depth < 6
    )
    ,
    -- ── Reserva blanda ──
    -- Unidades comprometidas en pedidos creados desde la app y aún sin pagar.
    -- No se mueve el inventario (evita doble descuento al cobrar): sólo se
    -- restan de la disponibilidad para que dos clientes no compren la última.
    pending AS (
      SELECT oi."menuItemId" AS id, SUM(oi.quantity)::int AS units
      FROM "order_items" oi
      JOIN "orders" o ON o.id = oi."orderId"
      WHERE o."status" IN ('PENDING', 'PENDING_PAYMENT', 'CASH_PAYMENT_REQUESTED')
        AND o."createdAt" >= now() - interval '60 minutes'
      GROUP BY 1
    )
    SELECT r.root_id AS id,
           CASE
             WHEN COUNT(DISTINCT r.inv_id) = 1
               THEN GREATEST(0, MIN(FLOOR(ii.stock / NULLIF(r.qty, 0)))::int - COALESCE(p.units, 0))
             ELSE MIN(FLOOR(ii.stock / NULLIF(r.qty, 0)))::int
           END AS stock,
           BOOL_OR(ii.stock <= ii."minStock") AS low,
           CASE WHEN COUNT(DISTINCT r.inv_id) = 1 THEN MIN(r.inv_id) END AS item_id
    FROM req r
    JOIN "inventory_items" ii ON ii.id = r.inv_id
    LEFT JOIN pending p ON p.id = r.root_id
    WHERE r.inv_id IS NOT NULL AND r.qty > 0
    GROUP BY r.root_id, p.units
  `);

  for (const row of rowsOf(res)) {
    const id = String(row.id ?? "");
    if (!id) continue;
    const stock = Number(row.stock ?? 0);
    out.set(id, {
      stock: Number.isFinite(stock) ? stock : 0,
      lowStock: Boolean(row.low),
      itemId: row.item_id ? String(row.item_id) : null,
    });
  }

  return out;
}
