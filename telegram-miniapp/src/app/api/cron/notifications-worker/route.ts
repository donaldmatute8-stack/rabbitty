import { NextRequest, NextResponse } from "next/server";
import { processOutboxBatch } from "@/lib/push/outbox";
import { expireOfferRedemptions } from "@rabbitty/api/services/offersExpiry";
import { db } from "@/db";

/**
 * ── Notification Worker (P0) ── Drena el outbox durable:
 * - Vercel/GH cron (cada 5 min) como piso.
 * - Piggyback tras cada POST /api/notifications para baja latencia.
 * Auth: Bearer CRON_SECRET (schedule) o sesión S2S.
 */
export async function GET(req: NextRequest) {
  const serverSecret = process.env.RABBITTY_API_SECRET;
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization")?.replace(/^Bearer /, "").trim() || "";
  const okAuth =
    (serverSecret && authHeader === serverSecret) ||
    (cronSecret && authHeader === cronSecret);
  if (!okAuth) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const limit = Math.min(100, Number(new URL(req.url).searchParams.get("limit") || 20));
  const summary = await processOutboxBatch(limit);

  // Barrido de canjes vencidos: se cuelga del worker que YA corre cada 5 min,
  // así no hace falta tocar la programación de Railway. Si falla, no rompe el
  // drenaje de notificaciones.
  let offers = { expired: 0, refundedBunz: 0 };
  try {
    offers = await expireOfferRedemptions(db, { limit: 100 });
  } catch (error) {
    console.warn("[notifications-worker] expiración de canjes falló:", error);
  }

  return NextResponse.json({
    success: true,
    ...summary,
    offersExpired: offers.expired,
    offersRefundedBunz: offers.refundedBunz,
    ranAt: new Date().toISOString(),
  });
}