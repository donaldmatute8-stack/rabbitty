import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { atmosphereInterventions } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

/**
 * POST /api/mood/intervention
 * Logs an atmosphere recipe activation by the affiliate's staff or barista
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { businessId, recipeType, soundtrackApplied, lightingApplied, roomAction, notes, staffId } = body;

    if (!businessId || !recipeType) {
      return NextResponse.json({ error: 'businessId and recipeType are required' }, { status: 400 });
    }

    const [intervention] = await db.insert(atmosphereInterventions).values({
      businessId,
      recipeType,
      staffId: staffId || null,
      soundtrackApplied: soundtrackApplied || null,
      lightingApplied: lightingApplied || null,
      roomAction: roomAction || null,
      notes: notes || null,
    }).returning();

    return NextResponse.json({
      success: true,
      intervention,
      message: 'Receta de atmósfera aplicada y registrada en Proof of Atmosphere (PoA).'
    });
  } catch (error) {
    console.error('[API /api/mood/intervention POST] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * GET /api/mood/intervention?businessId=...
 * Fetches recent recipe interventions for this business
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 });
    }

    const recentInterventions = await db.select()
      .from(atmosphereInterventions)
      .where(eq(atmosphereInterventions.businessId, businessId))
      .orderBy(desc(atmosphereInterventions.executedAt))
      .limit(10);

    return NextResponse.json({
      success: true,
      interventions: recentInterventions,
    });
  } catch (error) {
    console.error('[API /api/mood/intervention GET] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
