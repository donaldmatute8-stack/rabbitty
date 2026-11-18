import { AwsClient } from "aws4fetch";
import { sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

/**
 * ── Invariantes operativos ("¿el negocio se está moviendo?") ────────────────
 *
 * Sin Sentry, esta es la capa que avisa ANTES que el comercio. No mide "¿el
 * sitio responde?" (eso lo ve cualquiera) sino cosas que solo pueden fallar si
 * algo se rompió: cero cobros con caja abierta, respaldos que dejaron de correr,
 * outbox atascado.
 *
 * Reglas de diseño:
 * - Un invariante tiene 3 estados: ok / warn / critical.
 * - Solo se avisa cuando el estado CAMBIA (o cada 6 h si sigue roto). Sin esto,
 *   un cron cada 15 min genera 96 correos al día y nadie los lee.
 * - Todo se guarda en `ops_health_snapshots` (histórico) y `ops_alert_state`
 *   (estado actual). La alerta por correo es best-effort: si falla el envío, el
 *   registro queda igual y el cron no se cae.
 */

export type InvariantStatus = "ok" | "warn" | "critical";

export type Invariant = {
  metric: string;
  value: number | null;
  status: InvariantStatus;
  detail?: string;
};

/** Cualquier cliente Drizzle con `execute` (postgres-js en este proyecto). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { execute: (query: any) => Promise<unknown> };

const MINUTE = 60_000;

/** Hora local del negocio (mismo criterio que el resto de los reportes). */
function businessHour(tz = process.env.BUSINESS_TZ || "America/Mexico_City"): number {
  try {
    return Number(
      new Intl.DateTimeFormat("en-CA", { timeZone: tz, hour: "2-digit", hour12: false }).format(new Date()),
    );
  } catch {
    return new Date().getUTCHours();
  }
}

/** ¿Estamos en horario en que debería haber movimiento? 09:00–22:00 local. */
function inBusinessHours() {
  const h = businessHour();
  return h >= 9 && h < 22;
}

async function scalar(db: Db, query: unknown): Promise<number> {
  const res = (await db.execute(query)) as { rows?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>;
  const rows = Array.isArray(res) ? res : res.rows ?? [];
  const first = rows[0] ?? {};
  const value = Object.values(first)[0];
  return Number(value ?? 0);
}

/**
 * Último respaldo en el bucket: si el cron de respaldos deja de correr, esto lo
 * delata aunque GitHub Actions no avise.
 */
export async function backupAgeHours(): Promise<number | null> {
  const endpoint = process.env.BACKUP_S3_ENDPOINT;
  const bucket = process.env.BACKUP_S3_BUCKET;
  const accessKeyId = process.env.BACKUP_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.BACKUP_S3_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;

  try {
    const aws = new AwsClient({
      accessKeyId,
      secretAccessKey,
      region: process.env.BACKUP_S3_REGION || "auto",
      service: "s3",
    });
    const host = new URL(endpoint).host;
    const url = `https://${bucket}.${host}/?list-type=2&prefix=${encodeURIComponent("db/restaurant/6h/")}&max-keys=5`;
    const res = await aws.fetch(url);
    if (!res.ok) return null;
    const xml = await res.text();
    const stamps = [...xml.matchAll(/<LastModified>([\s\S]*?)<\/LastModified>/g)].map((m) => new Date(m[1]).getTime());
    if (stamps.length === 0) return null;
    const newest = Math.max(...stamps);
    return (Date.now() - newest) / 3_600_000;
  } catch {
    return null;
  }
}

/**
 * ── App del cliente: ¿su configuración está completa? ──
 *
 * Nació del incidente del 17-nov-2026: el runtime de Vercel se quedó sin URL de
 * base para el lado restaurante y el pedido del cliente falló durante horas sin
 * que nada avisara. Admin no podía detectarlo porque *su* conexión estaba bien.
 *
 * Se consulta `/api/health?config=1`, que sólo comprueba que las variables
 * resuelvan: **cero queries**, así que el chequeo no despierta ni consume la
 * base. Dos intentos separados para no gritar por el 503 típico de un deploy.
 */
export async function clientAppConfigInvariant(): Promise<Invariant> {
  const url = process.env.APP_HEALTH_URL || "https://app.rabbitty.me/api/health?config=1";
  const metric = "app_cliente_config";
  let lastDetail = "sin respuesta";

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1500));
    const t0 = Date.now();
    try {
      const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(6000) });
      const body = (await res.json().catch(() => null)) as
        | { status?: string; checks?: Record<string, { error?: string }> }
        | null;
      const ms = Date.now() - t0;
      const broken = Object.entries(body?.checks ?? {})
        .filter(([, c]) => c?.error)
        .map(([name, c]) => `${name}:${c.error}`);

      if (res.ok && body?.status === "ok") {
        return { metric, value: ms, status: ms > 2500 ? "warn" : "ok", detail: `${ms} ms` };
      }
      lastDetail = broken.length > 0 ? broken.join(", ") : `HTTP ${res.status}`;
    } catch (e) {
      lastDetail = e instanceof Error ? e.message.slice(0, 160) : "error de red";
    }
  }

  return { metric, value: null, status: "critical", detail: lastDetail };
}

