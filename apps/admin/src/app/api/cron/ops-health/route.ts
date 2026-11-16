import { NextRequest, NextResponse } from "next/server";
import { getRestaurantDb, getCoreDb } from "@rabbitty/api/db";
import { runOpsHealthCheck } from "../../../../lib/ops-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * ── /api/cron/ops-health ── invariantes operativos ─────────────────────────
 *
 * La misma revisión corre **dentro del proceso** cada 15 min
 * (`src/lib/ops-scheduler.ts`), porque el scheduler de GitHub no disparó los
 * workflows nuevos. Este endpoint existe para poder forzarla a mano y para que
 * un cron externo (si algún día se usa) tenga a dónde llamar.
 *
 * Responde 200 aunque haya invariantes críticos: que el monitoreo falle no debe
 * parecer que el negocio falló. El estado viaja en el cuerpo.
 */
export async function GET(req: NextRequest) {
  if (!CRON_SECRET || req.headers.get("Authorization") !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runOpsHealthCheck({
    restaurantDb: getRestaurantDb(),
    coreDb: getCoreDb(),
  });

  return NextResponse.json({ ok: true, checkedAt: new Date().toISOString(), ...result });
}
