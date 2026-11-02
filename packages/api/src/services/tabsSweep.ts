import { sql } from "drizzle-orm";

/**
 * ── Tabs huérfanas: expiración de órdenes nunca ejecutadas ──
 * Marcado EXPIRED + voidReason STALE_TAB fuera de Tabs/dashboard/contabilidad,
 * auditables en DB. Se invoca: load de POS/dashboard, apertura de caja y cron.
 * Cutoff en SQL (nunca Date en params). Fallback 12h si el negocio no define.
 */
export async function expireStaleOrders(db: any, branchId: string): Promise<void> {
  try {
    const staleRes: any = await db.execute(sql`
      SELECT o.id AS "orderId" FROM "orders" o
      JOIN "branches" b ON b.id = o."branchId" AND b.id = ${branchId}
      JOIN "restaurants" r ON r.id = b."restaurantId"
      WHERE o."branchId" = ${branchId}
        AND o.status IN ('PENDING', 'CASH_PAYMENT_REQUESTED')
        AND o."createdAt" < (now() AT TIME ZONE 'UTC') - (COALESCE(r."staleOrderHours", 12) * interval '1 hour')
    `);
    const staleRows = staleRes?.rows ?? staleRes;
    const ids: string[] = Array.isArray(staleRows)
      ? staleRows.map((x: { orderId?: string }) => x.orderId).filter((v): v is string => Boolean(v))
      : [];
    if (ids.length === 0) return;

    await db.execute(sql`
      UPDATE "orders"
      SET status = 'EXPIRED', "voidReason" = 'STALE_TAB', "updatedAt" = now()
      WHERE id = ANY(${ids})`);

    // Payment intents vivos ligados → cancelados (los holds se liberan aparte en pos.ts)
    const liveRes: any = await db.execute(sql`
      UPDATE "payment_intents"
      SET status = 'CANCELLED', "updatedAt" = now()
      WHERE "orderId" = ANY(${ids}) AND status = 'PENDING_PAYMENT'`);
    void liveRes;
  } catch (err) {
    console.warn("[TABS_SWEEP] expiración de tabs falló:", err);
  }
}