export async function collectInvariants({
  restaurantDb,
  coreDb,
}: {
  restaurantDb: Db;
  coreDb: Db;
}): Promise<Invariant[]> {
  const out: Invariant[] = [];

  // ── 0. Configuración de la app del cliente (Vercel) ──
  // Se consulta el endpoint en modo `config`: valida que las variables de
  // entorno resuelvan sin ejecutar ni una query, así que vigilar la app no
  // añade tráfico a la base. Corre dentro del mismo invariante de cada 15 min
  // (ops-scheduler), sin cron nuevo.
  out.push(await clientAppConfigInvariant());

  // ── 0b. Tienda: productos publicados que se quedaron sin existencias ──
  // Las existencias no se guardan en el producto: se derivan de la receta contra
  // `inventory_items` (misma fuente que descuenta el POS y la app). Se avisa sólo
  // cuando hay algo publicado y agotado; si se agotó TODO, es crítico.
  try {
    const res = (await restaurantDb.execute(sql.raw(`
      WITH RECURSIVE req AS (
        SELECT mi."menuItemId" AS root_id, mi."inventoryItemId" AS inv_id,
               mi."subRecipeId" AS sub_id, mi."quantityRequired"::numeric AS qty, 0 AS depth
        FROM "menu_item_ingredients" mi
        JOIN "menu_items" p ON p.id = mi."menuItemId"
        WHERE p."kind" = 'PRODUCT' AND p."isAvailable" = true AND p."isActive" = true
        UNION ALL
        SELECT r.root_id, mi."inventoryItemId", mi."subRecipeId",
               (r.qty * mi."quantityRequired")::numeric, r.depth + 1
        FROM req r
        JOIN "menu_item_ingredients" mi ON mi."menuItemId" = r.sub_id
        WHERE r.sub_id IS NOT NULL AND r.depth < 6
      ),
      stock AS (
        SELECT r.root_id, MIN(FLOOR(ii.stock / NULLIF(r.qty, 0))) AS disponible
        FROM req r JOIN "inventory_items" ii ON ii.id = r.inv_id
        WHERE r.inv_id IS NOT NULL AND r.qty > 0
        GROUP BY r.root_id
      )
      SELECT
        (SELECT COUNT(*)::int FROM "menu_items" WHERE "kind" = 'PRODUCT' AND "isAvailable" = true AND "isActive" = true) AS publicados,
        (SELECT COUNT(*)::int FROM stock WHERE disponible <= 0) AS agotados
    `))) as { rows?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>;
    const row = (Array.isArray(res) ? res : res.rows ?? [])[0] ?? {};
    const publicados = Number(row.publicados ?? 0);
    const agotados = Number(row.agotados ?? 0);
    if (publicados > 0) {
      out.push({
        metric: "tienda_agotados",
        value: agotados,
        status: agotados === 0 ? "ok" : agotados >= publicados ? "critical" : "warn",
        detail:
          agotados === 0
            ? `${publicados} publicados`
            : `${agotados} de ${publicados} publicados sin existencias`,
      });
    }
  } catch (e) {
    // Si la tabla aún no existe (migración pendiente) no se rompe el chequeo.
    out.push({
      metric: "tienda_agotados",
      value: null,
      status: "warn",
      detail: e instanceof Error ? e.message.slice(0, 120) : "sin datos",
    });
  }

  // ── 1. Base de datos alcanzable ──
  for (const [name, db] of [
    ["db_restaurant", restaurantDb],
    ["db_core", coreDb],
  ] as const) {
    const t0 = Date.now();
    try {
      await db.execute(sql.raw("select 1"));
      const ms = Date.now() - t0;
      out.push({
        metric: name,
        value: ms,
        status: ms > 500 ? "warn" : "ok",
        detail: `${ms} ms`,
      });
    } catch (e) {
      out.push({
        metric: name,
        value: null,
        status: "critical",
        detail: e instanceof Error ? e.message.slice(0, 200) : "sin conexión",
      });
    }
  }

  // ── 2. Turnos de caja abiertos (y turnos olvidados) ──
  const openShifts = await scalar(
    restaurantDb,
    sql.raw(`select count(*)::int from "cash_shifts" where "status" = 'OPEN'`),
  );
  // Un turno abierto desde hace días es basura de datos, no una caída: se avisa
  // como warn para que alguien lo cierre, sin gritar.
  const staleShifts = await scalar(
    restaurantDb,
    sql.raw(
      `select count(*)::int from "cash_shifts"
        where "status" = 'OPEN' and "openedAt" < now() - interval '24 hours'`,
    ),
  );
  out.push({
    metric: "open_cash_shifts",
    value: openShifts,
    status: "ok",
    detail: `${openShifts} turno(s) abiertos · ${staleShifts} con más de 24 h`,
  });
  out.push({
    metric: "stale_cash_shifts",
    value: staleShifts,
    status: staleShifts > 0 ? "warn" : "ok",
    detail: staleShifts > 0 ? `${staleShifts} turno(s) abiertos hace más de un día` : "ninguno",
  });

  // ── 3. Movimiento de ventas ──
  //
  // Un café puede pasar una hora sin cobrar y estar perfectamente sano (hubo
  // ventas hace 90 min y la siguiente llega). Lo que NO es normal es tres horas
  // sin un solo cobro con la caja abierta en horario de operación.
  const payments1h = await scalar(
    restaurantDb,
    sql.raw(`select count(*)::int from "payments" where "createdAt" > now() - interval '60 minutes'`),
  );
  const payments3h = await scalar(
    restaurantDb,
    sql.raw(`select count(*)::int from "payments" where "createdAt" > now() - interval '180 minutes'`),
  );
  const orders1h = await scalar(
    restaurantDb,
    sql.raw(`select count(*)::int from "orders" where "createdAt" > now() - interval '60 minutes'`),
  );

  const business = inBusinessHours();
  let salesStatus: InvariantStatus = "ok";
  let salesDetail = `${payments1h} cobros en 60 min · ${payments3h} en 3 h · ${orders1h} órdenes en 60 min`;

  if (payments3h === 0 && business && openShifts > 0) {
    salesStatus = "critical";
    salesDetail = `caja abierta y 0 cobros en 3 horas (horario de operación)`;
  } else if (payments3h === 0 && business) {
    salesStatus = "warn";
    salesDetail = `sin cobros en 3 horas en horario de operación, sin caja abierta`;
  }

  out.push({ metric: "sales_recent", value: payments3h, status: salesStatus, detail: salesDetail });

  // ── 4. Outbox de notificaciones atascado ──
  const backlog = await scalar(
    coreDb,
    sql.raw(`select count(*)::int from "notifications_outbox" where "status" = 'QUEUED'`),
  );
  const oldestMinutes = await scalar(
    coreDb,
    sql.raw(
      `select COALESCE(EXTRACT(EPOCH FROM (now() - min("runAfter")))/60, 0)::int
         from "notifications_outbox" where "status" = 'QUEUED'`,
    ),
  );
  out.push({
    metric: "notifications_backlog",
    value: backlog,
    status: backlog > 500 || oldestMinutes > 120 ? "warn" : "ok",
    detail: `${backlog} en cola · la más vieja hace ${oldestMinutes} min`,
  });

  // ── 5. Frescura del respaldo ──
  const hours = await backupAgeHours();
  if (hours != null) {
    out.push({
      metric: "backup_age_hours",
      value: Math.round(hours * 10) / 10,
      status: hours > 12 ? "critical" : hours > 8 ? "warn" : "ok",
      detail: `último respaldo hace ${Math.round(hours * 10) / 10} h`,
    });
  }

  return out;
}

/** Envía el aviso por correo (Resend). Best-effort: nunca rompe la corrida. */
export async function sendOpsEmail(subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.OPS_ALERT_EMAIL;
  if (!key || !to) {
    console.warn("[ops-health] sin RESEND_API_KEY u OPS_ALERT_EMAIL: solo se registra");
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Rabbitty Ops <hola@rabbitty.me>",
        to: [to],
        subject,
        html,
      }),
    });
    return res.ok;
  } catch (e) {
    console.error("[ops-health] fallo enviando correo:", e);
    return false;
  }
}

