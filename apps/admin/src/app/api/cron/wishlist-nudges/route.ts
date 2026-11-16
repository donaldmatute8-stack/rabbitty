import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, inArray, isNotNull, isNull, lt, ne, sql } from "drizzle-orm";
import { getCoreDb } from "@rabbitty/api/db";
import {
  conversationMembers,
  notificationsOutbox,
  users,
  wishlistGifts,
  wishlistItems,
  wishlistShares,
  wishlists,
} from "@rabbitty/database-core";
import { canSendEngagement } from "@rabbitty/api/services/notificationPacing";
import { getStripeClient } from "@rabbitty/api/services/stripeConnect";

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

    // 1b) Vales de regalo vencidos (60 días sin canjear)
    let giftsExpired = 0;
    try {
      const stale = await coreDb
        .select({
          id: wishlistGifts.id,
          giverId: wishlistGifts.giverId,
          itemId: wishlistGifts.itemId,
          amount: wishlistGifts.amount,
          paymentIntentId: wishlistGifts.providerPaymentIntentId,
          title: wishlistItems.title,
          recipientId: wishlists.userId,
        })
        .from(wishlistGifts)
        .innerJoin(wishlistItems, eq(wishlistItems.id, wishlistGifts.itemId))
        .innerJoin(wishlists, eq(wishlists.id, wishlistItems.wishlistId))
        .where(and(eq(wishlistGifts.status, "PAID"), lt(wishlistGifts.expiresAt, now)))
        .limit(200);

      for (const g of stale) {
        // Reembolso automático al giver (el cargo fue directo a la cuenta del
        // negocio con comisión): se reversa la transferencia y la comisión.
        let refunded = false;
        if (g.paymentIntentId) {
          try {
            const stripe = getStripeClient();
            // La cuenta conectada se resuelve desde el propio payment intent.
            const intent = await stripe.paymentIntents.retrieve(g.paymentIntentId, {
              expand: ["transfer_data.destination"],
            } as never);
            const stripeAccount =
              (intent as unknown as { transfer_data?: { destination?: string } }).transfer_data?.destination ?? undefined;
            await stripe.refunds.create(
              {
                payment_intent: g.paymentIntentId,
                refund_application_fee: true,
                reverse_transfer: true,
                reason: "requested_by_customer",
                metadata: { kind: "WISHLIST_GIFT_EXPIRED", giftId: g.id },
              },
              stripeAccount ? { stripeAccount } : undefined,
            );
            refunded = true;
          } catch (refundErr) {
            console.warn("[WISHLIST_NUDGES] reembolso falló:", refundErr);
          }
        }

        await coreDb
          .update(wishlistGifts)
          .set({ status: refunded ? "REFUNDED" : "EXPIRED", updatedAt: now })
          .where(eq(wishlistGifts.id, g.id));
        giftsExpired += 1;

        // Avisar al giver (dinero devuelto o pendiente de soporte)
        await coreDb
          .insert(notificationsOutbox)
          .values({
            userId: g.giverId,
            type: "WISHLIST_GIFTED",
            title: refunded ? "💸 Te devolvimos tu regalo" : "⚠️ Tu vale de regalo venció",
            message: refunded
              ? `El vale de "${g.title}" no se canjeó en 60 días. Reembolsamos ${Math.round(Number(g.amount))} MXN a tu método de pago.`
              : `El vale de "${g.title}" no se canjeó y no pudimos reembolsarlo automáticamente. Escríbenos a soporte para resolverlo.`,
            route: "/profile/wishlist",
            data: { giftId: g.id, refunded },
            dedupeKey: `wishlist_gift_expired:${g.id}`,
            priority: "high",
          })
          .onConflictDoNothing({ target: notificationsOutbox.dedupeKey });

        // Avisar al destinatario (su vale ya no sirve)
        await coreDb
          .insert(notificationsOutbox)
          .values({
            userId: g.recipientId,
            type: "WISHLIST_GIFTED",
            title: "Tu vale de regalo venció",
            message: `El vale de "${g.title}" no se canjeó a tiempo. Puedes pedirle a la persona que te lo regaló que lo intente de nuevo.`,
            route: "/profile/wishlist",
            data: { giftId: g.id },
            dedupeKey: `wishlist_gift_expired_recipient:${g.id}`,
            priority: "normal",
          })
          .onConflictDoNothing({ target: notificationsOutbox.dedupeKey });
      }
    } catch (giftErr) {
      console.warn("[WISHLIST_NUDGES] vencimiento de vales:", giftErr);
    }

    // 1c) "Ya te alcanza para tu deseo": saldo >= precio × 1.05
    let wishBalanceSent = 0;
    try {
      const candidates = await coreDb
        .select({
          itemId: wishlistItems.id,
          userId: wishlists.userId,
          title: wishlistItems.title,
          price: wishlistItems.priceSnapshot,
          balance: sql<number>`GREATEST(0, COALESCE(${users.totalBunzEarned}, 0) - COALESCE(${users.totalBunzSpent}, 0))`,
          rules: users.pushRules,
        })
        .from(wishlistItems)
        .innerJoin(wishlists, eq(wishlists.id, wishlistItems.wishlistId))
        .innerJoin(users, eq(users.id, wishlists.userId))
        .where(
          and(
            eq(wishlistItems.status, "ACTIVE"),
            isNotNull(wishlistItems.priceSnapshot),
            lt(wishlistItems.createdAt, new Date(Date.now() - 2 * 86_400_000)),
          ),
        )
        .limit(200);

      const week = `${now.getUTCFullYear()}-W${Math.ceil(now.getTime() / 86_400_000 / 7)}`;
      for (const c of candidates) {
        const price = Number(c.price ?? 0);
        if (price <= 0) continue;
        if (Number(c.balance ?? 0) < price * 1.05) continue;
        let optedIn = false;
        try {
          optedIn = JSON.parse(String(c.rules ?? "{}"))?.favoriteAlerts === true;
        } catch { optedIn = false; }
        if (!optedIn) continue;
        if (!(await canSendEngagement(coreDb, c.userId, 24))) continue;

        await coreDb
          .insert(notificationsOutbox)
          .values({
            userId: c.userId,
            type: "WISHLIST_ADDED",
            title: `Ya te alcanza para tu ${c.title}`,
            message: `Tienes ${Math.round(Number(c.balance))} Bunz y tu deseo cuesta ${Math.round(price)}.`,
            route: "/profile/wishlist",
            data: { itemId: c.itemId, kind: "wishlist_balance" },
            dedupeKey: `wishlist_balance:${c.itemId}:${week}`,
            priority: "normal",
          })
          .onConflictDoNothing({ target: notificationsOutbox.dedupeKey });
        wishBalanceSent += 1;
      }
    } catch (balErr) {
      console.warn("[WISHLIST_NUDGES] aviso de saldo:", balErr);
    }

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
      giftsExpired,
      wishBalanceSent,
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
