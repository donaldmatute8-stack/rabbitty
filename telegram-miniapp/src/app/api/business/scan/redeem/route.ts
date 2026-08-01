import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, ownedBusinesses, transactions } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

function timeToMinutes(timeStr: string) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * API: /api/business/scan/redeem
 * Propósito: Utilizado desde el Escáner de Caja del Comercio para canjear Cupones/Vales de Promoción de Happy Hour y otorgar la recompensa fija al cliente.
 */
export async function POST(req: NextRequest) {
  try {
    const { telegramId, businessId, couponCode } = await req.json();

    if (!telegramId || !businessId || !couponCode) {
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

    // Validate Happy Hour
    const now = new Date();
    let currentDayIndex = now.getDay();
    if (currentDayIndex === 0) currentDayIndex = 7;

    let activeDaysArr: number[] = [];
    try { activeDaysArr = JSON.parse(business.activeDays); } catch {}

    if (!activeDaysArr.includes(currentDayIndex)) {
      return NextResponse.json({ error: 'Happy Hour not active today' }, { status: 403 });
    }

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = timeToMinutes(business.startTime);
    const endMinutes = timeToMinutes(business.endTime);

    if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
      return NextResponse.json({ error: `Redeem only valid between ${business.startTime} and ${business.endTime}` }, { status: 403 });
    }

    // Award Bunz based on coupon code (fixed amount per redeem)
    const bunzAwarded = Math.floor(100 * (business.rewardPercentage / 100));

    // Atomic balance update
    const [updatedUser] = await db
      .update(users)
      .set({ totalBunzEarned: sql`COALESCE(${users.totalBunzEarned}, 0) + ${bunzAwarded}` })
      .where(eq(users.id, user.id))
      .returning();

    const [tx] = await db.insert(transactions).values({
      userId: user.id,
      businessId,
      fiatAmount: 100,
      bunzMinted: bunzAwarded,
      status: 'MINTED',
    }).returning();

    return NextResponse.json({
      success: true,
      bunzAwarded,
      newBalance: updatedUser.totalBunzEarned,
      transactionId: tx.id,
    });
  } catch (error) {
    console.error('Redeem Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


