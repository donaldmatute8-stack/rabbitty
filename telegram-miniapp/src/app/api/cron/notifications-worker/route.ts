import { NextRequest, NextResponse } from "next/server";
import { processOutboxBatch } from "@/lib/push/outbox";

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
  return NextResponse.json({ success: true, ...summary, ranAt: new Date().toISOString() });
}