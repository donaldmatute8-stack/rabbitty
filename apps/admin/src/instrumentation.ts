/**
 * ── Bunzy Connect · scheduler en proceso ────────────────────────────────
 *
 * Los schedules de GitHub Actions de este repo se disparan cada ~8 horas
 * (verificado en 3 workflows), así que un envío programado salía horas tarde.
 * En vez de depender de un cron externo, el propio servidor del admin hace el
 * tick cada minuto: los programados salen a su hora (±1 min) y la cola se
 * drena sola.
 *
 * Seguridad:
 *  - Solo corre en producción (nunca desde `next dev`, que apunta a la DB real).
 *  - `NEXT_RUNTIME` debe ser nodejs (no edge).
 *  - `BUNZY_SCHEDULER_DISABLED=1` lo apaga sin redeploy de código.
 *  - Todo es idempotente: delivery único por (broadcast, destinatario) y
 *    requestKey por serie.
 */

const TICK_MS = 60_000;

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.BUNZY_SCHEDULER_DISABLED === "1") return;

  const { getCoreDb } = await import("@rabbitty/api/db");
  const { publishScheduledBroadcasts, processBunzySeries, processBunzyQueue } = await import(
    "@rabbitty/api/services/bunzyConnect"
  );

  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const db = getCoreDb();
      const scheduled = await publishScheduledBroadcasts(db);
      const series = await processBunzySeries(db);
      const queue = await processBunzyQueue(db);
      if (scheduled.due > 0 || series.due > 0 || queue.processed > 0) {
        console.log(
          `[bunzy-scheduler] programados=${scheduled.due} series=${series.due} cola=${queue.processed}`,
        );
      }
    } catch (error) {
      console.error("[bunzy-scheduler] tick falló:", error);
    } finally {
      running = false;
    }
  };

  // Primer tick al arrancar: recupera lo que venció mientras el servicio estuvo caído.
  void tick();
  const timer = setInterval(() => void tick(), TICK_MS);
  // No mantener vivo el proceso por el timer.
  (timer as unknown as { unref?: () => void }).unref?.();
  console.log("[bunzy-scheduler] activo (cada 60s)");
}
