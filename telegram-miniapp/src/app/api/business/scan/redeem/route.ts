import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, ownedBusinesses, transactions } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { parseTelegramUser, validateTelegramInitData } from '@/lib/telegramAuth';

export async function POST(req: NextRequest) {
  try {
    const { initData, businessId, bunzCost, title } = await req.json();

    if (!initData || !businessId || !title || bunzCost === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (botToken && !validateTelegramInitData(initData, botToken)) {
      return NextResponse.json({ error: 'Invalid Telegram authentication' }, { status: 401 });
    }

    const tUser = parseTelegramUser(initData);
    if (!tUser || !tUser.id) {
      return NextResponse.json({ error: 'Invalid user authentication' }, { status: 401 });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.telegramId, tUser.id.toString())
    });

    if (!user) {
      return NextResponse.json({ error: 'User not registered' }, { status: 404 });
    }

    const business = await db.query.ownedBusinesses.findFirst({
      where: eq(ownedBusinesses.id, businessId)
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

    // Insert transaction representing the redemption
    const [tx] = await db.insert(transactions).values({
      userId: user.id,
      businessId,
      fiatAmount: 0,
      bunzMinted: -bunzCost,
      status: 'REDEEMED',
      errorMessage: title,
    }).returning();

    return NextResponse.json({ success: true, transaction: tx, newBalance: deducted.totalBunzEarned });
  } catch (error) {
    console.error('Redeem Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
