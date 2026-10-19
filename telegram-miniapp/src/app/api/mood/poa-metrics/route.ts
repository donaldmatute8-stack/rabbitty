import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { moodEvents, atmosphereInterventions } from '@/db/schema';
import { eq, and, gte, isNotNull } from 'drizzle-orm';

/**
 * GET /api/mood/poa-metrics?businessId=...
 * Calculates Proof of Atmosphere (PoA) empirical metrics:
 * 1. Average customer satisfaction rating during active recipe interventions vs baseline
 * 2. Total recipe interventions executed by staff
 * 3. Most effective atmosphere recipe based on customer satisfaction
 * 4. Aggregated stats strictly respecting customer privacy
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const businessId = url.searchParams.get('businessId');
    const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '30', 10), 1), 90);

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 });
    }

    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // 1. Fetch all interventions for this business in timeframe
    const interventions = await db
      .select()
      .from(atmosphereInterventions)
      .where(
        and(
          eq(atmosphereInterventions.businessId, businessId),
          gte(atmosphereInterventions.executedAt, sinceDate)
        )
      );

    // 2. Fetch rated mood events for this business
    const ratedEvents = await db
      .select({
        id: moodEvents.id,
        mood: moodEvents.mood,
        rating: moodEvents.rating,
        createdAt: moodEvents.createdAt,
      })
      .from(moodEvents)
      .where(
        and(
          eq(moodEvents.businessId, businessId),
          gte(moodEvents.createdAt, sinceDate),
          isNotNull(moodEvents.rating)
        )
      );

    // 3. Compute baseline vs intervention window ratings
    // An event falls into an "intervention window" if it occurred within 3 hours after an atmosphere intervention
    const WINDOW_MS = 3 * 60 * 60 * 1000;

    const interventionRatings: number[] = [];
    const baselineRatings: number[] = [];
    const recipeScores: Record<string, { totalScore: number; count: number }> = {};

    for (const ev of ratedEvents) {
      const evTime = new Date(ev.createdAt).getTime();
      const matchingIntervention = interventions.find((interv) => {
        const intervTime = new Date(interv.executedAt).getTime();
        return evTime >= intervTime && evTime <= intervTime + WINDOW_MS;
      });

      if (matchingIntervention) {
        interventionRatings.push(ev.rating!);
        const rType = matchingIntervention.recipeType;
        if (!recipeScores[rType]) {
          recipeScores[rType] = { totalScore: 0, count: 0 };
        }
        recipeScores[rType].totalScore += ev.rating!;
        recipeScores[rType].count += 1;
      } else {
        baselineRatings.push(ev.rating!);
      }
    }

    const avgIntervention =
      interventionRatings.length > 0
        ? +(interventionRatings.reduce((a, b) => a + b, 0) / interventionRatings.length).toFixed(2)
        : null;

    const avgBaseline =
      baselineRatings.length > 0
        ? +(baselineRatings.reduce((a, b) => a + b, 0) / baselineRatings.length).toFixed(2)
        : null;

    // Determine top performing recipe
    let topRecipe: { recipeType: string; averageRating: number; sampleSize: number } | null = null;
    let highestAvg = 0;

    for (const [recipeType, data] of Object.entries(recipeScores)) {
      if (data.count >= 2) {
        const avg = +(data.totalScore / data.count).toFixed(2);
        if (avg > highestAvg) {
          highestAvg = avg;
          topRecipe = { recipeType, averageRating: avg, sampleSize: data.count };
        }
      }
    }

    // Lift percentage
    let satisfactionLiftPercent: number | null = null;
    if (avgIntervention && avgBaseline && avgBaseline > 0) {
      satisfactionLiftPercent = Math.round(((avgIntervention - avgBaseline) / avgBaseline) * 100);
    }

    return NextResponse.json({
      success: true,
      timeframeDays: days,
      metrics: {
        totalInterventionsLogged: interventions.length,
        totalRatedVisits: ratedEvents.length,
        avgRatingWithAtmosphereRecipe: avgIntervention,
        avgRatingBaseline: avgBaseline,
        satisfactionLiftPercent,
        topPerformingRecipe: topRecipe,
      },
      verifiedPoAStatus: interventions.length >= 3 ? 'VERIFIED_ACTIVE' : 'INITIALIZING',
    });
  } catch (error) {
    console.error('[API /api/mood/poa-metrics GET] Error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
