/**
 * ── Instrumentación del servidor ───────────────────────────────────────────
 *
 * Se ejecuta una vez al arrancar el proceso. Aquí se enciende el planificador
 * interno de operaciones (invariantes + respaldos), que no depende del
 * scheduler de GitHub.
 *
 * Más adelante este mismo archivo es donde `@sentry/nextjs` registra
 * `onRequestError` (cuando haya DSN).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { startOpsScheduler } = await import("./lib/ops-scheduler");
    startOpsScheduler();
  } catch (e) {
    console.error("[instrumentation] no se pudo arrancar el planificador:", e);
  }
}
