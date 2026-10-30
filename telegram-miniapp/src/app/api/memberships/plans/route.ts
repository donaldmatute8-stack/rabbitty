import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  membershipPlans,
  membershipPlanVersions,
  membershipSubscriptions,
} from '@/db/schema';
import { getAuthenticatedUser } from '@/lib/serverAuth';

export const runtime = 'nodejs';

/** Planes publicados y activos de un negocio, con el estado de suscripción del caller. */
export async function GET(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const businessId = new URL(req.url).searchParams.get('businessId');
    if (!businessId) return NextResponse.json({ error: 'businessId requerido' }, { status: 400 });

    const rows = await db
      .select({ plan: membershipPlans, version: membershipPlanVersions })
      .from(membershipPlans)
      .innerJoin(membershipPlanVersions, eq(membershipPlanVersions.id, membershipPlans.currentVersionId))
      .where(and(
        eq(membershipPlans.businessId, businessId),
        eq(membershipPlans.isActive, true),
        eq(membershipPlanVersions.isPublished, true),
      ));

    const mySubs = await db
      .select({ planVersionId: membershipSubscriptions.planVersionId, status: membershipSubscriptions.status })
      .from(membershipSubscriptions)
      .where(eq(membershipSubscriptions.userId, caller.id));
    const activeVersionIds = new Set(mySubs.filter((s) => s.status === 'ACTIVE').map((s) => s.planVersionId));

    const plans = rows.map((r) => ({
      planId: r.plan.id,
      planName: r.plan.name,
      planDescription: r.plan.description,
      versionId: r.version.id,
      priceFiat: r.version.priceFiat,
      currency: r.version.currency,
      billingInterval: r.version.billingInterval,
      benefits: r.version.benefitRules,
      alreadySubscribed: activeVersionIds.has(r.version.id),
    }));

    return NextResponse.json({ success: true, plans });
  } catch (error) {
    console.error('[MEMBERSHIPS PLANS ERROR]', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
