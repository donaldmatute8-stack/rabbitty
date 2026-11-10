import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/serverAuth";

export async function GET(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const targetUserId = caller.id;
    const url = new URL(req.url);
    const scope = url.searchParams.get("scope") || "personal";

    const allRows = await db.query.notifications.findMany({
      where: eq(notifications.userId, targetUserId),
      orderBy: [desc(notifications.createdAt)],
      limit: 80,
    });

    // En la app móvil personal, aislamos las alertas operativas de comanda / POS de restaurantes
    const isCommercialStaffAlert = (n: typeof allRows[number]) => {
      const t = (n.title || "").toLowerCase();
      const m = (n.message || "").toLowerCase();
      return (
        t.includes("nueva comanda") ||
        t.includes("comanda #") ||
        t.includes("pedido en mesa") ||
        m.includes("ordenó") && m.includes("platillo")
      );
    };

    const scopedRows = scope === "business"
      ? allRows.filter(isCommercialStaffAlert)
      : allRows.filter((n) => !isCommercialStaffAlert(n));

    // Dedupe de ofertas flash en la campana: la misma oferta/negocio no se
    // repite si la anterior es de las últimas 24 h (aunque el rate-limit se
    // haya reiniciado o existan filas viejas apiladas).
    const lastOfferAt = new Map<string, number>();
    const rows = scopedRows.filter((n) => {
      if (n.type !== "LOYALTY_OFFER") return true;
      const key = n.route || n.title || n.message;
      const ts = n.createdAt ? new Date(n.createdAt).getTime() : 0;
      const prev = lastOfferAt.get(key);
      if (prev != null && prev - ts < 24 * 60 * 60 * 1000) return false;
      lastOfferAt.set(key, ts);
      return true;
    });

    const unreadCount = rows.filter((r) => !r.isRead).length;

    return NextResponse.json({ success: true, notifications: rows, unreadCount });
  } catch (error) {
    console.error("[NOTIFICATIONS_GET]", error);
    return NextResponse.json({ error: "Error al obtener notificaciones" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Server-to-server: packages/api (miniappClient.sendNotification) usa RABBITTY_API_SECRET
    // y manda el userId objetivo + route en el body.
    const serverSecret = process.env.RABBITTY_API_SECRET;
    const authHeader = req.headers.get("authorization");
    const isServerToServer = !!serverSecret && authHeader === `Bearer ${serverSecret}`;

    const caller = isServerToServer ? null : await getAuthenticatedUser(req);
    if (!caller && !isServerToServer) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await req.json();
    const { title, message, type, route, dedupeKey, data, priority } = body;
    const userId = isServerToServer ? String(body.userId || "") : caller!.id;

    if (!title || !message || (isServerToServer && !userId)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // ── P0: entra al OUTBOX (regla de oro: el request nunca llama a APNs directo).
    // Piggyback: drena hasta 10 eventos sin bloquear la respuesta.
    const { enqueueOutbox, kickWorker } = await import("@/lib/push/outbox");
    const enq = await enqueueOutbox({
      userId,
      type: type || "SYSTEM",
      title,
      message,
      route: route ? String(route) : null,
      data: typeof data === "object" && data ? data : null,
      dedupeKey: typeof dedupeKey === "string" && dedupeKey ? dedupeKey : null,
      priority: priority === "high" || priority === "low" ? priority : "normal",
    });
    kickWorker();

    if (!enq.enqueued) {
      // Duplicado (dedupeKey ya existió): idempótente, respuesta informativa
      return NextResponse.json({ success: true, duplicated: true, id: enq.id });
    }

    return NextResponse.json({ success: true, queued: true, id: enq.id });
  } catch (error) {
    console.error("[NOTIFICATIONS_POST]", error);
    return NextResponse.json({ error: "Error creating notification" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id, all, route } = await req.json();

    if (all) {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.userId, caller.id));
      return NextResponse.json({ success: true, all: true });
    }

    // Auto-lectura al visitar la función: apaga las notificaciones cuya ruta
    // destino ya se abrió (siempre acotado al usuario autenticado).
    if (route && typeof route === "string") {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(and(eq(notifications.userId, caller.id), eq(notifications.route, route)));
      return NextResponse.json({ success: true, route });
    }

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    // Anti-IDOR: solo el dueño puede marcar su notificación.
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, caller.id)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[NOTIFICATIONS_PATCH]", error);
    return NextResponse.json({ error: "Error actualizando notificación" }, { status: 500 });
  }
}

