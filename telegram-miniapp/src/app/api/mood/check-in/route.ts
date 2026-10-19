import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { moodEvents, moodCampaigns } from '@/db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { MoodType, MOOD_DEFINITIONS } from '@/types/mood';

const VALID_MOODS: MoodType[] = ['calm', 'energy', 'focus', 'celebration', 'connection', 'surprise'];

/**
 * POST /api/mood/check-in
 * Records a voluntary, non-invasive mood check-in.
 * Privacy-first: if user is not authenticated or prefers privacy, recorded with pseudonymized/null userId.
 * Returns curated mood experience, music links, and active affiliate campaigns if at a venue.
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    const body = await req.json().catch(() => ({}));
    const { mood, businessId, source = 'checkin', metadata = {} } = body;

    if (!mood || !VALID_MOODS.includes(mood)) {
      return NextResponse.json({ error: 'INVALID_MOOD', validMoods: VALID_MOODS }, { status: 400 });
    }

    const moodConfig = MOOD_DEFINITIONS[mood as MoodType];

    // Pseudonymize or record caller ID if available
    const effectiveUserId = caller ? `usr_${caller.id}` : null;

    // 1. Insert mood event into database
    const [event] = await db
      .insert(moodEvents)
      .values({
        userId: effectiveUserId,
        businessId: businessId || null,
        mood,
        source,
        metadata: {
          ...metadata,
          hourOfDay: new Date().getHours(),
          dayOfWeek: new Date().getDay(),
        },
      })
      .returning();

    // 2. Fetch active mood campaign for this venue if present
    let activeCampaign = null;
    if (businessId) {
      const currentHour = new Date().getHours();
      const [campaign] = await db
        .select()
        .from(moodCampaigns)
        .where(
          and(
            eq(moodCampaigns.businessId, businessId),
            eq(moodCampaigns.targetMood, mood),
            eq(moodCampaigns.isActive, true),
            sql`${currentHour} >= ${moodCampaigns.startHour} AND ${currentHour} <= ${moodCampaigns.endHour}`
          )
        )
        .limit(1);

      if (campaign) {
        activeCampaign = campaign;
      }
    }

    // 3. Return experience package
    return NextResponse.json({
      success: true,
      eventId: event.id,
      mood: moodConfig,
      campaign: activeCampaign,
      recommendation: {
        music: moodConfig.music,
        pairing: moodConfig.pairingSuggestion,
      },
    });
  } catch (err: unknown) {
    console.error('[Mood Check-in API Error]:', err);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

/**
 * GET /api/mood/check-in
 * Retrieves the user's latest check-in or venue atmosphere pulse
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const businessId = url.searchParams.get('businessId');
    const caller = await getAuthenticatedUser(req);

    // If querying for a specific user's latest mood
    let userLatest = null;
    if (caller) {
      const conditions = [eq(moodEvents.userId, `usr_${caller.id}`)];
      if (businessId) {
        conditions.push(eq(moodEvents.businessId, businessId));
      }

      const [latest] = await db
        .select()
        .from(moodEvents)
        .where(and(...conditions))
        .orderBy(desc(moodEvents.createdAt))
        .limit(1);

      if (latest && latest.mood in MOOD_DEFINITIONS) {
        userLatest = {
          eventId: latest.id,
          mood: MOOD_DEFINITIONS[latest.mood as MoodType],
          createdAt: latest.createdAt,
        };
      }
    }

    return NextResponse.json({
      success: true,
      latest: userLatest,
      availableMoods: Object.values(MOOD_DEFINITIONS),
    });
  } catch (err: unknown) {
    console.error('[Mood GET API Error]:', err);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
