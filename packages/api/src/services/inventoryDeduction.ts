/**
 * ── Inventario por venta: verificación y descuento ────────────────────────
 *
 * Vive aquí y no dentro del POS porque ahora hay **dos** caminos que cobran:
 * el POS (`pos.processPayment`) y la app del Rabbitter (`/api/pos/checkout`).
 * Antes sólo el POS descontaba stock: una venta desde la app dejaba el
 * inventario intacto. Con la tienda de productos eso ya no es tolerable.
 *
 * Reglas (heredadas del POS, no se reinventan):
 * - La receta puede ser recursiva (`subRecipeId`), con protección contra ciclos.
 * - Se descuenta al COBRAR, no al crear la orden.
 * - Cada insumo rebajado deja su `inventory_movements` (historial auditable).
 *
 * Un producto de tienda es un platillo con receta 1:1 a un insumo, así que este
 * motor le descuenta el stock sin código extra.
 *
 * La resolución de recetas se hace UNA vez por pedido y la comparten la
 * verificación (antes de vender) y el descuento (al cobrar): misma verdad.
 */

import { eq, sql } from "drizzle-orm";
import {
  menuItemIngredients,
  inventoryMovements,
  orderItems,
} from "@rabbitty/database-restaurant/schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

export interface StockItemInput {
  menuItemId: string;
  quantity: number;
}

export interface StockShortage {
  inventoryItemId: string;
  name: string;
  required: number;
  available: number;
}

export interface InventoryDeductionResult {
  deducted: Array<{ inventoryItemId: string; quantity: number }>;
  /** Insumos que quedaron en negativo después de descontar (aviso, no bloqueo). */
  warnings: string[];
}

/**
 * Traduce líneas de pedido a cantidades de insumos, siguiendo sub-recetas.
 * Devuelve un mapa `inventoryItemId → cantidad total`.
 */
export async function resolveInventoryRequirements(
  tx: AnyDb,
  items: StockItemInput[],
): Promise<Map<string, number>> {
  const totals = new Map<string, number>();

  const walk = async (menuItemId: string, qty: number, path: Set<string>) => {
    if (path.has(menuItemId)) return; // ciclo en la receta: se corta
    path.add(menuItemId);

    const ingredients = await tx
      .select()
      .from(menuItemIngredients)
      .where(eq(menuItemIngredients.menuItemId, menuItemId));

    for (const ing of ingredients) {
      const required = Number(ing.quantityRequired) * qty;
      if (ing.inventoryItemId) {
        totals.set(ing.inventoryItemId, (totals.get(ing.inventoryItemId) ?? 0) + required);
      } else if (ing.subRecipeId) {
        await walk(ing.subRecipeId, required, path);
      }
    }

    path.delete(menuItemId);
  };

  for (const item of items) {
    if (!item.menuItemId || !(item.quantity > 0)) continue;
    await walk(item.menuItemId, item.quantity, new Set());
  }

  return totals;
}

/**
 * ¿Alcanza el stock? Devuelve la lista de faltantes (vacía = todo bien).
 * Se usa ANTES de crear/cobrar el pedido para no vender lo que no hay.
 */
export async function checkStockForItems(
  tx: AnyDb,
  items: StockItemInput[],
): Promise<StockShortage[]> {
  const requirements = await resolveInventoryRequirements(tx, items);
  if (requirements.size === 0) return [];

  const ids = [...requirements.keys()];
  const rows = (await tx.execute(
    sql`SELECT id, name, stock FROM inventory_items WHERE id IN (${sql.join(
      ids.map((id) => sql`${id}`),
      sql`, `,
    )})`,
  )) as { rows?: Array<{ id: string; name: string | null; stock: number | null }> }
    | Array<{ id: string; name: string | null; stock: number | null }>;
  const stockRows = Array.isArray(rows) ? rows : rows.rows ?? [];
  const byId = new Map(stockRows.map((r) => [r.id, r]));

  const shortages: StockShortage[] = [];
  for (const [inventoryItemId, required] of requirements) {
    const row = byId.get(inventoryItemId);
    // Sin fila de inventario no se bloquea la venta: el comercio no lo está
    // controlando y el POS tampoco lo bloqueaba. Sólo se bloquea lo contado.
    if (!row) continue;
    const available = Number(row.stock ?? 0);
    if (required > available) {
      shortages.push({
        inventoryItemId,
        name: row.name ?? "Insumo",
        required,
        available,
      });
    }
  }
  return shortages;
}

/**
 * Descuenta el inventario de una orden ya cobrada y deja el histórico.
 * Idempotente por orden a nivel de negocio: si se llama dos veces se descuenta
 * dos veces, así que sólo debe invocarse en la transición a pagado.
 */
export async function deductOrderInventory(
  tx: AnyDb,
  orderId: string,
  branchId: string,
  options: { notes?: string } = {},
): Promise<InventoryDeductionResult> {
  const result: InventoryDeductionResult = { deducted: [], warnings: [] };

  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const requirements = await resolveInventoryRequirements(
    tx,
    items
      .filter((item: { menuItemId: string | null }) => Boolean(item.menuItemId))
      .map((item: { menuItemId: string; quantity: number }) => ({
        menuItemId: item.menuItemId,
        quantity: Number(item.quantity),
      })),
  );

  for (const [inventoryItemId, quantity] of requirements) {
    await tx.insert(inventoryMovements).values({
      itemId: inventoryItemId,
      branchId,
      type: "SALE_DEDUCTION",
      quantity,
      reference: orderId,
      notes: options.notes ?? `Order ${orderId} completed`,
    });
    await tx.execute(
      sql`UPDATE inventory_items SET stock = stock - ${quantity} WHERE id = ${inventoryItemId}`,
    );
    result.deducted.push({ inventoryItemId, quantity });
  }

  if (result.deducted.length > 0) {
    const ids = result.deducted.map((d) => d.inventoryItemId);
    try {
      const negative = (await tx.execute(
        sql`SELECT name, stock FROM inventory_items WHERE id IN (${sql.join(
          ids.map((id) => sql`${id}`),
          sql`, `,
        )}) AND stock < 0`,
      )) as { rows?: Array<{ name: string | null; stock: number | null }> }
        | Array<{ name: string | null; stock: number | null }>;
      const rows = Array.isArray(negative) ? negative : negative.rows ?? [];
      for (const row of rows) {
        result.warnings.push(`${row.name ?? "insumo"}: stock ${row.stock}`);
      }
    } catch {
      /* el aviso es best-effort: el cobro ya está registrado */
    }
  }

  return result;
}
