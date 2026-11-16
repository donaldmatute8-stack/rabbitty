import { AwsClient } from "aws4fetch";
import { sql } from "drizzle-orm";

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
async function backupAgeHours(): Promise<number | null> {
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

export async function collectInvariants({
  restaurantDb,
  coreDb,
}: {
  restaurantDb: Db;
  coreDb: Db;
}): Promise<Invariant[]> {
  const out: Invariant[] = [];

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
