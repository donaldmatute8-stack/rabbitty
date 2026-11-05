import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCoreDb } from "@rabbitty/api/db";
import { publishScheduledBroadcasts } from "@rabbitty/api/services/bunzyConnect";

export const runtime = "nodejs";

/**
 * ── Bunzy Connect · cron de programados ──
 * Protegido con CRON_SECRET (o BUNZY_CONNECT_SECRET como fallback). Publica los
 * broadcasts cuyo scheduledAt ya pasó. Idempotente por delivery unique.
 */
function authorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET || process.env.BUNZY_CONNECT_SECRET || "";
  const provided =
    (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "") ||
    req.headers.get("x-cron-secret") ||
    "";
  if (!expected || !provided) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const result = await publishScheduledBroadcasts(getCoreDb());
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "error" },
      { status: 500 },
    );
  }
}
