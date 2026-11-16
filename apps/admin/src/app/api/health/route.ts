import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getRestaurantDb, getCoreDb } from "@rabbitty/api/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ── /api/health ── salud del servicio ──────────────────────────────────────
 *
 * Dos usos distintos a propósito:
 *
 * 1. **Healthcheck de Railway** (`healthcheckPath` en railway.json) → responde
 *    200 si el proceso puede servir. NO depende de la base: si Neon tiene un
 *    hipo, no queremos que Railway reinicie el contenedor en bucle (eso no
 *    arregla la base y tira las sesiones de los comercios que sí estaban
 *    trabajando). El gate de base de datos ya lo hace el pre-deploy
 *    (`sql-migrate` + `schema-guard`), que corre antes de promover un deploy.
 *
 * 2. **Monitoreo externo / invariantes** (`?strict=1`) → 503 si alguna base no
 *    responde. Es el que consulta el cron de invariantes y el sintético.
 *
 * Nunca expone datos de negocio: solo latencias, commit y un booleano por base.
 */
type DbHealth = { ok: boolean; ms: number; error?: string };

async function probe(run: () => Promise<unknown>): Promise<DbHealth> {
  const t0 = Date.now();
  try {
    await run();
    return { ok: true, ms: Date.now() - t0 };
  } catch (e) {
    // El detalle va al log del servidor, no a la respuesta: este endpoint es
    // público (lo consulta el healthcheck) y un mensaje de Postgres puede
    // revelar nombres de tablas o columnas.
    console.error("[health] base no disponible:", e instanceof Error ? e.message : e);
    return { ok: false, ms: Date.now() - t0, error: "db_unreachable" };
  }
}

export async function GET(req: NextRequest) {
  const strict = new URL(req.url).searchParams.get("strict") === "1";

  const [restaurant, core] = await Promise.all([
    probe(() => getRestaurantDb().execute(sql`select 1`)),
    probe(() => getCoreDb().execute(sql`select 1`)),
  ]);

  const dbOk = restaurant.ok && core.ok;
  const status = dbOk ? "ok" : "degraded";

  const body = {
    status,
    commit:
      process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ??
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
      "dev",
    uptimeSec: Math.round(process.uptime()),
    checks: { restaurant, core },
  };

  // Modo estricto: es el que usa el monitoreo para decidir si hay incidente.
  const code = strict && !dbOk ? 503 : 200;
  return NextResponse.json(body, {
    status: code,
    headers: { "cache-control": "no-store" },
  });
}
