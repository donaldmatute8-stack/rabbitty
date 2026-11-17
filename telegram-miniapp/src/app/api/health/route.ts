import { NextRequest, NextResponse } from "next/server";
import { sql, type SQLWrapper } from "drizzle-orm";
import { describeError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ── /api/health ── salud de la app del cliente ────────────────────────────
 *
 * Por qué existe: el 17-nov la app quedó sin URL de base en el runtime y todas
 * las queries fallaron con `ECONNREFUSED 127.0.0.1:5432`. El síntoma llegó como
 * "el pedido no se completa" porque nada vigilaba la base desde fuera.
 *
 * Dos modos, igual que en admin:
 * - Normal (200 mientras el proceso responda): sirve para saber si la app está
 *   viva sin castigar reinicios por un hipo de Neon.
 * - `?strict=1` (503 si una base no responde): lo consume el sintético / cron
 *   de invariantes para decidir si hay incidente.
 *
 * Nunca expone datos de negocio ni el mensaje crudo de Postgres (puede revelar
 * tablas/columnas); el detalle queda en el log del servidor.
 *
 * Los módulos de base se importan de forma dinámica a propósito: si falta la
 * configuración, `@/db` lanza al importarse (fail-fast) y este endpoint debe
 * seguir en pie para poder reportarlo como `config_missing`.
 */
type DbHealth = { ok: boolean; ms: number; error?: "db_unreachable" | "config_missing" };

type Probeable = { execute: (query: SQLWrapper | string) => Promise<unknown> };

async function probe(query: () => Promise<unknown>): Promise<DbHealth> {
  const t0 = Date.now();
  try {
    await query();
    return { ok: true, ms: Date.now() - t0 };
  } catch (e) {
    // La causa real (ECONNREFUSED, "database does not exist", auth) vive en el
    // `cause` del error de Drizzle: sin desenvolverla el log sólo dice
    // "Failed query: select 1" y no se sabe qué está mal.
    const detail = describeError(e);
    console.error("[health] base no disponible:", detail);
    // Error de configuración ≠ base caída: se distinguen para no perseguir a
    // Neon cuando en realidad falta una variable de entorno.
    return {
      ok: false,
      ms: Date.now() - t0,
      error: detail.includes("[DB_CONFIG]") ? "config_missing" : "db_unreachable",
    };
  }
}

async function probeModule(load: () => Promise<Probeable>, label: string): Promise<DbHealth> {
  let db: Probeable;
  try {
    db = await load();
  } catch (e) {
    console.error(`[health] configuración de ${label} inválida:`, describeError(e));
    return { ok: false, ms: 0, error: "config_missing" };
  }
  return probe(() => db.execute(sql`select 1`));
}

export async function GET(req: NextRequest) {
  const strict = new URL(req.url).searchParams.get("strict") === "1";

  const [core, restaurant] = await Promise.all([
    probeModule(async () => (await import("@/db")).db, "core"),
    probeModule(async () => (await import("@/db/restaurant")).restaurantDb, "restaurant"),
  ]);

  const dbOk = core.ok && restaurant.ok;
  const body = {
    status: dbOk ? "ok" : "degraded",
    commit:
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
      process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ??
      "dev",
    uptimeSec: Math.round(process.uptime()),
    checks: { core, restaurant },
  };

  return NextResponse.json(body, {
    status: strict && !dbOk ? 503 : 200,
    headers: { "cache-control": "no-store" },
  });
}
