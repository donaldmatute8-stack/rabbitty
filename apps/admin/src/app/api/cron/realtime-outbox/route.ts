import { NextRequest, NextResponse } from "next/server";
import { getRestaurantDb } from "@rabbitty/api/db";
import { processRealtimeOutboxBatch, isRealtimePublishConfigured } from "@rabbitty/api/services/realtimeOutbox";

export const runtime = "nodejs";

/**
 * Worker del outbox POS/KDS (0C-5). Drena `realtime_outbox` hacia Centrifugo.
 * Auth: Bearer CRON_SECRET o RABBITTY_API_SECRET (mismo patrón que el resto).
 */
function authorize(req: NextRequest): boolean {
  const auth = (req.headers.get("authorization") || "").replace(/^Bearer /, "").trim();
  const cron = process.env.CRON_SECRET;
  const s2s = process.env.RABBITTY_API_SECRET;
  return Boolean(auth && ((cron && auth === cron) || (s2s && auth === s2s)));
}

export async function GET() {
  return NextResponse.json({ success: true, configured: isRealtimePublishConfigured() });
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  try {
    const db = await getRestaurantDb();
    const summary = await processRealtimeOutboxBatch(db, 50);
    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    console.error("[REALTIME_OUTBOX]", error);
    return NextResponse.json({ success: false, error: "No se pudo drenar el outbox" }, { status: 500 });
  }
}
