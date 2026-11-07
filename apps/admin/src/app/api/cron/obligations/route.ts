import { NextRequest, NextResponse } from "next/server";
import { inArray, sql } from "drizzle-orm";
import { getRestaurantDb } from "@rabbitty/api/db";
import { markOverdue } from "@rabbitty/api/services/bunzObligations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ── /api/cron/obligations ── OT-2: barrido diario de mora.
 *
 * Solo cambia el estado OPEN → LATE de las obligaciones vencidas. **No mueve
 * dinero**: la liquidación es otro paso, apagado por defecto.
 *
 * Autorización: CRON_SECRET (mismo patrón que el resto de cron).
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

  const db = getRestaurantDb();
  const { bunzObligations, bunzObligationEvents } = await import(
    "@rabbitty/database-restaurant/schema"
  );

  const marked = await markOverdue(db, {
    tables: { obligations: bunzObligations, events: bunzObligationEvents },
  });

  // Foto de deuda (read-only) para el log del cron.
  const [summary] = await db
    .select({
      open: sql<number>`count(*) filter (where ${bunzObligations.state} = 'OPEN')`,
      late: sql<number>`count(*) filter (where ${bunzObligations.state} = 'LATE')`,
      partial: sql<number>`count(*) filter (where ${bunzObligations.state} = 'PARTIAL')`,
      outstanding: sql<number>`coalesce(sum(${bunzObligations.amountBunz} - ${bunzObligations.settledBunz}), 0)`,
    })
    .from(bunzObligations)
    .where(inArray(bunzObligations.state, ["OPEN", "LATE", "PARTIAL"]));

  return NextResponse.json({
    ok: marked.ok,
    date: new Date().toISOString().slice(0, 10),
    marked: marked.marked,
    errors: marked.errors,
    outstanding: Number(summary?.outstanding) || 0,
    states: {
      open: Number(summary?.open) || 0,
      late: Number(summary?.late) || 0,
      partial: Number(summary?.partial) || 0,
    },
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
