import { NextRequest, NextResponse } from "next/server";
import { inArray, sql } from "drizzle-orm";
import { getRestaurantDb } from "@rabbitty/api/db";
import { scanOverdue } from "@rabbitty/api/services/bunzObligations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ── /api/cron/obligations ── OT-2: foto diaria de deuda y mora.
 *
 * La mora **no es un estado**: se deriva de `dueAt < now` (contrato v1.0).
 * Este cron solo cuenta y reporta; **no escribe ni mueve dinero**. La
 * liquidación es otro paso, apagado por defecto.
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
  const { bunzObligations } = await import(
    "@rabbitty/database-restaurant/schema"
  );

  const overdue = await scanOverdue(db, { tables: { obligations: bunzObligations } });

  // Foto de deuda (read-only) para el log del cron.
  const [summary] = await db
    .select({
      open: sql<number>`count(*) filter (where ${bunzObligations.state} = 'OPEN')`,
      disputed: sql<number>`count(*) filter (where ${bunzObligations.state} = 'DISPUTED')`,
      partial: sql<number>`count(*) filter (where ${bunzObligations.state} = 'PARTIALLY_PAID')`,
      outstanding: sql<number>`coalesce(sum(${bunzObligations.amountBunz} - ${bunzObligations.settledBunz}), 0)`,
    })
    .from(bunzObligations)
    .where(
      inArray(bunzObligations.state, ["OPEN", "DISPUTED", "RESOLVED_PAYABLE", "PARTIALLY_PAID"])
    );

  return NextResponse.json({
    ok: overdue.ok,
    date: new Date().toISOString().slice(0, 10),
    overdue: overdue.overdue,
    outstanding: Number(summary?.outstanding) || 0,
    overdueOutstanding: overdue.outstanding,
    errors: overdue.errors,
    states: {
      open: Number(summary?.open) || 0,
      disputed: Number(summary?.disputed) || 0,
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
