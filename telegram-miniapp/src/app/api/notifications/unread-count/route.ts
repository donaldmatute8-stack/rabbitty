import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/serverAuth";

export async function GET(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ success: true, unreadCount: 0 });
    }

    const rows = await db.query.notifications.findMany({
      where: and(
        eq(notifications.userId, caller.id),
        eq(notifications.isRead, false)
      ),
      columns: {
        id: true,
        title: true,
        message: true,
        type: true,
        route: true,
        createdAt: true,
      },
      limit: 100,
    });

    // Excluir alertas operativas de comandas para el conteo de la app móvil personal
    const personalUnread = rows.filter((n) => {
      const t = (n.title || "").toLowerCase();
      const m = (n.message || "").toLowerCase();
      return !(
        t.includes("nueva comanda") ||
        t.includes("comanda #") ||
        t.includes("pedido en mesa") ||
        (m.includes("ordenó") && m.includes("platillo"))
      );
    });

    // Mismo dedupe que el panel: una oferta flash por negocio/24 h.
    const lastOfferAt = new Map<string, number>();
    const deduped = personalUnread.filter((n) => {
      if (n.type !== "LOYALTY_OFFER") return true;
      const key = n.route || n.title || n.message;
      const ts = n.createdAt ? new Date(n.createdAt).getTime() : 0;
      const prev = lastOfferAt.get(key);
      if (prev != null && prev - ts < 24 * 60 * 60 * 1000) return false;
      lastOfferAt.set(key, ts);
      return true;
    });

    return NextResponse.json({
      success: true,
      unreadCount: deduped.length,
    });
  } catch (error) {
    console.error("[NOTIFICATIONS_UNREAD_COUNT]", error);
    return NextResponse.json({ success: true, unreadCount: 0 });
  }
}

