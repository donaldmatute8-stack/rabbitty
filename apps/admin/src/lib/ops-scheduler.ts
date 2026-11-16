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
