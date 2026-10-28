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

    return NextResponse.json({
      success: true,
      unreadCount: personalUnread.length,
    });
  } catch (error) {
    console.error("[NOTIFICATIONS_UNREAD_COUNT]", error);
    return NextResponse.json({ success: true, unreadCount: 0 });
  }
}

