/**
 * ── Regalar un deseo (vale prepagado) ───────────────────────────────────────
 *
 * Cobra al giver en la cuenta Stripe Connect del negocio (comisión 8 % de
 * plataforma) y, cuando el webhook confirma el pago, genera un **código de
 * vale** que el destinatario canjea en caja.
 *
 * Solo se puede regalar un deseo compartido con un grupo al que perteneces.
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/db';
import {
  conversationMembers,
  wishlistGifts,
  wishlistItems,
  wishlistShares,
  wishlists,
} from '@/db/schema';
import { branches, restaurants, merchantPaymentAccounts } from '@rabbitty/database-restaurant/schema';
import { getAuthenticatedUser } from '@/lib/serverAuth';

export const runtime = 'nodejs';

const PLATFORM_FEE_PERCENT = 8;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.rabbitty.me';

export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const body = await req.json().catch(() => null);
    const itemId = typeof body?.itemId === 'string' ? body.itemId.trim() : '';
    if (!itemId) return NextResponse.json({ error: 'itemId requerido' }, { status: 400 });

    const [row] = await db
      .select({ item: wishlistItems, list: wishlists })
      .from(wishlistItems)
      .innerJoin(wishlists, eq(wishlists.id, wishlistItems.wishlistId))
      .where(eq(wishlistItems.id, itemId))
      .limit(1);

    if (!row) return NextResponse.json({ error: 'Deseo no encontrado' }, { status: 404 });
    if (row.list.userId === caller.id) return NextResponse.json({ error: 'No puedes regalarte a ti mismo' }, { status: 400 });
    if (row.item.status !== 'ACTIVE') return NextResponse.json({ error: 'Ese deseo ya no está disponible' }, { status: 409 });

    const amount = Number(row.item.priceSnapshot ?? 0);
    if (!(amount > 0)) return NextResponse.json({ error: 'Ese deseo no tiene precio para regalar' }, { status: 400 });
    if (!row.item.businessId) return NextResponse.json({ error: 'Deseo sin negocio asociado' }, { status: 400 });

    // El deseo debe estar compartido con un grupo mío
    const shares = await db
      .select({ groupId: wishlistShares.groupId })
      .from(wishlistShares)
      .where(eq(wishlistShares.wishlistId, row.list.id));
    const groupIds = shares.map((s) => s.groupId);
    const [member] = groupIds.length
      ? await db
          .select({ id: conversationMembers.id })
          .from(conversationMembers)
          .where(
            and(
              inArray(conversationMembers.conversationId, groupIds),
              eq(conversationMembers.userId, caller.id),
              isNull(conversationMembers.leftAt),
            ),
          )
          .limit(1)
      : [];
    if (!member) return NextResponse.json({ error: 'Ese deseo no está compartido contigo' }, { status: 403 });

    // Cuenta Stripe Connect del negocio
    const restRows = await db.select({ id: restaurants.id }).from(restaurants).where(eq(restaurants.businessId, row.item.businessId));
    let account: { stripeAccountId: string } | null = null;
    for (const r of restRows) {
      const brs = await db.select({ id: branches.id }).from(branches).where(eq(branches.restaurantId, r.id));
      for (const b of brs) {
        const [acc] = await db
          .select({ stripeAccountId: merchantPaymentAccounts.stripeAccountId })
          .from(merchantPaymentAccounts)
          .where(and(eq(merchantPaymentAccounts.branchId, b.id), eq(merchantPaymentAccounts.provider, 'STRIPE_CONNECT')))
          .limit(1);
        if (acc) { account = acc; break; }
      }
      if (account) break;
    }
    if (!account?.stripeAccountId) {
      return NextResponse.json({ error: 'El negocio no tiene cobros activos todavía' }, { status: 400 });
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) return NextResponse.json({ error: 'Stripe no configurado' }, { status: 500 });
    const stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' as never });

    // Registro PENDING (idempotente por sesión)
    const [gift] = await db
      .insert(wishlistGifts)
      .values({
        itemId,
        giverId: caller.id,
        amount,
        currency: 'MXN',
        status: 'PENDING',
        paymentProvider: 'STRIPE',
      })
      .returning();

    const metadata: Record<string, string> = {
      kind: 'WISHLIST_GIFT',
      giftId: gift.id,
      itemId,
      giverId: caller.id,
      recipientId: row.list.userId,
      businessId: row.item.businessId,
      stripeAccount: account.stripeAccountId,
    };

    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'mxn',
              unit_amount: Math.round(amount * 100),
              product_data: {
                name: `Regalo: ${row.item.title}`,
                description: 'Vale canjeable en el negocio',
              },
            },
          },
        ],
        client_reference_id: caller.id,
        metadata,
        payment_intent_data: {
          application_fee_amount: Math.round(amount * 100 * (PLATFORM_FEE_PERCENT / 100)),
          metadata,
        },
        success_url: `${APP_URL}/profile/wishlist?gift=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${APP_URL}/profile/wishlist?gift=cancelled`,
      },
      { stripeAccount: account.stripeAccountId },
    );

    await db
      .update(wishlistGifts)
      .set({ providerSessionId: session.id, updatedAt: new Date() })
      .where(eq(wishlistGifts.id, gift.id));

    return NextResponse.json({ success: true, url: session.url, giftId: gift.id });
  } catch (err) {
    console.error('[wishlist/gift/checkout] error:', err);
    return NextResponse.json({ error: 'No se pudo iniciar el regalo' }, { status: 500 });
  }
}
