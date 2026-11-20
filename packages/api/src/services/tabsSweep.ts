import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { orders, paymentIntents, tableSessions, branches, restaurants } from "@rabbitty/database-restaurant/schema";

/**
 * ── Tabs huérfanas: expiración de órdenes nunca ejecutadas ──
 * Marcado EXPIRED + voidReason STALE_TAB fuera de tabs/dashboard/contabilidad,
 * auditables en DB. Se invoca: load de POS/dashboard, apertura de caja y cron.
 *
 * v2: todo con DRIZZLE (inArray/lte) — el SQL crudo con array param `= ANY`
 * dependía del binding del driver; así el batch es idéntico en cualquier entorno
 * y 100% parameterizado.
 * Cutoff: now - staleOrderHours (fallback 12h si el negocio no define).
 */

export async function expireStaleOrders(db: any, branchId: string): Promise<void> {
  try {
    // 1. Órdenes candidatas: más viejas que staleOrderHours del negoc
    const cutoffsRes: any = await db
      .select({ id: orders.id })
      .from(orders)
      .innerJoin(branches, eq(branches.id, orders.branchId))
      .innerJoin(restaurants, eq(restaurants.id, branches.restaurantId))
      .where(
        and(
          eq(orders.branchId, branchId),
          inArray(orders.status, ["PENDING", "CASH_PAYMENT_REQUESTED"]),
          lt(orders.createdAt, sql`(now() AT TIME ZONE 'UTC') - (COALESCE(${restaurants.staleOrderHours}, 12) * interval '1 hour')`)
        )
      )
      .limit(500);

    const ids: string[] = (cutoffsRes as Array<{ id: string }>).map((r) => r.id);
    if (ids.length === 0) return;

    // 2. Marcar EXPIRED + STALE_TAB (auditables, fuera de tabs/dashboard)
    await db
      .update(orders)
      .set({ status: "EXPIRED", voidReason: "STALE_TAB", version: sql`${orders.version} + 1` })
      .where(and(inArray(orders.id, ids), inArray(orders.status, ["PENDING", "CASH_PAYMENT_REQUESTED"])));

    // 3. Payment intents ligados que sigan PENDING → cancelados
    await db
      .update(paymentIntents)
      .set({ status: "CANCELLED", updatedAt: new Date() })
      .where(
        and(
          inArray(paymentIntents.orderId, ids),
          eq(paymentIntents.status, "PENDING_PAYMENT")
        )
      );
    // 4) Órdenes en $0 (borradores de vinculación o un cierre a medias):
    //    no son pedidos cobrables. Se expiran solas para que no se queden en
    //    Operación/"Desde la App".
    const blanksRes: any = await db
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(
          eq(orders.branchId, branchId),
          eq(orders.status, "PENDING"),
          eq(orders.total, 0),
          lt(orders.createdAt, sql`now() - interval '10 minutes'`)
        )
      )
      .limit(500);
    const blankIds: string[] = (blanksRes as Array<{ id: string }>).map((r) => r.id);
    if (blankIds.length > 0) {
      await db
        .update(orders)
        .set({ status: "EXPIRED", voidReason: "ZERO_TOTAL_DRAFT", updatedAt: new Date(), version: sql`${orders.version} + 1` })
        .where(and(inArray(orders.id, blankIds), eq(orders.status, "PENDING")));
    }
  } catch (err) {
    console.warn("[TABS_SWEEP] expiración de tabs falló:", err);
  }
}

/**
 * ── Cierre de caja: no puede quedar nada "pendiente" en Operación ─────────
 *
 * Al cerrar el turno (Corte Z) se expiran las cuentas que quedaron abiertas y
 * se cierran las sesiones de mesa. Se marca EXPIRED (auditable) en vez de
 * borrar: desaparece de tabs, dashboard y contabilidad, pero el rastro queda.
 *
 * Solo toca lo NO cobrado (PENDING / PENDING_PAYMENT / CASH_PAYMENT_REQUESTED).
 * Una orden PAID sigue su curso: ya es dinero del negocio y cocina puede estar
 * preparándola.
 *
 * Devuelve las órdenes afectadas para avisar a los clientes de la app.
 */
export async function clearPendingTabsOnShiftClose(
  db: any,
  branchId: string,
): Promise<Array<{ id: string; customerId: string | null; total: number; orderType: string | null }>> {
  const rows: Array<{ id: string; customerId: string | null; total: number; orderType: string | null }> = await db
    .select({
      id: orders.id,
      customerId: orders.customerId,
      total: orders.total,
      orderType: orders.orderType,
    })
    .from(orders)
    .where(
      and(
        eq(orders.branchId, branchId),
        inArray(orders.status, ["PENDING", "PENDING_PAYMENT", "CASH_PAYMENT_REQUESTED"]),
      ),
    )
    .limit(500);

  if (rows.length > 0) {
    const ids = rows.map((r) => r.id);
    await db
      .update(orders)
      .set({
        status: "EXPIRED",
        voidReason: "SHIFT_CLOSED",
        updatedAt: new Date(),
        version: sql`${orders.version} + 1`,
      })
      .where(
        and(
          inArray(orders.id, ids),
          inArray(orders.status, ["PENDING", "PENDING_PAYMENT", "CASH_PAYMENT_REQUESTED"]),
        ),
      );

    await db
      .update(paymentIntents)
      .set({ status: "CANCELLED", updatedAt: new Date() })
      .where(
        and(
          inArray(paymentIntents.orderId, ids),
          eq(paymentIntents.status, "PENDING_PAYMENT"),
        ),
      );
  }

  // Las mesas abiertas se liberan: el turno terminó.
  await db
    .update(tableSessions)
    .set({ status: "CLOSED", closedAt: new Date() })
    .where(and(eq(tableSessions.branchId, branchId), eq(tableSessions.status, "OPEN")));

  return rows;
}
