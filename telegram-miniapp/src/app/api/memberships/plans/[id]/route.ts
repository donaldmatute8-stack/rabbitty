import { NextRequest, NextResponse } from "next/server";
import { and, eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  membershipPlans,
  membershipPlanVersions,
  membershipSubscriptions,
  ownedBusinesses,
} from "@/db/schema";
import { getAuthenticatedUser } from "@/lib/serverAuth";

export const runtime = "nodejs";

/** Detalle de un plan para la página de compra. Acepta id o slug. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await getAuthenticatedUser(req);
    const { id } = await params;

    const memberCount = sql<number>`(
      SELECT count(*)::int
        FROM membership_subscriptions s
        JOIN membership_plan_versions v2 ON v2.id = s."planVersionId"
       WHERE v2."planId" = ${membershipPlans.id}
         AND s.status = 'ACTIVE'
    )`;
    const already = caller
      ? sql<boolean>`EXISTS (
          SELECT 1 FROM membership_subscriptions s
          JOIN membership_plan_versions v2 ON v2.id = s."planVersionId"
          WHERE v2."planId" = ${membershipPlans.id}
            AND s."userId" = ${caller.id}
            AND s.status = 'ACTIVE'
        )`
      : sql<boolean>`false`;

    const [row] = await db
      .select({
        plan: membershipPlans,
        version: membershipPlanVersions,
        businessName: ownedBusinesses.name,
        businessLogoUrl: ownedBusinesses.logoUrl,
        businessCategory: ownedBusinesses.category,
        businessDescription: ownedBusinesses.description,
        memberCount,
        alreadySubscribed: already,
      })
      .from(membershipPlans)
      .innerJoin(membershipPlanVersions, eq(membershipPlanVersions.id, membershipPlans.currentVersionId))
      .innerJoin(ownedBusinesses, eq(ownedBusinesses.id, membershipPlans.businessId))
      .where(
        and(
          eq(membershipPlans.isActive, true),
          eq(membershipPlanVersions.isPublished, true),
          eq(ownedBusinesses.sandbox, false),
          or(eq(membershipPlans.id, id), eq(membershipPlans.slug, id)),
        ),
      )
      .limit(1);

    if (!row) return NextResponse.json({ error: "Membresía no encontrada" }, { status: 404 });

    const featured = !!row.plan.featuredUntil && new Date(row.plan.featuredUntil) > new Date();
    const foundingAvailable =
      row.plan.foundingSlots != null && Number(row.memberCount) < Number(row.plan.foundingSlots);

    return NextResponse.json(
      {
        success: true,
        plan: {
          id: row.plan.id,
          slug: row.plan.slug,
          name: row.plan.name,
          description: row.plan.description,
          coverImageUrl: row.plan.coverImageUrl,
          badgeColor: row.plan.badgeColor,
          category: row.plan.category,
          tags: row.plan.tags ?? [],
          cardNiche: row.plan.cardNiche,
          cardDetail: row.plan.cardDetail,
          cardTagline: row.plan.cardTagline,
          businessId: row.plan.businessId,
          businessName: row.businessName,
          businessLogoUrl: row.businessLogoUrl,
          businessCategory: row.businessCategory,
          businessDescription: row.businessDescription,
          versionId: row.version.id,
          priceFiat: Number(row.version.priceFiat),
          currency: row.version.currency,
          billingInterval: row.version.billingInterval,
          trialDays: row.version.trialDays ?? 0,
          benefits: row.version.benefitRules,
          branchesAllowed: row.version.branchesAllowed,
          maxMembersLimit: row.version.maxMembersLimit,
          memberCount: Number(row.memberCount),
          featured,
          foundingSlots: row.plan.foundingSlots,
          foundingAvailable,
          alreadySubscribed: Boolean(row.alreadySubscribed),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[MEMBERSHIP_PLAN_GET]", error);
    return NextResponse.json({ error: "No se pudo cargar la membresía" }, { status: 500 });
  }
}
