import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { vibePassportStamps } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { VIBE_PASSPORT_ROUTES } from '@/types/mood';

/**
 * GET /api/mood/passport?userId=...
 * Returns the user's active passport routes and collected stamps
 */
export async function GET(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    const { searchParams } = new URL(req.url);
    const requestedUserId = searchParams.get('userId');

    const effectiveUserId = caller ? `usr_${caller.id}` : requestedUserId;

    if (!effectiveUserId) {
      return NextResponse.json({
        success: true,
        routes: VIBE_PASSPORT_ROUTES.map((route) => ({
          ...route,
          stamps: [],
          completedStopsCount: 0,
          isCompleted: false,
        })),
      });
    }

    const userStamps = await db
      .select()
      .from(vibePassportStamps)
      .where(eq(vibePassportStamps.userId, effectiveUserId))
      .orderBy(desc(vibePassportStamps.stampedAt));

    const routesWithProgress = VIBE_PASSPORT_ROUTES.map((route) => {
      const routeStamps = userStamps.filter((s) => s.routeId === route.id);
      const stampedOrders = new Set(routeStamps.map((s) => s.stopOrder));
      const completedStopsCount = route.stops.filter((stop) => stampedOrders.has(stop.order)).length;

      return {
        ...route,
        stamps: routeStamps,
        completedStopsCount,
        isCompleted: completedStopsCount === route.stops.length,
      };
    });

    return NextResponse.json({
      success: true,
      routes: routesWithProgress,
      totalStampsCount: userStamps.length,
    });
  } catch (error) {
    console.error('[API /api/mood/passport GET] Error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

/**
 * POST /api/mood/passport
 * Collects a stamp on a city route
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    const body = await req.json().catch(() => ({}));
    const { routeId, stopOrder, businessId, vibe, transactionId } = body;

    const effectiveUserId = caller ? `usr_${caller.id}` : body.userId;

    if (!effectiveUserId || !routeId || typeof stopOrder !== 'number' || !vibe) {
      return NextResponse.json(
        { error: 'userId, routeId, stopOrder, and vibe are required' },
        { status: 400 }
      );
    }

    // Verify if route exists
    const route = VIBE_PASSPORT_ROUTES.find((r) => r.id === routeId);
    if (!route) {
      return NextResponse.json({ error: 'Route not found' }, { status: 404 });
    }

    // Check if already stamped
    const [existing] = await db
      .select()
      .from(vibePassportStamps)
      .where(
        and(
          eq(vibePassportStamps.userId, effectiveUserId),
          eq(vibePassportStamps.routeId, routeId),
          eq(vibePassportStamps.stopOrder, stopOrder)
        )
      )
      .limit(1);

    if (existing) {
      return NextResponse.json({
        success: true,
        alreadyStamped: true,
        stamp: existing,
        message: 'Esta parada ya está sellada en tu Vibe Passport.',
      });
    }

    const [newStamp] = await db
      .insert(vibePassportStamps)
      .values({
        userId: effectiveUserId,
        routeId,
        stopOrder,
        businessId: businessId || null,
        vibe,
        transactionId: transactionId || null,
      })
      .returning();

    return NextResponse.json({
      success: true,
      alreadyStamped: false,
      stamp: newStamp,
      message: '¡Parada sellada en tu Rabbitty Vibe Passport!',
    });
  } catch (error) {
    console.error('[API /api/mood/passport POST] Error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
