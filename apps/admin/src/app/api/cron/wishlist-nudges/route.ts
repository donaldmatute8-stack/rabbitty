import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, inArray, isNotNull, isNull, lt, ne, sql } from "drizzle-orm";
import { getCoreDb } from "@rabbitty/api/db";
import {
  conversationMembers,
  notificationsOutbox,
  users,
  wishlistItems,
  wishlistShares,
  wishlists,
} from "@rabbitty/database-core";
import { canSendEngagement } from "@rabbitty/api/services/notificationPacing";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * ── /api/cron/wishlist-nudges ── cumpleaños, caducidad y "actualiza tu lista"
 *
 * 1) Caduca los deseos con más de 90 días (status EXPIRED).
 * 2) 7 días antes del cumpleaños (si la lista está compartida) avisa al grupo
 *    con sus top 3 deseos. Dedupe por día.
 * 3) Si una lista lleva 60+ días sin tocarse, recuerda al dueño actualizarla
 *    (dedupe trimestral).
 *
 * Todo pasa por el ritmo de engagement (1 aviso al día por usuario).
 */

const BIRTHDAY_WINDOW_DAYS = 7;
const REFRESH_AFTER_DAYS = 60;

function authorize(req: NextRequest): boolean {
  const auth = (req.headers.get("authorization") || "").replace(/^Bearer /, "").trim();
  return Boolean(CRON_SECRET && auth === CRON_SECRET);
}

function daysUntilBirthday(birthdayAt: Date): number {
  const now = new Date();
  const next = new Date(now.getFullYear(), birthdayAt.getMonth(), birthdayAt.getDate());
  if (next.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) {
    next.setFullYear(now.getFullYear() + 1);
  }
  return Math.round((next.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86_400_000);
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  try {
    const coreDb = getCoreDb();
    const now = new Date();

    // 1) Caducidad
    const expired = await coreDb
      .update(wishlistItems)
      .set({ status: "EXPIRED", updatedAt: now })
      .where(and(eq(wishlistItems.status, "ACTIVE"), lt(wishlistItems.expiresAt, now)))
      .returning({ id: wishlistItems.id });

    let birthdaysSent = 0;
    let refreshSent = 0;

    // 2) Cumpleaños: avisar al grupo
    const birthdayLists = await coreDb
      .select({
        id: wishlists.id,
        userId: wishlists.userId,
        birthdayAt: wishlists.birthdayAt,
      })
      .from(wishlists)
      .where(and(isNotNull(wishlists.birthdayAt), eq(wishlists.isActive, true)));

    const today = now.toISOString().slice(0, 10);

    for (const list of birthdayLists) {
      if (!list.birthdayAt) continue;
      const days = daysUntilBirthday(new Date(list.birthdayAt));
      if (days < 0 || days > BIRTHDAY_WINDOW_DAYS) continue;

      const shares = await coreDb
        .select({ groupId: wishlistShares.groupId })
        .from(wishlistShares)
        .where(eq(wishlistShares.wishlistId, list.id));
      if (shares.length === 0) continue;

      const items = await coreDb
        .select({ title: wishlistItems.title })
        .from(wishlistItems)
        .where(and(eq(wishlistItems.wishlistId, list.id), eq(wishlistItems.status, "ACTIVE")))
        .limit(3);
      if (items.length === 0) continue;

      const [owner] = await coreDb
        .select({ firstName: users.firstName, username: users.username })
        .from(users)
        .where(eq(users.id, list.userId))
        .limit(1);
      const ownerName = owner?.firstName || owner?.username || "Alguien";

      const members = await coreDb
        .select({ userId: conversationMembers.userId })
        .from(conversationMembers)
        .where(
          and(
            inArray(conversationMembers.conversationId, shares.map((s) => s.groupId)),
            isNull(conversationMembers.leftAt),
            ne(conversationMembers.userId, list.userId),
          ),
        )
        .limit(200);

      const topThree = items.map((i) => i.title).join(", ");
      for (const m of members) {
        if (!(await canSendEngagement(coreDb, m.userId, 24))) continue;
        await coreDb
          .insert(notificationsOutbox)
          .values({
            userId: m.userId,
            type: "WISHLIST_BIRTHDAY",
            title: `🎂 Se acerca el cumple de ${ownerName}`,
            message:
              days === 0
                ? `Hoy cumple ${ownerName}. Su lista tiene: ${topThree}.`
                : `En ${days} día${days === 1 ? "" : "s"} cumple ${ownerName}. Su lista tiene: ${topThree}.`,
            route: "/profile/wishlist?tab=circle",
            data: { wishlistId: list.id, days },
            dedupeKey: `wishlist_birthday:${list.id}:${today}`,
            priority: "normal",
          })
          .onConflictDoNothing({ target: notificationsOutbox.dedupeKey });
        birthdaysSent += 1;
      }
    }

    // 3) Recordatorio de actualización (lista vieja)
    const staleCutoff = new Date(Date.now() - REFRESH_AFTER_DAYS * 86_400_000);
    const staleLists = await coreDb
      .select({ id: wishlists.id, userId: wishlists.userId })
      .from(wishlists)
      .where(and(eq(wishlists.isActive, true), lt(wishlists.updatedAt, staleCutoff)));

    const quarter = `${now.getUTCFullYear()}-Q${Math.floor(now.getUTCMonth() / 3) + 1}`;

    for (const list of staleLists) {
      const [activeCount] = await coreDb
        .select({ count: sql<number>`count(*)::int` })
        .from(wishlistItems)
        .where(and(eq(wishlistItems.wishlistId, list.id), eq(wishlistItems.status, "ACTIVE")));
      if (Number(activeCount?.count ?? 0) === 0) continue;
      if (!(await canSendEngagement(coreDb, list.userId, 24))) continue;

      await coreDb
        .insert(notificationsOutbox)
        .values({
          userId: list.userId,
          type: "WISHLIST_ADDED",
          title: "¿Tu lista sigue vigente?",
          message: "Los deseos caducan a los 90 días. Revisa tu lista y quita lo que ya conseguiste.",
          route: "/profile/wishlist",
          data: { kind: "wishlist_refresh" },
          dedupeKey: `wishlist_refresh:${list.id}:${quarter}`,
          priority: "normal",
        })
        .onConflictDoNothing({ target: notificationsOutbox.dedupeKey });
      refreshSent += 1;
    }

    return NextResponse.json({
      success: true,
      expired: expired.length,
      birthdaysSent,
      refreshSent,
    });
  } catch (error) {
    console.error("[WISHLIST_NUDGES]", error);
    return NextResponse.json({ success: false, error: "No se pudieron procesar los deseos" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  return NextResponse.json({ success: true, hint: "POST para procesar cumpleaños y caducidad" });
}
