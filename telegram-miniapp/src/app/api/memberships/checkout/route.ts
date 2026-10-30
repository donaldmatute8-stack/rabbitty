import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  membershipPlans,
  membershipPlanVersions,
  membershipSubscriptions,
  ownedBusinesses,
} from '@/db/schema';
import { branches, restaurants, merchantPaymentAccounts } from '@rabbitty/database-restaurant/schema';
import { getAuthenticatedUser } from '@/lib/serverAuth';

export const runtime = 'nodejs';

const INTERVAL_TO_STRIPE: Record<string, { interval: 'month' | 'year'; interval_count: number }> = {
  MONTHLY: { interval: 'month', interval_count: 1 },
  QUARTERLY: { interval: 'month', interval_count: 3 },
  SEMIANNUAL: { interval: 'month', interval_count: 6 },
  ANNUAL: { interval: 'year', interval_count: 1 },
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.rabbitty.me';

/**
 * Suscripción self-service con Stripe Connect:
 * 1. Valida plan publicado + que el negocio tenga cuenta Connect activa.
 * 2. Asegura Product + Price recurrente EN LA CUENTA DEL AFILIADO (idempotente).
 * 3. Crea Checkout Session (mode=subscription) con metadata para el webhook.
 * Devuelve la URL de Checkout para abrirla nativa.
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const planVersionId = String(body?.planVersionId || '');
    if (!planVersionId) return NextResponse.json({ error: 'planVersionId requerido' }, { status: 400 });

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) return NextResponse.json({ error: 'Pagos no configurados (STRIPE_SECRET_KEY)' }, { status: 503 });

    const [row] = await db
      .select({ version: membershipPlanVersions, plan: membershipPlans })
      .from(membershipPlanVersions)
      .innerJoin(membershipPlans, eq(membershipPlans.id, membershipPlanVersions.planId))
      .where(eq(membershipPlanVersions.id, planVersionId))
      .limit(1);
    if (!row || !row.version.isPublished || !row.plan.isActive || row.plan.currentVersionId !== row.version.id) {
      return NextResponse.json({ error: 'Plan no disponible' }, { status: 400 });
    }

    // Sin duplicado activo
    const [existing] = await db
      .select({ id: membershipSubscriptions.id })
      .from(membershipSubscriptions)
      .where(and(
        eq(membershipSubscriptions.userId, caller.id),
        eq(membershipSubscriptions.planVersionId, row.version.id),
        eq(membershipSubscriptions.status, 'ACTIVE'),
      ))
      .limit(1);
    if (existing) return NextResponse.json({ error: 'Ya tienes esta membresía activa' }, { status: 409 });

    // Cuenta Stripe Connect del afiliado (branch → restaurant → account con chargesEnabled)
    const [biz] = await db.select({ id: ownedBusinesses.id, name: ownedBusinesses.name })
      .from(ownedBusinesses).where(eq(ownedBusinesses.id, row.plan.businessId)).limit(1);
    if (!biz) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 });

    const restRows = await db.select({ id: restaurants.id }).from(restaurants).where(eq(restaurants.businessId, biz.id));
    if (restRows.length === 0) return NextResponse.json({ error: 'El negocio no tiene Stripe conectado todavía' }, { status: 400 });
    const branchRows = await db.select({ id: branches.id }).from(branches)
      .where(branches.restaurantId && eq(branches.restaurantId, restRows[0].id));
    let account: { stripeAccountId: string } | null = null;
    for (const r of restRows) {
      const brs = await db.select({ id: branches.id }).from(branches).where(eq(branches.restaurantId, r.id));
      for (const b of brs) {
        const [acc] = await db.select({ stripeAccountId: merchantPaymentAccounts.stripeAccountId })
          .from(merchantPaymentAccounts)
          .where(and(eq(merchantPaymentAccounts.branchId, b.id), eq(merchantPaymentAccounts.provider, 'STRIPE_CONNECT')))
          .limit(1);
        if (acc) { account = acc; break; }
      }
      if (account) break;
    }
    if (!account?.stripeAccountId) {
      return NextResponse.json({ error: 'El negocio no tiene Stripe conectado todavía. Pídele que lo active en su POS.' }, { status: 400 });
    }

    const stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' as any });
    const acct = account.stripeAccountId;

    // Product + Price recurrentes EN LA CUENTA DEL AFILIADO (idempotente por columnas reservadas)
    let priceId = row.version.stripePriceId || null;
    if (!priceId) {
      const product = await stripe.products.create(
        {
          name: `${biz.name} — ${row.plan.name}`,
          description: `Membresía ${row.plan.name}`,
          metadata: { businessId: biz.id, planId: row.plan.id },
        },
        { stripeAccount: acct },
      );
      const interval = row.version.billingInterval === 'ONE_TIME' ? null : INTERVAL_TO_STRIPE[row.version.billingInterval];
      if (!interval) {
        return NextResponse.json({ error: 'Este plan no admite suscripción recurrente' }, { status: 400 });
      }
      const price = await stripe.prices.create(
        {
          product: product.id,
          currency: (row.version.currency || 'MXN').toLowerCase(),
          unit_amount: Math.round(Number(row.version.priceFiat) * 100),
          recurring: { interval: interval.interval, interval_count: interval.interval_count },
          metadata: { businessId: biz.id, planId: row.plan.id, planVersionId: row.version.id },
        },
        { stripeAccount: acct },
      );
      priceId = price.id;
      await db.update(membershipPlanVersions)
        .set({ stripeProductId: product.id, stripePriceId: price.id, updatedAt: new Date() })
        .where(eq(membershipPlanVersions.id, row.version.id));
    }

    const session = await stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        client_reference_id: caller.id,
        metadata: {
          kind: 'MEMBERSHIP_SUBSCRIPTION',
          userId: caller.id,
          businessId: biz.id,
          planVersionId: row.version.id,
          stripeAccount: acct,
        },
        subscription_data: {
          metadata: {
            userId: caller.id,
            businessId: biz.id,
            planVersionId: row.version.id,
          },
        },
        success_url: `${APP_URL}/memberships?checkout=success`,
        cancel_url: `${APP_URL}/memberships?checkout=cancelled`,
      },
      { stripeAccount: acct },
    );

    return NextResponse.json({ success: true, url: session.url });
  } catch (error) {
    console.error('[MEMBERSHIP CHECKOUT ERROR]', error);
    return NextResponse.json({ error: 'No se pudo iniciar el pago' }, { status: 500 });
  }
}
