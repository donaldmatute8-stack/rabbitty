import { NextRequest, NextResponse } from "next/server";
import { getRestaurantDb } from "@rabbitty/api/db";
import { runReconciliation } from "@rabbitty/api/services/bunzReconciliation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * ── /api/cron/reconciliation ── RP-2B: conciliación diaria con pausa.
 *
 * Verifica libro, obligaciones y órdenes contra pagos. Si algo grave no cuadra,
 * pausa el flujo afectado en `bunz_control_state`. No mueve dinero ni corrige.
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

  const db = getRestaurantDb();
  const {
    bunzLedgerEntries,
    bunzObligations,
    orders,
    payments,
    bunzReconciliationRuns,
    bunzControlState,
  } = await import("@rabbitty/database-restaurant/schema");
  const { merchantCapacityAccounts } = await import("@rabbitty/database-core/schema");

  const result = await runReconciliation(db, {
    tables: {
      ledger: bunzLedgerEntries,
      obligations: bunzObligations,
      orders,
      payments,
      runs: bunzReconciliationRuns,
      controlState: bunzControlState,
      accounts: merchantCapacityAccounts,
    },
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return run();
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return run();
}
