import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  membershipSubscriptions,
  membershipPlanVersions,
  membershipPlans,
  membershipEntitlements,
  ownedBusinesses,
  users,
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
        planDescription: membershipPlans.description,
        badgeColor: membershipPlans.badgeColor,
        coverImageUrl: membershipPlans.coverImageUrl,
        businessName: ownedBusinesses.name,
        businessLogoUrl: ownedBusinesses.logoUrl,
        maxMembersLimit: membershipPlanVersions.maxMembersLimit,
        createdAt: membershipSubscriptions.createdAt,
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

    const [me] = await db
      .select({ firstName: users.firstName, lastName: users.lastName, username: users.username })
      .from(users)
      .where(eq(users.id, caller.id))
      .limit(1);
    const memberName = [me?.firstName, me?.lastName].filter(Boolean).join(" ") || me?.username || null;

    const nowMs = Date.now();
    const memberships = rows.map((r) => ({
      ...r,
      entitlements: ents
        .filter((e) => e.subscriptionId === r.id)
        .map((e) => ({
          ...e,
          // Ciclo vencido = cuota completa; el reset real ocurre al aplicar.
          used: e.cycleResetType !== "FIXED"
            && e.cycleEndDate
            && new Date(e.cycleEndDate).getTime() <= nowMs
            ? 0
            : e.used,
        })),
    }));
    return NextResponse.json({ success: true, memberName, memberships });
  } catch (err) {
    console.error("[memberships] list error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

