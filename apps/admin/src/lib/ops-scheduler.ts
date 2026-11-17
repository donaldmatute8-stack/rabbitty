/**
 * ── Planificador interno de operaciones ────────────────────────────────────
 *
 * Por qué dentro del proceso: los workflows de GitHub con `schedule` que se
 * agregaron hoy quedaron "active" pero **nunca se dispararon** (0 ejecuciones en
 * horas), mientras los crons viejos sí corren. Un respaldo que "debería correr"
 * no es un respaldo. Aquí no depende de un scheduler externo.
 *
 * Qué hace:
 * - Cada 15 min: invariantes operativos (cobros, outbox, bases, respaldos).
 * - Cada 15 min revisa si el respaldo tiene más de 5.5 h → lo ejecuta.
 *
 * Reglas:
 * - Un solo planificador por proceso (`started`).
 * - Nunca lanza: si algo falla, se registra y el ciclo siguiente reintenta.
 * - Se puede apagar con `OPS_SELF_SCHEDULE=off`.
 * - Arranca diferido (60 s) para no competir con el arranque del servidor.
 */

/**
 * Cadencia adaptativa.
 *
 * En horario de operación el comercio cobra: revisar cada 15 min se justifica.
 * De madrugada no hay cajas abiertas, y cada revisión DESPIERTA el cómputo de
 * Neon (que se suspende a los 5 min de inactividad). Cada despertar cuesta
 * segundos de cómputo; multiplicado por 96 revisiones al día es gasto sin
 * retorno. Con 60 min por la noche se detecta igual una caída, a un cuarto del
 * costo.
 */
const CHECK_EVERY_MS = 15 * 60_000;
const CHECK_EVERY_NIGHT_MS = 60 * 60_000;

function businessHourLocal(): number {
  try {
    return Number(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: process.env.BUSINESS_TZ || "America/Mexico_City",
        hour: "2-digit",
        hour12: false,
      }).format(new Date()),
    );
  } catch {
    return new Date().getUTCHours();
  }
}

function isOperatingHours(): boolean {
  const h = businessHourLocal();
  return h >= 9 && h < 22;
}

function nextDelayMs(): number {
  return isOperatingHours() ? CHECK_EVERY_MS : CHECK_EVERY_NIGHT_MS;
}
const BACKUP_EVERY_HOURS = 6;
const BACKUP_THRESHOLD_HOURS = 5.5;
const START_DELAY_MS = 60_000;


// ─── Watchdog de despliegue ───────────────────────────────────────────────────
const PROJECT_ID = process.env.RAILWAY_PROJECT_ID || "9bd0f11b-264a-4de0-b3d6-e9074a1ee673";
const ENVIRONMENT_ID = process.env.RAILWAY_ENVIRONMENT_ID || "3f8a8916-ff1a-45ca-96db-1964bdbbb559";
const SERVICE_ID = process.env.RAILWAY_SERVICE_ID || "62c62c3a-65ee-4027-9e05-17ed8d8c9693";
const GQL = "https://backboard.railway.app/graphql/v2";

let consecutiveDbCritical = 0;
let rollbackAttempted = false;

/**
 * Railway tiene dos tipos de token y cada uno usa un header distinto:
 *  - account/workspace token → `Authorization: Bearer`
 *  - project token           → `Project-Access-Token`
 * Con el header equivocado la respuesta es "Not Authorized", que parece un
 * problema de permisos y en realidad es de transporte. Se prueban ambos.
 */
