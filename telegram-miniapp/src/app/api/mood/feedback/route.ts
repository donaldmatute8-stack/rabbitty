import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { moodEvents } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * POST /api/mood/feedback
 * Records user stay rating (1-5 stars) and optional notes for Proof of Atmosphere verification
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { eventId, rating, feedbackNote } = body;

    if (!eventId || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'eventId and rating (1-5) are required' },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(moodEvents)
      .set({
        rating,
        feedbackNote: feedbackNote || null,
      })
      .where(eq(moodEvents.id, eventId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Mood event not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Gracias por tu retroalimentación sobre la atmósfera del local.',
      event: {
        id: updated.id,
        rating: updated.rating,
        feedbackNote: updated.feedbackNote,
      },
    });
  } catch (error) {
    console.error('[API /api/mood/feedback POST] Error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
