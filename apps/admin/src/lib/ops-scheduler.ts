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

const CHECK_EVERY_MS = 15 * 60_000;
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

async function gql(token: string, query: string) {
  const res = await fetch(GQL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const json = (await res.json()) as { data?: unknown; errors?: Array<{ message?: string }> };
  if (json.errors?.length) throw new Error(json.errors[0]?.message ?? "error GraphQL");
  return json.data as Record<string, unknown>;
}

/** Commit anterior sano (ignora FAILED/CRASHED), o null. */
async function previousGoodCommit(token: string, currentCommit: string): Promise<string | null> {
  const data = (await gql(
    token,
    `query { deployments(first: 10, input: { projectId: "${PROJECT_ID}", environmentId: "${ENVIRONMENT_ID}", serviceId: "${SERVICE_ID}" }) {
       edges { node { status meta } } } }`,
  )) as { deployments?: { edges?: Array<{ node: { status: string; meta: Record<string, unknown> } }> } };

  const edges = data.deployments?.edges ?? [];
  for (const { node } of edges) {
    const commit = String((node.meta?.commitHash as string) ?? "");
    if (!commit || commit.startsWith(currentCommit)) continue;
    if (node.status === "FAILED" || node.status === "CRASHED") continue;
    return commit;
  }
  return null;
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
    const current = (process.env.RAILWAY_GIT_COMMIT_SHA ?? "").slice(0, 7);
    const target = await previousGoodCommit(token, current);
    if (!target) {
      console.error("[ops-scheduler] no encontré commit anterior sano; sin rollback.");
      return;
    }
    console.error(`[ops-scheduler] ROLLBACK automático ${current} → ${target.slice(0, 7)}`);
    await gql(
      token,
      `mutation { serviceInstanceDeploy(serviceId: "${SERVICE_ID}", environmentId: "${ENVIRONMENT_ID}", commitSha: "${target}") }`,
    );
  } catch (e) {
    console.error("[ops-scheduler] rollback falló:", e instanceof Error ? e.message : e);
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
  console.log("[ops-scheduler] activo (invariantes cada 15 min, respaldo cada ~6 h)");

  setTimeout(() => {
    void tick("arranque");
  }, START_DELAY_MS);

  setInterval(() => {
    void tick("periodico");
  }, CHECK_EVERY_MS);
}

async function tick(reason: string) {
  try {
    const { getRestaurantDb, getCoreDb } = await import("@rabbitty/api/db");
    const { runOpsHealthCheck, backupAgeHours } = await import("./ops-health");

    const restaurantDb = getRestaurantDb();
    const coreDb = getCoreDb();

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