async function gql(token: string, query: string) {
  const headers: Array<Record<string, string>> = [
    { Authorization: `Bearer ${token}` },
    { "Project-Access-Token": token },
  ];

  let lastError = "error GraphQL";
  for (const h of headers) {
    const res = await fetch(GQL, {
      method: "POST",
      headers: { ...h, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const json = (await res.json()) as { data?: unknown; errors?: Array<{ message?: string }> };
    if (!json.errors?.length) return json.data as Record<string, unknown>;
    lastError = json.errors[0]?.message ?? lastError;
    if (!/Not Authorized|Unauthorized/i.test(lastError)) break;
  }
  throw new Error(lastError);
}

/** Anota el commit actual en el historial (lo llama el arranque). */
async function recordDeploy(commit: string) {
  if (!commit) return;
  try {
    const { getCoreDb } = await import("@rabbitty/api/db");
    const { sql } = await import("drizzle-orm");
    await getCoreDb().execute(
      sql.raw(
        `insert into "ops_deploy_history" ("commit") values ('${commit.replace(/'/g, "")}')
         on conflict ("commit") do update set "lastSeenAt" = now()`,
      ),
    );
  } catch (e) {
    console.warn("[ops-scheduler] no pude registrar el commit:", e instanceof Error ? e.message : e);
  }
}

/** Commit anterior distinto del actual, según nuestro historial. */
async function previousCommitFromHistory(current: string): Promise<string | null> {
  try {
    const { getCoreDb } = await import("@rabbitty/api/db");
    const { sql } = await import("drizzle-orm");
    const res = (await getCoreDb().execute(
      sql.raw(
        `select "commit" from "ops_deploy_history"
          where "commit" <> '${current.replace(/'/g, "")}'
          order by "firstSeenAt" desc limit 1`,
      ),
    )) as { rows?: Array<{ commit: string }> } | Array<{ commit: string }>;
    const rows = Array.isArray(res) ? res : res.rows ?? [];
    return rows[0]?.commit ?? null;
  } catch {
    return null;
  }
}

/**
 * Si la base lleva DOS revisiones seguidas caída y el despliegue es reciente, el
 * problema es el deploy: se vuelve al commit anterior.
 *
 * Por qué solo con token: revertir sin permiso explícito sería demasiado
 * invasivo. Sin `RAILWAY_ROLLBACK_TOKEN` se deja constancia en el log y el aviso
 * por correo ya trae el comando para hacerlo a mano.
 */
async function maybeRollback(invariants: Array<{ metric: string; status: string }>) {
  const dbDown = invariants.some((i) => i.metric.startsWith("db_") && i.status === "critical");
  consecutiveDbCritical = dbDown ? consecutiveDbCritical + 1 : 0;

  if (consecutiveDbCritical < 2 || rollbackAttempted) return;
  if (process.uptime() > 90 * 60) {
    console.warn("[ops-scheduler] base caída pero el despliegue tiene horas: no se revierte.");
    return;
  }

  const token = process.env.RAILWAY_ROLLBACK_TOKEN;
  if (!token) {
    console.warn(
      "[ops-scheduler] base caída tras un despliegue reciente. Para revertir: " +
        "node scripts/rollback.mjs --service rabbitty-admin --apply " +
        "(o define RAILWAY_ROLLBACK_TOKEN para que sea automático)",
    );
    return;
  }

  rollbackAttempted = true;
  try {
    const current = process.env.RAILWAY_GIT_COMMIT_SHA ?? "";
    const target = await previousCommitFromHistory(current);
    if (!target) {
      console.error("[ops-scheduler] no hay commit anterior en el historial; sin rollback.");
      return;
    }
    console.error(`[ops-scheduler] ROLLBACK automático ${current.slice(0, 7)} → ${target.slice(0, 7)}`);
    await gql(
      token,
      `mutation { serviceInstanceDeploy(serviceId: "${SERVICE_ID}", environmentId: "${ENVIRONMENT_ID}", commitSha: "${target}") }`,
    );
  } catch (e) {
    console.error("[ops-scheduler] rollback falló:", e instanceof Error ? e.message : e);
  }
}


/**
 * Higiene: las solicitudes de cobro del POS caducan, pero si nadie las cierra
 * quedan en APPROVED y la app del Rabbitter sigue mostrando "esperando cobro".
 * El estado real (vencida) lo valida el servidor al cobrar; esto solo limpia.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function expireStaleChargeRequests(restaurantDb: { execute: (q: any) => Promise<unknown> }) {
  try {
    const { sql } = await import("drizzle-orm");
    await restaurantDb.execute(
      sql.raw(
        `update "pos_charge_requests"
            set "status" = 'EXPIRED', "updatedAt" = now()
          where "status" in ('PENDING','APPROVED') and "expiresAt" < now()`,
      ),
    );
  } catch (e) {
    console.warn("[ops-scheduler] no pude expirar solicitudes de cobro:", e instanceof Error ? e.message : e);
  }
}


/**
 * ── Drenar la cola de notificaciones ────────────────────────────────────────
 * El worker vive en el miniapp y lo dispara un cron de GitHub que, como los
 * demás workflows nuevos, no se ejecuta (última corrida a las 16:37 con la cola
 * llena). Resultado: los avisos ("recibiste Bunz", cuentas, aprobaciones) se
 * quedaban en QUEUED y el comensal no veía nada.
 *
 * Aquí se empuja el worker solo cuando hay algo atascado más de 2 minutos, así
 * que no genera tráfico si la cola está vacía.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function drainNotifications(coreDb: { execute: (q: any) => Promise<unknown> }) {
  try {
    const { sql } = await import("drizzle-orm");
    const res = (await coreDb.execute(
      sql.raw(
        `select count(*)::int as n from "notifications_outbox"
          where "status" = 'QUEUED' and "runAfter" < now() - interval '2 minutes'`,
      ),
    )) as { rows?: Array<{ n: number }> } | Array<{ n: number }>;
    const rows = Array.isArray(res) ? res : res.rows ?? [];
    const backlog = Number(rows[0]?.n ?? 0);
    if (backlog === 0) return;

    const base = process.env.RABBITTY_MINIAPP_URL;
    const secret = process.env.CRON_SECRET || process.env.RABBITTY_API_SECRET;
    if (!base || !secret) return;

    const r = await fetch(`${base.replace(/\/$/, "")}/api/cron/notifications-worker?limit=40`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    console.log(`[ops-scheduler] cola de notificaciones: ${backlog} atascadas · worker ${r.status}`);
  } catch (e) {
    console.warn("[ops-scheduler] no pude drenar notificaciones:", e instanceof Error ? e.message : e);
  }
}

let started = false;

export function startOpsScheduler() {
  if (started) return;
  if (process.env.OPS_SELF_SCHEDULE === "off") {
    console.log("[ops-scheduler] desactivado por OPS_SELF_SCHEDULE=off");
    return;
  }
  started = true;
  console.log(
    "[ops-scheduler] activo (cada 15 min en horario de operación, 60 min fuera; respaldo cada ~6 h)",
  );

  // Dejar constancia del commit en el que corremos: es el destino del rollback.
  // SHA COMPLETO: serviceInstanceDeploy no acepta el corto.
  void recordDeploy(process.env.RAILWAY_GIT_COMMIT_SHA ?? "");

  setTimeout(async () => {
    await tick("arranque");
    // Cadena de timeouts (no interval fijo): la espera se recalcula en cada
    // ciclo, así el servicio baja a 1 revisión/hora de madrugada sin reiniciar.
    const loop = async () => {
      const delay = nextDelayMs();
      setTimeout(async () => {
        await tick(`periodico (cada ${Math.round(delay / 60000)} min)`);
        void loop();
      }, delay);
    };
    void loop();
  }, START_DELAY_MS);
}

async function tick(reason: string) {
  try {
    const { getRestaurantDb, getCoreDb } = await import("@rabbitty/api/db");
    const { runOpsHealthCheck, backupAgeHours } = await import("./ops-health");

    const restaurantDb = getRestaurantDb();
    const coreDb = getCoreDb();

    await expireStaleChargeRequests(restaurantDb);
    await drainNotifications(coreDb);

    const health = await runOpsHealthCheck({ restaurantDb, coreDb });
    await maybeRollback(health.invariants);
    console.log(
      `[ops-scheduler] ${reason}: ${health.status}` +
        (health.invariants.length
          ? " · " + health.invariants.map((i) => `${i.metric}=${i.status}`).join(" ")
          : "") +
        (health.alerted.length ? ` · avisado: ${health.alerted.join(",")}` : ""),
    );

    // ── Respaldo ──
    const ageHours = await backupAgeHours();
    if (ageHours === null || ageHours >= BACKUP_THRESHOLD_HOURS) {
      const { runBackup } = await import("./db-backup");
      for (const db of ["restaurant", "core"] as const) {
        const r = await runBackup(db);
        console.log(
          `[ops-scheduler] respaldo ${db}: ${r.ok ? `${r.bytes} bytes en ${r.ms} ms` : `falló: ${r.error}`}`,
        );
      }
    } else {
      console.log(`[ops-scheduler] respaldo al día (${Math.round(ageHours * 10) / 10} h)`);
    }
  } catch (e) {
    console.error("[ops-scheduler] ciclo falló:", e instanceof Error ? e.message : e);
  }
}

export { BACKUP_EVERY_HOURS };
