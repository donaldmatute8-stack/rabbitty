import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import Stripe from "stripe";
import { restaurantDb } from "@/db/restaurant";
import {
  merchantPaymentAccounts,
  rabbitChairActivations,
  rabbitChairSlots,
  restaurants,
} from "@rabbitty/database-restaurant/schema";
import { getAuthenticatedUser } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

/**
 * ── Rabbit Chair · pago del aporte (Stripe Checkout) ───────────────────────
 * Crea una sesión de pago en la cuenta Connect del negocio. El webhook de
 * Stripe marca el lugar como pagado y crea la orden.
 */
export async function POST(req: NextRequest) {
  const caller = await getAuthenticatedUser(req);
  if (!caller?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const activationId = String(body?.activationId || "").trim();
  if (!activationId) return NextResponse.json({ error: "activationId requerido" }, { status: 400 });

  const [activation] = await restaurantDb
    .select()
    .from(rabbitChairActivations)
    .where(eq(rabbitChairActivations.id, activationId))
    .limit(1);
  if (!activation) return NextResponse.json({ error: "Activación no encontrada" }, { status: 404 });
  if (activation.status !== "LIVE") {
    return NextResponse.json({ error: "La activación no está abierta" }, { status: 409 });
  }

  const [restaurant] = await restaurantDb
    .select({ enabled: restaurants.rabbitChairEnabled })
    .from(restaurants)
    .where(eq(restaurants.businessId, activation.businessId))
    .limit(1);
  if (!restaurant?.enabled) {
    return NextResponse.json({ error: "La experiencia no está activa" }, { status: 409 });
  }

  const [slot] = await restaurantDb
    .select()
    .from(rabbitChairSlots)
    .where(
      and(
        eq(rabbitChairSlots.activationId, activationId),
        eq(rabbitChairSlots.userId, caller.id),
      ),
    )
    .limit(1);

  if (!slot) return NextResponse.json({ error: "Primero toma un lugar" }, { status: 409 });
  if (slot.status === "PAID") return NextResponse.json({ success: true, alreadyPaid: true });

  const min = Number(activation.minContributionCents);
  const amount =
    body?.amountCents != null ? Math.max(min, Math.round(Number(body.amountCents))) : min;
  if (!Number.isFinite(amount) || amount < min) {
    return NextResponse.json({ error: "El aporte está por debajo del mínimo" }, { status: 400 });
  }

  // Cuenta Connect del negocio (la misma que usan las membresías).
  const [account] = await restaurantDb
    .select({ stripeAccountId: merchantPaymentAccounts.stripeAccountId })
    .from(merchantPaymentAccounts)
    .where(
      and(
        eq(merchantPaymentAccounts.branchId, activation.branchId),
        eq(merchantPaymentAccounts.provider, "STRIPE_CONNECT"),
      ),
    )
    .limit(1);

  if (!account?.stripeAccountId) {
    return NextResponse.json(
      { error: "El negocio no tiene Stripe conectado. Paga el aporte en caja." },
      { status: 400 },
    );
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return NextResponse.json({ error: "Pagos no configurados" }, { status: 500 });
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const stripe = new Stripe(secret, { apiVersion: "2024-06-20" as any });

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "mxn",
            unit_amount: amount,
            product_data: { name: `Rabbit Chair · ${activation.name}` },
          },
        },
      ],
      success_url: `${origin}/rabbit-chair?business=${activation.businessId}&paid=1`,
      cancel_url: `${origin}/rabbit-chair?business=${activation.businessId}`,
      metadata: {
        kind: "rabbit_chair",
        slotId: slot.id,
        activationId,
        userId: caller.id,
        businessId: activation.businessId,
      },
      payment_intent_data: {
        metadata: {
          kind: "rabbit_chair",
          slotId: slot.id,
          activationId,
          userId: caller.id,
        },
      },
    },
    { stripeAccount: account.stripeAccountId },
  );

  await restaurantDb
    .update(rabbitChairSlots)
    .set({ paymentRef: session.id, updatedAt: new Date() })
    .where(eq(rabbitChairSlots.id, slot.id));

  return NextResponse.json({ success: true, url: session.url });
}
