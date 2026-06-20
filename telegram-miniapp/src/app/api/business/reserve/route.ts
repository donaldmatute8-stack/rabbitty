import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, ownedBusinesses, reservations } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  try {
    const { telegramId, businessId, title, bunzCost } = await req.json();

    if (!telegramId || !businessId || !title || bunzCost === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.telegramId, telegramId.toString()),
    });

    if (!user) {
      return NextResponse.json({ error: 'User not registered' }, { status: 404 });
    }

    const business = await db.query.ownedBusinesses.findFirst({
      where: eq(ownedBusinesses.id, businessId),
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Deduct Bunz atomically
    const [deducted] = await db
      .update(users)
      .set({ totalBunzEarned: sql`${users.totalBunzEarned} - ${bunzCost}` })
      .where(and(eq(users.id, user.id), sql`${users.totalBunzEarned} >= ${bunzCost}`))
      .returning();

    if (!deducted) {
      return NextResponse.json({ error: 'Insufficient Bunz' }, { status: 400 });
    }

    const [reservation] = await db.insert(reservations).values({
      userId: user.id,
      businessId,
      title,
      bunzCost,
      status: 'PENDING',
    }).returning();

    return NextResponse.json({ success: true, reservation });
  } catch (error) {
    console.error('Reserve Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
