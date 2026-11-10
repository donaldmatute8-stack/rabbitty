import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  membershipPlans,
  membershipPlanVersions,
  membershipSubscriptions,
  ownedBusinesses,
} from "@/db/schema";
import { getAuthenticatedUser } from "@/lib/serverAuth";

export const runtime = "nodejs";

/**
 * Descubrimiento de membresías.
 * - Sin `businessId`: solo planes publicados en el marketplace.
 * - Con `businessId`: planes de ese negocio (para su página de afiliado),
 *   aunque no estén en el marketplace global.
 */
export async function GET(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    const category = (url.searchParams.get("category") || "").trim();
    const businessId = (url.searchParams.get("businessId") || "").trim();
    const freeOnly = url.searchParams.get("free") === "1";
    const featuredOnly = url.searchParams.get("featured") === "1";

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

    const conditions = [
      eq(membershipPlans.isActive, true),
      eq(membershipPlanVersions.isPublished, true),
      eq(ownedBusinesses.sandbox, false),
      sql`${membershipPlans.currentVersionId} = ${membershipPlanVersions.id}`,
    ];
    if (businessId) conditions.push(eq(membershipPlans.businessId, businessId));
    // Incluso en la página del afiliado, los planes privados no se listan.
    conditions.push(eq(membershipPlans.isMarketplaceVisible, true));
    if (category) conditions.push(eq(membershipPlans.category, category));
    if (freeOnly) conditions.push(sql`${membershipPlanVersions.priceFiat} = 0`);
    if (featuredOnly) conditions.push(sql`${membershipPlans.featuredUntil} > now()`);
    if (q) {
      conditions.push(
        or(
          ilike(membershipPlans.name, `%${q}%`),
          ilike(ownedBusinesses.name, `%${q}%`),
        )!,
      );
    }

    const rows = await db
      .select({
        plan: membershipPlans,
        version: membershipPlanVersions,
        businessName: ownedBusinesses.name,
        businessLogoUrl: ownedBusinesses.logoUrl,
        businessCategory: ownedBusinesses.category,
        memberCount,
        alreadySubscribed: already,
      })
      .from(membershipPlans)
      .innerJoin(membershipPlanVersions, eq(membershipPlanVersions.id, membershipPlans.currentVersionId))
      .innerJoin(ownedBusinesses, eq(ownedBusinesses.id, membershipPlans.businessId))
      .where(and(...conditions))
      .orderBy(
        desc(sql`CASE WHEN ${membershipPlans.featuredUntil} > now() THEN 1 ELSE 0 END`),
        desc(memberCount),
        desc(membershipPlans.publishedAt),
        desc(membershipPlans.createdAt),
      )
      .limit(60);

    const plans = rows.map((r) => {
      const featured = !!r.plan.featuredUntil && new Date(r.plan.featuredUntil) > new Date();
      const foundingAvailable =
        r.plan.foundingSlots != null && Number(r.memberCount) < Number(r.plan.foundingSlots);
      return {
        id: r.plan.id,
        slug: r.plan.slug,
        name: r.plan.name,
        description: r.plan.description,
        coverImageUrl: r.plan.coverImageUrl,
        badgeColor: r.plan.badgeColor,
        category: r.plan.category,
        tags: r.plan.tags ?? [],
        cardNiche: r.plan.cardNiche,
        cardDetail: r.plan.cardDetail,
        cardTagline: r.plan.cardTagline,
        businessId: r.plan.businessId,
        businessName: r.businessName,
        businessLogoUrl: r.businessLogoUrl,
        businessCategory: r.businessCategory,
        versionId: r.version.id,
        priceFiat: Number(r.version.priceFiat),
        currency: r.version.currency,
        billingInterval: r.version.billingInterval,
        trialDays: r.version.trialDays ?? 0,
        benefits: r.version.benefitRules,
        maxMembersLimit: r.version.maxMembersLimit,
        memberCount: Number(r.memberCount),
        featured,
        foundingSlots: r.plan.foundingSlots,
        foundingAvailable,
        alreadySubscribed: Boolean(r.alreadySubscribed),
        publishedAt: r.plan.publishedAt,
      };
    });

    return NextResponse.json({ success: true, plans }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[MARKETPLACE_GET]", error);
    return NextResponse.json({ error: "No se pudo cargar el marketplace" }, { status: 500 });
  }
}