export const OPS_REMINDER_MS = 6 * 60 * MINUTE;

/**
 * Ejecuta la revisión completa: recolecta, guarda foto, aplica dedupe y avisa.
 * Vive aquí (y no en la ruta) para que el planificador interno y el endpoint
 * de cron hagan EXACTAMENTE lo mismo.
 */
export async function runOpsHealthCheck({
  restaurantDb,
  coreDb,
}: {
  restaurantDb: Db;
  coreDb: Db;
}): Promise<{
  status: InvariantStatus;
  invariants: Invariant[];
  alerted: string[];
  emailed: boolean;
}> {
  const invariants = await collectInvariants({ restaurantDb, coreDb });

  const esc = (v: string) => v.replace(/'/g, " ").slice(0, 300);
  const values = invariants
    .map(
      (i) =>
        `('${randomUUID()}','${i.metric}',${i.value ?? "null"},'${i.status}','${esc(i.detail ?? "")}')`,
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
            `${inv.status === "ok" ? "now()" : "null"},'${esc(inv.detail ?? "")}')
           on conflict ("metric") do update set
             "status" = excluded."status",
             "lastAlertAt" = excluded."lastAlertAt",
             "lastOkAt" = excluded."lastOkAt",
             "detail" = excluded."detail"`,
        ),
      )
      .catch((e: unknown) => console.error("[ops-health] no se pudo guardar estado:", e));
  }

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

  return {
    status: invariants.some((i) => i.status === "critical")
      ? "critical"
      : invariants.some((i) => i.status === "warn")
        ? "warn"
        : "ok",
    invariants,
    alerted: toAlert.map((i) => i.metric),
    emailed,
  };
}
