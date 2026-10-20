import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { ownedBusinesses, moodCampaigns } from '@/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { MoodType } from '@/types/mood';
import { isHourInWindow, matchesMoodCategory } from '@/lib/moodVenues';

const VALID_MOODS: MoodType[] = ['calm', 'energy', 'focus', 'celebration', 'connection', 'surprise'];
const MAX_RESULTS = 8;

/**
 * GET /api/mood/venues?mood=focus[&hour=14]
 * Comercios afiliados aprobados que encajan con un mood.
 * Prioridad: (1) campaña de mood activa ahora → (2) campaña de ese mood en otro horario
 * → (3) categoría compatible. Público: solo expone datos ya visibles en el feed.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const mood = url.searchParams.get('mood') as MoodType | null;
    if (!mood || !VALID_MOODS.includes(mood)) {
      return NextResponse.json({ error: 'INVALID_MOOD', validMoods: VALID_MOODS }, { status: 400 });
    }

    const hourParam = parseInt(url.searchParams.get('hour') || '', 10);
    const hour = Number.isFinite(hourParam) && hourParam >= 0 && hourParam <= 23 ? hourParam : new Date().getHours();

    const [businesses, campaigns] = await Promise.all([
      db.select().from(ownedBusinesses)
        .where(eq(ownedBusinesses.status, 'APPROVED'))
        .orderBy(desc(ownedBusinesses.createdAt))
        .limit(200),
      db.select().from(moodCampaigns)
        .where(and(eq(moodCampaigns.targetMood, mood), eq(moodCampaigns.isActive, true))),
    ]);

    const campaignByBusiness = new Map<string, (typeof campaigns)[number]>();
    for (const c of campaigns) {
      const prev = campaignByBusiness.get(c.businessId);
      const cActive = isHourInWindow(hour, c.startHour, c.endHour);
      const prevActive = prev ? isHourInWindow(hour, prev.startHour, prev.endHour) : false;
      if (!prev || (cActive && !prevActive)) campaignByBusiness.set(c.businessId, c);
    }

    const scored = businesses
      .map((b) => {
        const campaign = campaignByBusiness.get(b.id);
        const activeNow = campaign ? isHourInWindow(hour, campaign.startHour, campaign.endHour) : false;
        const categoryMatch = matchesMoodCategory(mood, b.category);
        const score = campaign ? (activeNow ? 3 : 2) : categoryMatch ? 1 : 0;
        return { b, campaign, activeNow, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, z) => z.score - a.score)
      .slice(0, MAX_RESULTS);

    const venues = scored.map(({ b, campaign, activeNow }) => ({
      id: b.id,
      name: b.name,
      category: b.category,
      logoUrl: b.logoUrl,
      slug: b.slug,
      lat: b.lat,
      lng: b.lng,
      rewardPercentage: b.rewardPercentage,
      reason: campaign ? 'campaign' : 'category',
      campaign: campaign
        ? {
            title: campaign.title,
            description: campaign.description,
            rewardBunz: campaign.rewardBunz,
            activeNow,
          }
        : null,
    }));

    return NextResponse.json({ success: true, mood, venues });
  } catch (err) {
    console.error('[Mood Venues API Error]:', err);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
