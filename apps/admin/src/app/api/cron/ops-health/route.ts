import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getRestaurantDb, getCoreDb } from "@rabbitty/api/db";
import {
  collectInvariants,
  sendOpsEmail,
  OPS_REMINDER_MS,
  type Invariant,
} from "../../../../lib/ops-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * ── /api/cron/ops-health ── invariantes operativos ─────────────────────────
 *
 * Corre cada 15 min (GitHub Actions). Guarda una foto de cada invariante y avisa
 * solo cuando el estado CAMBIA, o cada 6 h si sigue roto. Así un problema
 * persistente no genera 96 correos al día.
 *
 *   GET /api/cron/ops-health
 *   Authorization: Bearer CRON_SECRET
 *
 * Devuelve el estado actual de cada invariante. Si algo está en `critical`
 * responde 200 igual: el fallo del *monitoreo* no debe parecer un fallo del
 * negocio. Lo que se vigila es el contenido, no el código HTTP.
 */
export async function GET(req: NextRequest) {
  if (!CRON_SECRET || req.headers.get("Authorization") !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const restaurantDb = getRestaurantDb();
  const coreDb = getCoreDb();

  const invariants = await collectInvariants({ restaurantDb, coreDb });

  // ── Persistir la foto ──
  const values = invariants
    .map(
      (i) =>
        `('${randomUUID()}','${i.metric.replace(/'/g, "")}',${i.value ?? "null"},'${i.status}','${(i.detail ?? "").replace(/'/g, " ").slice(0, 300)}')`,
    )
    .join(",");
  if (values) {
    await coreDb
      .execute(
        sql.raw(
          `insert into "ops_health_snapshots" ("id","metric","value","status","detail") values ${values}`,
        ),
      )
      .catch((e: unknown) => console.error("[ops-health] no se pudo guardar snapshot:", e));
  }

  // ── Estado previo (para dedupe) ──
  const prevRes = (await coreDb
    .execute(sql.raw(`select "metric","status","lastAlertAt" from "ops_alert_state"`))
    .catch(() => ({ rows: [] }))) as { rows?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>;
  const prevRows = Array.isArray(prevRes) ? prevRes : prevRes.rows ?? [];
  const prev = new Map(
    prevRows.map((r) => [
      String(r.metric),
      { status: String(r.status), lastAlertAt: r.lastAlertAt ? new Date(String(r.lastAlertAt)) : null },
    ]),
  );

  const toAlert: Invariant[] = [];
  const now = Date.now();

  for (const inv of invariants) {
    const before = prev.get(inv.metric);
    const changed = before?.status !== inv.status;
    const stillBroken =
      inv.status !== "ok" &&
      (!before?.lastAlertAt || now - before.lastAlertAt.getTime() > OPS_REMINDER_MS);
    if (inv.status !== "ok" && (changed || stillBroken)) toAlert.push(inv);

    const lastAlertAt =
      inv.status !== "ok" && (changed || stillBroken) ? new Date() : before?.lastAlertAt ?? null;

    await coreDb
      .execute(
        sql.raw(
          `insert into "ops_alert_state" ("metric","status","lastAlertAt","lastOkAt","detail")
           values ('${inv.metric}','${inv.status}',` +
            `${lastAlertAt ? `'${lastAlertAt.toISOString()}'` : "null"},` +
            `${inv.status === "ok" ? "now()" : "null"},'${(inv.detail ?? "").replace(/'/g, " ").slice(0, 300)}')
           on conflict ("metric") do update set
             "status" = excluded."status",
             "lastAlertAt" = excluded."lastAlertAt",
             "lastOkAt" = excluded."lastOkAt",
             "detail" = excluded."detail"`,
        ),
      )
      .catch((e: unknown) => console.error("[ops-health] no se pudo guardar estado:", e));
  }

  // ── Aviso por correo ──
  let emailed = false;
  if (toAlert.length > 0) {
    const critical = toAlert.filter((i) => i.status === "critical");
    const subject = `${critical.length > 0 ? "🔴" : "🟠"} Rabbitty ops: ${toAlert.map((i) => i.metric).join(", ")}`;
    const rows = toAlert
      .map(
        (i) =>
          `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee"><b>${i.metric}</b></td>
           <td style="padding:6px 10px;border-bottom:1px solid #eee;color:${i.status === "critical" ? "#b91c1c" : "#b45309"}">${i.status}</td>
           <td style="padding:6px 10px;border-bottom:1px solid #eee">${i.detail ?? ""}</td></tr>`,
      )
      .join("");
    emailed = await sendOpsEmail(
      subject,
      `<div style="font-family:system-ui,sans-serif">
         <h2 style="margin:0 0 4px">Invariantes operativos</h2>
         <p style="color:#555;margin:0 0 12px">${new Date().toISOString()}</p>
         <table style="border-collapse:collapse;font-size:13px">${rows}</table>
         <p style="color:#777;font-size:12px;margin-top:14px">
           Revisa /api/health?strict=1 y el panel de Railway. Si el problema sigue, se reenviará cada 6 h.
         </p>
       </div>`,
    );
  }

  return NextResponse.json({
    ok: true,
    checkedAt: new Date().toISOString(),
    status: invariants.some((i) => i.status === "critical")
      ? "critical"
      : invariants.some((i) => i.status === "warn")
        ? "warn"
        : "ok",
    invariants,
    alerted: toAlert.map((i) => i.metric),
    emailed,
  });
}
