import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { orders, paymentIntents, branches, restaurants } from "@rabbitty/database-restaurant/schema";

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
      .set({ status: "EXPIRED", voidReason: "STALE_TAB" })
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
  } catch (err) {
    console.warn("[TABS_SWEEP] expiración de tabs falló:", err);
  }
}