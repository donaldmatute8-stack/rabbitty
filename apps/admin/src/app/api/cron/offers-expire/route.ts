import { NextRequest, NextResponse } from "next/server";
import { getCoreDb } from "@rabbitty/api/db";
import { expireOfferRedemptions } from "@rabbitty/api/services/offersExpiry";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Cron de canjes vencidos (Stock). Cada 5 minutos:
 * devuelve el Bunz, restaura respaldo y stock, y avisa al Rabbitter.
 * GET /api/cron/offers-expire · Authorization: Bearer CRON_SECRET
 */
export async function GET(req: NextRequest) {
  // Sin secreto configurado el endpoint queda cerrado: si no, "Bearer undefined"
  // pasaría la comparación y cualquiera podría disparar el barrido.
  if (!CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET no configurado" }, { status: 401 });
  }
  if (req.headers.get("Authorization") !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await expireOfferRedemptions(getCoreDb(), { limit: 300 });
    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    console.error("[CRON_OFFERS_EXPIRE]", error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: "No se pudo expirar" }, { status: 500 });
  }
}
