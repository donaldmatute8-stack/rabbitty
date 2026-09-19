import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, ownedBusinesses, transactions } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { parseTelegramUser, validateTelegramInitData } from '@/lib/telegramAuth';

export async function POST(req: NextRequest) {
  try {
    const { initData, businessId, bunzAmount, title } = await req.json();

    if (!initData || !businessId || !title || bunzAmount === undefined || bunzAmount <= 0) {
      return NextResponse.json({ error: 'Missing required fields or invalid amount' }, { status: 400 });
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

    // Add Bunz atomically
    const [credited] = await db
      .update(users)
      .set({ totalBunzEarned: sql`COALESCE(${users.totalBunzEarned}, 0) + ${bunzAmount}` })
      .where(eq(users.id, user.id))
      .returning();

    // Insert transaction representing the credit
    const [tx] = await db.insert(transactions).values({
      userId: user.id,
      businessId,
      fiatAmount: 0,
      bunzMinted: bunzAmount,
      status: 'MINTED',
      errorMessage: title, // Storing reason here as it's the closest field for memos
    }).returning();

    return NextResponse.json({ success: true, transaction: tx, newBalance: credited.totalBunzEarned });
  } catch (error) {
    console.error('Credit Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
