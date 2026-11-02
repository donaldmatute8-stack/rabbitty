import { NextRequest, NextResponse } from "next/server";
import { getRestaurantDb } from "@rabbitty/api/db";
import { reconcileOrderCashback } from "@rabbitty/api/services/paymentCore";
import { and, eq, gte, sql } from "drizzle-orm";

export const runtime = "nodejs";

/**
 * ── /api/internal/cashback-reconcile ── H8: conciliación de cashback faltante.
 * Caso vivo: intent regenerado sin pagador / pago vía link de cuenta liquidado
 * por webhook SIN mintear Bunz (orden COMPLETED con bunzReward=0 y sin ledger
 * pos_rwd_*). Idempotente: bunzReward>0 → skip; ledger key pos_rwd_{orderId}
 * no duplica (el mint re-choca si ya existía).
 *
 * POST { orderId }            → concilia UNA orden.
 * POST { days?: number }      → escanea órdenes COMPLETED con bunzReward=0 de
 *                               los últimos N días (default 3, máx 30).
 * Header `x-rating-secret` === RATING_INTERNAL_SECRET (mismo secret interno que
 * el canal del rating — llave de servidor a servidor compartida miniapp↔admin).
 */
const FAILURE_STATUS: Record<string, number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  NOT_LIQUID: 400,
  WINDOW_CLOSED: 400,
};

export async function POST(req: NextRequest) {
  const expected = process.env.RATING_INTERNAL_SECRET || "";
  const provided = req.headers.get("x-rating-secret") || "";
  if (!expected || provided !== expected) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const db = getRestaurantDb();
    // Import lazy del schema (mismo patrón que los routers)
    const { orders } = await import("@rabbitty/database-restaurant/schema");

    if (body?.orderId) {
      const result = await reconcileOrderCashback(db, { orderId: String(body.orderId) });
      return NextResponse.json({ ...result, orderId: body.orderId });
    }

    const days = Math.min(30, Math.max(1, Number(body?.days || 3)));
    const rows = await db
      .select({ id: orders.id })
      .from(orders)
      .where(and(
        sql`${orders.status} IN ('COMPLETED','PAID')`,
        sql`COALESCE(${orders.bunzReward}, 0) = 0`,
        gte(orders.createdAt, new Date(Date.now() - days * 86_400_000))
      ))
      .limit(200);

    const results: Array<{ orderId: string; minted: boolean; bunz?: number; skipped?: string }> = [];
    for (const row of rows) {
      const r = await reconcileOrderCashback(db, { orderId: row.id }).catch((err) => {
        console.error("[CASHBACK_RECONCILE] lote falló en", row.id, err);
        return { minted: false, skipped: "ERROR" } as const;
      });
      results.push({ orderId: row.id, ...r } as { orderId: string; minted: boolean; bunz?: number; skipped?: string });
    }
    return NextResponse.json({
      ok: true,
      scanned: results.length,
      minted: results.filter((r) => r.minted).length,
      results,
    });
  } catch (err: unknown) {
    console.error("[CASHBACK_RECONCILE] lote falló:", err instanceof Error ? err.stack || err.message : err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

// Referencias para lint (FAILURE_STATUS se usa a futuro si este route crece)
void FAILURE_STATUS;
