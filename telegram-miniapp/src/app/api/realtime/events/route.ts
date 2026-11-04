import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { db } from "@/db";
import { notifications, notificationDeliveries } from "@/db/schema";
import { and, eq, gt } from "drizzle-orm";
import { ReadableStream as WebReadableStream } from "stream/web";

/**
 * ── Realtime in-app (P2) ── SSE protegido por sesión de Telegram (headers).
 * Emite notificaciones nuevas del usuario (mismo outbox → el push es sólo el
 * canal de fuera). Latencia ≤3s; termina tras 10min y el cliente reconecta.
 */
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
        const finish = () => {
          if (!closed) { closed = true; try { controller.close(); } catch { /* noop */ } }
        };
        req.signal?.addEventListener?.("abort", finish);

        // ── Fix del loop: el tick releía TODAS las notificaciones > startedAt
        // cada 3s y las reenviaba (el cliente hacía toast infinito y se
        // insertaba una delivery OPENED por cada reenvío). Se lleva memoria de
        // lo ya emitido en ESTA conexión.
        const sentIds = new Set<string>();

        const tick = async () => {
          if (closed) return;
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
              if (sentIds.has(r.id)) continue;
              sentIds.add(r.id);
              controller.enqueue(encoder.encode(`event: notification\ndata: ${JSON.stringify(r)}\n\n`));
              // Registro OPENED si llega por realtime (visibilidad de entrega parcial)
              await db
                .insert(notificationDeliveries)
                .values({ notificationId: r.notificationId, channel: "inApp", status: "OPENED" })
                .catch?.(() => {});
            }
            controller.enqueue(encoder.encode(": ping\n\n"));
          } catch {
            finish();
          }
        };

        void tick();
        const interval = setInterval(() => void tick(), 3000);
        const stopTimer = setTimeout(() => { clearInterval(interval); finish(); }, 10 * 60 * 1000);
        void stopTimer;
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