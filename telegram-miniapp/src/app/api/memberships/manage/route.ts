import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import Stripe from "stripe";
import { db } from "@/db";
import { membershipSubscriptions, membershipPlanVersions, membershipPlans, ownedBusinesses } from "@/db/schema";
import { branches, restaurants, merchantPaymentAccounts } from "@rabbitty/database-restaurant/schema";
import { getAuthenticatedUser } from "@/lib/serverAuth";

export const runtime = "nodejs";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.rabbitty.me";

async function resolveStripeAccount(businessId: string): Promise<string | null> {
  const restRows = await db
    .select({ id: restaurants.id })
    .from(restaurants)
    .where(eq(restaurants.businessId, businessId));
  for (const r of restRows) {
    const brs = await db.select({ id: branches.id }).from(branches).where(eq(branches.restaurantId, r.id));
    for (const b of brs) {
      const [acc] = await db
        .select({ stripeAccountId: merchantPaymentAccounts.stripeAccountId })
        .from(merchantPaymentAccounts)
        .where(and(eq(merchantPaymentAccounts.branchId, b.id), eq(merchantPaymentAccounts.provider, "STRIPE_CONNECT")))
        .limit(1);
      if (acc?.stripeAccountId) return acc.stripeAccountId;
    }
  }
  return null;
}

async function ownedSubscription(subscriptionId: string, userId: string) {
  const [row] = await db
    .select({
      sub: membershipSubscriptions,
      version: membershipPlanVersions,
      plan: membershipPlans,
      businessName: ownedBusinesses.name,
    })
    .from(membershipSubscriptions)
    .leftJoin(membershipPlanVersions, eq(membershipPlanVersions.id, membershipSubscriptions.planVersionId))
    .leftJoin(membershipPlans, eq(membershipPlans.id, membershipPlanVersions.planId))
    .leftJoin(ownedBusinesses, eq(ownedBusinesses.id, membershipSubscriptions.businessId))
    .where(
      and(
        eq(membershipSubscriptions.id, subscriptionId),
        eq(membershipSubscriptions.userId, userId),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Cancela o reactiva una membresía del usuario autenticado. */
export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const subscriptionId = String(body?.subscriptionId || "");
    const action = String(body?.action || "cancel");
    if (!subscriptionId) return NextResponse.json({ error: "subscriptionId requerido" }, { status: 400 });

    const row = await ownedSubscription(subscriptionId, caller.id);
    if (!row) return NextResponse.json({ error: "Membresía no encontrada" }, { status: 404 });

    const acct = await resolveStripeAccount(row.sub.businessId);
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const isPaid = !!row.sub.paymentProviderSubId && !!secretKey && !!acct;

    if (isPaid) {
      const stripe = new Stripe(secretKey!, { apiVersion: "2024-06-20" as any });
      await stripe.subscriptions.update(
        row.sub.paymentProviderSubId!,
        { cancel_at_period_end: action !== "reactivate" },
        { stripeAccount: acct! },
      );
      await db
        .update(membershipSubscriptions)
        .set({ cancelAtPeriodEnd: action !== "reactivate", updatedAt: new Date() })
        .where(eq(membershipSubscriptions.id, subscriptionId));
      return NextResponse.json({ success: true, cancelAtPeriodEnd: action !== "reactivate" });
    }

    // Gratis/promo: cancelación inmediata.
    await db
      .update(membershipSubscriptions)
      .set({
        status: action === "reactivate" ? "ACTIVE" : "CANCELLED",
        cancelAtPeriodEnd: true,
        updatedAt: new Date(),
        ...(action === "reactivate" ? { revokedAt: null } : { revokedAt: new Date() }),
      })
      .where(eq(membershipSubscriptions.id, subscriptionId));
    return NextResponse.json({ success: true, cancelAtPeriodEnd: true });
  } catch (error) {
    console.error("[MEMBERSHIP_MANAGE]", error);
    return NextResponse.json({ error: "No se pudo gestionar la membresía" }, { status: 500 });
  }
}

/** Devuelve la URL del portal de facturación de Stripe para una suscripción pagada. */
export async function GET(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const url = new URL(req.url);
    const subscriptionId = url.searchParams.get("subscriptionId") || "";
    const row = await ownedSubscription(subscriptionId, caller.id);
    if (!row) return NextResponse.json({ error: "Membresía no encontrada" }, { status: 404 });

    const secretKey = process.env.STRIPE_SECRET_KEY;
    const acct = await resolveStripeAccount(row.sub.businessId);
    if (!secretKey || !acct || !row.sub.paymentProviderSubId) {
      return NextResponse.json({ error: "Esta membresía no tiene pagos recurrentes" }, { status: 400 });
    }

    const stripe = new Stripe(secretKey, { apiVersion: "2024-06-20" as any });
    const sub = await stripe.subscriptions.retrieve(row.sub.paymentProviderSubId, {}, { stripeAccount: acct });
    const customer = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
    if (!customer) return NextResponse.json({ error: "Cliente de Stripe no encontrado" }, { status: 404 });

    const portal = await stripe.billingPortal.sessions.create(
      { customer, return_url: `${APP_URL}/memberships` },
      { stripeAccount: acct },
    );
    return NextResponse.json({ success: true, url: portal.url });
  } catch (error) {
    console.error("[MEMBERSHIP_PORTAL]", error);
    return NextResponse.json({ error: "No se pudo abrir el portal de pagos" }, { status: 500 });
  }
}
