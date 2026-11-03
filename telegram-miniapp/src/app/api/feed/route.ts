import { NextResponse } from 'next/server';
import { db } from '@/db';

import { ownedBusinesses, affiliateCampaigns } from '@/db/schema';
import { desc, eq, inArray, and, gt, gte } from 'drizzle-orm';
import { resolveBusinessCover } from '@/lib/businessCover';

// H-COVER-SSOT: el feed es dato vivo (cover/negocios cambian). Sin esto Next
// puede servir la respuesta cacheada del build y la portada nueva no aparece.
export const dynamic = 'force-dynamic';

const parseSafeJson = <T>(str: string | null | undefined, fallback: T): T => {
  if (!str) return fallback;
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
};

export async function GET() {
  try {
    const businesses = await db.select().from(ownedBusinesses)
      .where(eq(ownedBusinesses.status, 'APPROVED'))
      .orderBy(desc(ownedBusinesses.createdAt))
      .limit(100);

    const businessIds = businesses.map(b => b.id);
    const boostMap = new Map<string, { rewardPercentage: number; headline: string }>();

    if (businessIds.length > 0) {
      const now = new Date();
      const activeCampaigns = await db.select().from(affiliateCampaigns)
        .where(
          and(
            inArray(affiliateCampaigns.businessId, businessIds),
            eq(affiliateCampaigns.campaignType, 'FLASH_OFFER'),
            eq(affiliateCampaigns.status, 'ACTIVE'),
            gt(affiliateCampaigns.expiresAt, now),
            // Piso económico: sin ofertas flash por debajo del 10%
            gte(affiliateCampaigns.rewardPercentage, 10),
          )
        );
      for (const ac of activeCampaigns) {
        const cur = boostMap.get(ac.businessId);
        if (!cur || ac.rewardPercentage > cur.rewardPercentage) {
          boostMap.set(ac.businessId, {
            rewardPercentage: ac.rewardPercentage,
            headline: ac.headline || ac.title,
          });
        }
      }
    }

    const feedItems = businesses.map((b) => {
      // Misma fuente que la página del afiliado y el OG (H-COVER-SSOT).
      const imageUrl = resolveBusinessCover({
        id: b.id,
        gallery: b.gallery,
        category: b.category,
      });
      const activeDays = parseSafeJson<number[]>(b.activeDays, [1, 2, 3, 4, 5, 6, 7]);
      const boost = boostMap.get(b.id);
      const effectiveReward = boost ? Math.max(b.rewardPercentage, boost.rewardPercentage) : b.rewardPercentage;

      return {
        id: b.id,
        user: b.name,
        device: b.category || 'General',
        category: b.category || 'General',
        time: 'Reciente',
        label: 'Cerca',
        bunz: effectiveReward,
        reward_percentage: effectiveReward,
        rewardPercentage: effectiveReward,
        hasBoost: !!boost,
        boostHeadline: boost?.headline,
        givesBunz: b.givesBunz,
        acceptsBunz: b.acceptsBunz,
        bunzBalance: b.bunzBalance || 0,
        hasStockOffer: Boolean(b.acceptsBunz && (b.bunzBalance || 0) >= 5),
        distance: 0,
        imageUrl,
        logo_base64: b.logoUrl,
        lat: b.lat,
        lng: b.lng,
        hops: b.hops || 0,
        savedCount: b.savedCount || 0,
        sharedCount: b.sharedCount || 0,
        activeDays,
        startTime: b.startTime,
        endTime: b.endTime
      };
    });

    return NextResponse.json({ success: true, data: feedItems });
  } catch (error: unknown) {
    console.error('Feed API Error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', message }, { status: 500 });
  }
}
