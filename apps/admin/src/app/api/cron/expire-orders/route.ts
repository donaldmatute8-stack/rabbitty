import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getRestaurantDb } from "@rabbitty/api/db";
import { orders, branches, restaurants } from "@rabbitty/database-restaurant/schema";
import { and, eq, inArray, lt } from "drizzle-orm";
import { paymentIntents } from "@rabbitty/database-restaurant/schema";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Cron de limpieza de tabs/comandas huérfanas en TODOS los restaurantes:
 * órdenes PENDING / CASH_PAYMENT_REQUESTED creadas hace más de
 * `staleOrderHours` (columna configurable por restauran, default 12h) y nunca
 * pagadas ni ejecutadas → status EXPIRED + voidReason STALE_TAB
 * (fuera de tabs/dashboard/contabilidad, auditables en DB).
 * Cancela payment intents vivos y libera sus holds de Bunz.
 *
 * Registro en Railway cron → GET /api/cron/expire-orders (Authorization: Bearer CRON_SECRET).
 */
export async function GET(req: NextRequest) {
  if (req.headers.get("Authorization") !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const restaurantDb = getRestaurantDb();
  const expired: { restaurantName: string; orderId: string }[] = [];

  // Todos los restaurantes con su timeout configurado
  const rows: { rId: string; rName: string; hours: number }[] = (await restaurantDb
    .select({ rId: restaurants.id, rName: restaurants.name, hours: restaurants.staleOrderHours })
    .from(restaurants)) as unknown as { rId: string; rName: string; hours: number }[];

  for (const r of rows) {
    const branchIds = (await restaurantDb
      .select({ id: branches.id })
      .from(branches)
      .where(eq(branches.restaurantId, r.rId))) as unknown as { id: string }[];
    if (branchIds.length === 0) continue;

    const cutoff = new Date(Date.now() - (r.hours ?? 12) * 3600 * 1000);
    const stale = (await restaurantDb
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(
          inArray(orders.branchId, branchIds.map((b) => b.id)),
          inArray(orders.status, ["PENDING", "CASH_PAYMENT_REQUESTED"]),
          lt(orders.createdAt, cutoff),
        )
      )) as unknown as { id: string }[];
    if (stale.length === 0) continue;

    const staleIds = stale.map((s) => s.id);
    await restaurantDb
      .update(orders)
      .set({ status: "EXPIRED", voidReason: "STALE_TAB" } as never)
      .where(inArray(orders.id, staleIds));

    // Cancelar intents vivos / liberar holds de Bunz ligados
    const liveIntents = (await restaurantDb
      .select()
      .from(paymentIntents)
      .where(and(inArray(paymentIntents.orderId, staleIds), eq(paymentIntents.status, "PENDING_PAYMENT")))) as Array<{ id: string; bunzAmount: number }>;
    for (const intent of liveIntents) {
      if (Number(intent.bunzAmount || 0) > 0) {
        const { releasePaymentIntentHold } = await import("@rabbitty/api/services/paymentCore");
        await releasePaymentIntentHold(restaurantDb as never, {
          paymentIntentId: intent.id,
          reason: "STALE_TAB",
        } as never).catch((err: unknown) => console.warn("[CRON_EXPIRE] release falló:", err));
      } else {
        await restaurantDb
          .update(paymentIntents)
          .set({ status: "CANCELLED" } as never)
          .where(eq(paymentIntents.id, intent.id));
      }
    }

    for (const id of staleIds) expired.push({ restaurantName: r.rName, orderId: id });
  }

  // ── Refresco del tipo de cambio USD/MXN de HOY ──
  // Una sola llamada a la API gratuita alimenta a TODOS los restaurantes en
  // modo AUTO (caché 24h). Los MANUAL no se tocan.
  let fxRate: number | null = null;
  let fxUpdated = 0;
  try {
    const fxRes = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(5000) });
    if (fxRes.ok) {
      const data = (await fxRes.json()) as { result?: string; rates?: Record<string, number> };
      const mxn = data?.rates?.MXN;
      if (data?.result === "success" && typeof mxn === "number" && mxn > 1 && mxn < 100) {
        fxRate = Math.round(mxn * 1000) / 1000;
        await restaurantDb.execute(sql`
          UPDATE "restaurants"
          SET "usdRate" = ${fxRate}, "usdRateUpdatedAt" = now()
          WHERE "usdRateMode" = 'AUTO'`);
        fxUpdated = (await restaurantDb.select({ id: restaurants.id }).from(restaurants).where(sql`"usdRateMode" = 'AUTO'`)).length;
      }
    }
  } catch (fxErr) {
    console.warn("[CRON_EXPIRE] refresh de FX falló:", fxErr);
  }

  return NextResponse.json({
    success: true,
    expiredCount: expired.length,
    expired,
    fxRate,
    fxRestaurantsUpdated: fxUpdated,
    ranAt: new Date().toISOString(),
  });
}