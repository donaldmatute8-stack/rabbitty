import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getRestaurantDb } from "@rabbitty/api/db";

/**
 * ── Vista pública de ticket ya pagado ──
 * El link de WhatsApp/reenvíos usa `?ticket={orderId}` (sin firma): muestra el
 * ticket en modo "ya acreditado" — el CLAIM con Bunz sigue requiriendo el
 * claimToken firmado (orderId.exp.hmac) en el QR impreso.
 * Rate-limit en-process simple (30/min por IP) — suficiente para un enlace de lectura.
 */
const hits = new Map<string, { n: number; reset: number }>();
function rateLimitOk(ip: string): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now > h.reset) { hits.set(ip, { n: 1, reset: now + 60_000 }); return true; }
  h.n += 1;
  return h.n <= 30;
}

export async function GET(req: NextRequest) {
  try {
    const ip = (req.headers.get("x-forwarded-for") || "anon").split(",")[0].trim();
    if (!rateLimitOk(ip)) {
      return NextResponse.json({ success: false, error: "Demasiadas consultas" }, { status: 429 });
    }

    const orderId = String(new URL(req.url).searchParams.get("orderId") || "").trim();
    if (!orderId) return NextResponse.json({ success: false, error: "orderId requerido" }, { status: 400 });

    const db = getRestaurantDb();
    const raw = await db.execute(sql`
      SELECT o.id, o.total, o."createdAt", o."bunzReward",
             r.name AS "restaurantName"
      FROM "orders" o
      JOIN "branches" b ON b.id = o."branchId"
      JOIN "restaurants" r ON r.id = b."restaurantId"
      WHERE o.id = ${orderId}
      LIMIT 1`);
    // postgres.js devuelve array directo; otros drivers traen .rows
    const list = ((raw as { rows?: unknown[] }).rows ?? raw) as Array<Record<string, unknown>>;
    const row = list[0] ?? null;
    if (!row) return NextResponse.json({ success: false, error: "Ticket no encontrado" }, { status: 404 });

    return NextResponse.json({
      success: true,
      ticket: {
        orderId: String(row.id),
        orderNumber: String(row.id).slice(-4).toUpperCase(),
        total: Number(row.total || 0),
        createdAt: row.createdAt ? new Date(row.createdAt as string | number).toISOString() : null,
        bunzAwarded: Number(row.bunzReward || 0),
        restaurantName: row.restaurantName ?? null,
      },
    });
  } catch (err: any) {
    console.error("[TICKET_VIEW]", err?.message || err);
    return NextResponse.json({ success: false, error: "No se pudo leer el ticket" }, { status: 500 });
  }
}
