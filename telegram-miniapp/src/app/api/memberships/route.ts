import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  membershipSubscriptions,
  membershipPlanVersions,
  membershipPlans,
  membershipEntitlements,
  ownedBusinesses,
} from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/serverAuth";

/** Membresías del usuario autenticado con el estado de sus derechos. */
export async function GET(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

        const rows = await db
      .select({
        id: membershipSubscriptions.id,
        status: membershipSubscriptions.status,
        currentPeriodEnd: membershipSubscriptions.currentPeriodEnd,
        noExpiration: membershipSubscriptions.noExpiration,
        membershipOrigin: membershipSubscriptions.membershipOrigin,
        giftNote: membershipSubscriptions.giftNote,
        cancelAtPeriodEnd: membershipSubscriptions.cancelAtPeriodEnd,
        planName: membershipPlans.name,
        badgeColor: membershipPlans.badgeColor,
        businessName: ownedBusinesses.name,
        priceFiat: membershipPlanVersions.priceFiat,
        currency: membershipPlanVersions.currency,
        billingInterval: membershipPlanVersions.billingInterval,
      })
      .from(membershipSubscriptions)
      .leftJoin(membershipPlanVersions, eq(membershipPlanVersions.id, membershipSubscriptions.planVersionId))
      .leftJoin(membershipPlans, eq(membershipPlans.id, membershipPlanVersions.planId))
      .innerJoin(ownedBusinesses, eq(ownedBusinesses.id, membershipSubscriptions.businessId))
      .where(eq(membershipSubscriptions.userId, caller.id))
      .orderBy(desc(membershipSubscriptions.createdAt));

    const ids = rows.map((r) => r.id);
    const ents = ids.length
      ? await db
          .select({
            id: membershipEntitlements.id,
            subscriptionId: membershipEntitlements.subscriptionId,
            benefitType: membershipEntitlements.benefitType,
            quotaPerCycle: membershipEntitlements.quotaPerCycle,
            used: membershipEntitlements.currentUsageInCycle,
            cycleResetType: membershipEntitlements.cycleResetType,
            cycleEndDate: membershipEntitlements.cycleEndDate,
            discountPct: membershipEntitlements.discountPct,
          })
          .from(membershipEntitlements)
          .where(inArray(membershipEntitlements.subscriptionId, ids))
      : [];

    const memberships = rows.map((r) => ({
      ...r,
      entitlements: ents.filter((e) => e.subscriptionId === r.id),
    }));
    return NextResponse.json({ success: true, memberships });
  } catch (err) {
    console.error("[memberships] list error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

