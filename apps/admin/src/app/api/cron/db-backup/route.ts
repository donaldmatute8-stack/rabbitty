import { NextRequest, NextResponse } from "next/server";
import { runBackup, prune, toolVersions, type BackupDb } from "../../../../lib/db-backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * ── /api/cron/db-backup ── respaldo lógico de las bases ─────────────────────
 *
 * `pg_dump` de cada base → bucket S3-compatible (fuera de Neon) → limpieza de
 * lo que excede la retención. El plan Hobby de Neon solo conserva 6 h de
 * historial, así que este respaldo es la red de seguridad real.
 *
 *   GET /api/cron/db-backup?db=all|restaurant|core
 *   Authorization: Bearer CRON_SECRET
 *
 * Devuelve por base: ok, bytes, ms y la clave del objeto. Si el dump sale
 * vacío o sin cabecera PGDMP, se marca `ok:false` y no se sube.
 */
export async function GET(req: NextRequest) {
  if (!CRON_SECRET || req.headers.get("Authorization") !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const search = new URL(req.url).searchParams;

  // Diagnóstico: confirma que el binario existe y que su versión puede leer el
  // servidor (pg_dump aborta si es más viejo que Postgres del servidor).
  if (search.get("check") === "1") {
    return NextResponse.json(await toolVersions());
  }

  const param = search.get("db") || "all";
  const dbs: BackupDb[] =
    param === "all" || param === ""
      ? ["restaurant", "core"]
      : param === "restaurant" || param === "core"
        ? [param]
        : [];

  if (dbs.length === 0) {
    return NextResponse.json({ error: "db debe ser all, restaurant o core" }, { status: 400 });
  }

  const results = [];
  for (const db of dbs) {
    results.push(await runBackup(db));
  }

  const ok = results.every((r) => r.ok);
  return NextResponse.json({ ok, at: new Date().toISOString(), results }, { status: ok ? 200 : 500 });
}

/** Limpieza manual de retención (útil si una corrida falló a medias). */
export async function POST(req: NextRequest) {
  if (!CRON_SECRET || req.headers.get("Authorization") !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const pruned = {
    restaurant: await prune("restaurant").catch(() => 0),
    core: await prune("core").catch(() => 0),
  };
  return NextResponse.json({ ok: true, pruned });
}
