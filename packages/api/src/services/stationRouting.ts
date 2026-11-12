/**
 * ── Ruteo de ítems a estaciones (Fase 0C) ──────────────────────────────────
 *
 * Resolución determinista, en este orden:
 *
 *   menu_items.stationId  →  menu_categories.stationId  →  estación default
 *
 * Si la sucursal no tiene estación default, devuelve `null` y el ítem queda sin
 * destino (el KDS lo sigue mostrando en la cola general, como hoy).
 *
 * Ver: Docs/POS-FASE-0/ADR-023-estaciones-y-kds.md
 */

import { and, eq, inArray } from "drizzle-orm";
import { menuCategories, menuItems, stations } from "@rabbitty/database-restaurant/schema";

export interface ResolvedStation {
  stationId: string | null;
  printerId: string | null;
}

const EMPTY: ResolvedStation = { stationId: null, printerId: null };

/**
 * Resuelve el destino de varios ítems en **3 consultas** (no N):
 * productos, categorías y estación por defecto.
 */
export async function resolveStationsForItems(
  db: any,
  branchId: string,
  items: Array<{ menuItemId: string }>,
): Promise<Map<string, ResolvedStation>> {
  const result = new Map<string, ResolvedStation>();
  const ids: string[] = [...new Set(items.map((i) => i.menuItemId).filter(Boolean))];
  if (ids.length === 0) return result;

  const itemRows: Array<{ id: string; stationId: string | null; categoryId: string | null }> = await db
    .select({
      id: menuItems.id,
      stationId: menuItems.stationId,
      categoryId: menuItems.categoryId,
    })
    .from(menuItems)
    .where(inArray(menuItems.id, ids));

  const categoryIds: string[] = Array.from(
    new Set(itemRows.map((r) => r.categoryId).filter((id): id is string => Boolean(id))),
  );
  const categoryRows: Array<{ id: string; stationId: string | null }> = categoryIds.length
    ? await db
        .select({ id: menuCategories.id, stationId: menuCategories.stationId })
        .from(menuCategories)
        .where(inArray(menuCategories.id, categoryIds))
    : [];
  const categoryStation = new Map<string, string>(
    categoryRows.filter((c: any) => c.stationId).map((c: any) => [c.id, c.stationId]),
  );

  const [fallback] = await db
    .select({ id: stations.id, printerId: stations.printerId })
    .from(stations)
    .where(and(eq(stations.branchId, branchId), eq(stations.isDefault, true)))
    .limit(1);

  // Impresoras de las estaciones involucradas (una sola consulta)
  const stationIds = new Set<string>();
  for (const row of itemRows) {
    const direct = (row as any).stationId ?? categoryStation.get((row as any).categoryId) ?? null;
    if (direct) stationIds.add(direct);
  }
  const printerByStation = new Map<string, string | null>();
  if (stationIds.size > 0) {
    const rows = await db
      .select({ id: stations.id, printerId: stations.printerId })
      .from(stations)
      .where(inArray(stations.id, Array.from(stationIds)));
    for (const r of rows) printerByStation.set(r.id, r.printerId ?? null);
  }

  for (const row of itemRows) {
    const item: any = row;
    const stationId =
      item.stationId ?? categoryStation.get(item.categoryId) ?? fallback?.id ?? null;
    const printerId = stationId
      ? (printerByStation.get(stationId) ?? (stationId === fallback?.id ? fallback?.printerId ?? null : null))
      : null;
    result.set(item.id, { stationId, printerId });
  }

  // Ítems que no existen en la tabla (no debería pasar) → default
  for (const id of ids) {
    if (!result.has(id)) {
      result.set(id, fallback ? { stationId: fallback.id, printerId: fallback.printerId ?? null } : EMPTY);
    }
  }

  return result;
}

/** Atajo para un solo ítem. */
export async function resolveStationForItem(
  db: any,
  branchId: string,
  menuItemId: string,
): Promise<ResolvedStation> {
  const map = await resolveStationsForItems(db, branchId, [{ menuItemId }]);
  return map.get(menuItemId) ?? EMPTY;
}
