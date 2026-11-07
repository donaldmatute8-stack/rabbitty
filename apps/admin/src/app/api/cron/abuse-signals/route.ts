import { NextRequest, NextResponse } from "next/server";
import { getRestaurantDb } from "@rabbitty/api/db";
import { isAbuseEnabled, runAbuseDetection } from "@rabbitty/api/services/bunzAbuse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ── /api/cron/abuse-signals ── OT-5: detección determinista de abuso.
 *
 * Solo escribe señales para revisión humana (`bunz_abuse_signals`). No bloquea
 * cobros, redenciones ni cuentas. Detrás de `RABBITTY_BUNZ_ABUSE`.
 *
 * Autorización: CRON_SECRET.
 */
function authorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET || "";
  if (!expected) return false;
  const provided =
    (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "") ||
    (req.headers.get("x-cron-secret") || "") ||
    new URL(req.url).searchParams.get("secret") ||
    "";
  return provided === expected;
}

async function run() {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET no configurado" }, { status: 401 });
  }
  if (!isAbuseEnabled()) {
    return NextResponse.json({ ok: true, skipped: true, reason: "RABBITTY_BUNZ_ABUSE apagado" });
  }

  const db = getRestaurantDb();
  const { bunzRedemptionAttempts, bunzAbuseSignals, orders } = await import(
    "@rabbitty/database-restaurant/schema"
  );

  const result = await runAbuseDetection(db, {
    tables: { attempts: bunzRedemptionAttempts, orders, signals: bunzAbuseSignals },
  });

  return NextResponse.json({
    ok: result.ok,
    date: new Date().toISOString().slice(0, 10),
    detected: result.detected,
    inserted: result.inserted,
    errors: result.errors,
  });
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return run();
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return run();
}
