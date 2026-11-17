import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { db } from "@/db";
import { notifications, notificationDeliveries } from "@/db/schema";
import { and, eq, gt } from "drizzle-orm";
import { ReadableStream as WebReadableStream } from "stream/web";

/**
 * ── Realtime in-app (P2) ── SSE protegido por sesión de Telegram (headers).
 * Emite notificaciones nuevas del usuario (mismo outbox → el push es sólo el
 * canal de fuera). Latencia ≤3s; el cliente reconecta solo al cerrar.
 *
 * LÍMITE DE PLATAFORMA: Vercel mata la función a los 300s y eso sale en los
 * logs como "Vercel Runtime Timeout Error: Task timed out after 300 seconds"
 * (17-nov: un rojo más por conexión). Cerramos nosotros a los 4 min, por debajo
 * del límite: `useRealtimeEvents` reabre el stream en bucle, así que el corte
 * es transparente para el usuario y no consume la invocación completa.
 */
const STREAM_MAX_MS = 4 * 60 * 1000;
const POLL_INTERVAL_MS = 3000;

export async function GET(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const userId = caller.id;
    const startedAt = new Date();
    const encoder = new TextEncoder();

    const stream = new WebReadableStream<Uint8Array>({
      start(controller) {
        let closed = false;
        let running = false;
        let interval: ReturnType<typeof setInterval> | undefined;
        let stopTimer: ReturnType<typeof setTimeout> | undefined;

        const cleanup = () => {
          if (interval) clearInterval(interval);
          if (stopTimer) clearTimeout(stopTimer);
          interval = undefined;
          stopTimer = undefined;
        };

        const finish = () => {
          if (closed) return;
          closed = true;
          cleanup();
          try { controller.close(); } catch { /* ya cerrado por la plataforma */ }
        };

        const send = (chunk: string): boolean => {
          if (closed) return false;
          try {
            controller.enqueue(encoder.encode(chunk));
            return true;
          } catch {
            finish();
            return false;
          }
        };

        req.signal?.addEventListener?.("abort", finish);

        // ── Fix del loop: el tick releía TODAS las notificaciones > startedAt
        // cada 3s y las reenviaba (el cliente hacía toast infinito y se
        // insertaba una delivery OPENED por cada reenvío). Se lleva memoria de
        // lo ya emitido en ESTA conexión.
        const sentIds = new Set<string>();

        const tick = async () => {
          if (closed) return;
          // Un tick lento no debe solaparse con el siguiente (doble envío).
          if (running) return;
          running = true;
          try {
            const rows = await db
              .select({
                id: notifications.id,
                title: notifications.title,
                message: notifications.message,
                type: notifications.type,
                route: notifications.route,
                createdAt: notifications.createdAt,
                notificationId: notifications.id,
              })
              .from(notifications)
              .where(and(eq(notifications.userId, userId), gt(notifications.createdAt, startedAt)))
              .limit(20);
            for (const r of rows) {
              if (closed) return;
              if (sentIds.has(r.id)) continue;
              sentIds.add(r.id);
              send(`event: notification\ndata: ${JSON.stringify(r)}\n\n`);
              // Registro OPENED si llega por realtime (visibilidad de entrega parcial)
              try {
                await db
                  .insert(notificationDeliveries)
                  .values({ notificationId: r.notificationId, channel: "inApp", status: "OPENED" });
              } catch { /* la entrega es telemetría: nunca tumba el stream */ }
            }
            send(": ping\n\n");
          } catch {
            finish();
          } finally {
            running = false;
          }
        };

        void tick();
        interval = setInterval(() => void tick(), POLL_INTERVAL_MS);
        stopTimer = setTimeout(finish, STREAM_MAX_MS);
      },
    });

    return new Response(stream as unknown as ReadableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err: unknown) {
    console.error("[REALTIME_EVENTS]", err);
    return NextResponse.json({ error: "No se pudo iniciar el stream" }, { status: 500 });
  }
}
