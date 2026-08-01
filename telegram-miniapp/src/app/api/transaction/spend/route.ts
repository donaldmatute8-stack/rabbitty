import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, ownedBusinesses, transactions } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { parseTelegramUser, validateTelegramInitData } from '@/lib/telegramAuth';
import { processReferralAndNotifications } from '@/lib/referralLogic';
import { awardHops, evaluateHatTricks } from '@/lib/gamificationLogic';
import { z } from 'zod';

/**
 * API: /api/transaction/spend
 * Propósito: Permite al cliente escanear su ticket de consumo en un comercio afiliado para OTORGAR/ACUMULAR Bunz (Minting por consumo).
 */
const spendSchema = z.object({
  initData: z.string(),
  businessId: z.string().uuid(),
  fiatAmount: z.number().positive().optional().default(100),
});

const timeToMinutes = (timeStr: string) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = spendSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid input fields', details: result.error.format() }, { status: 400 });
    }
    
    const { initData, businessId, fiatAmount } = result.data;

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

    // Validate Happy Hour day
    const now = new Date();
    let currentDayIndex = now.getDay();
    if (currentDayIndex === 0) currentDayIndex = 7;

    let activeDaysArr: number[] = [];
    try { activeDaysArr = JSON.parse(business.activeDays); } catch {}

    if (!activeDaysArr.includes(currentDayIndex)) {
      await db.insert(transactions).values({
        userId: user.id, businessId, fiatAmount, bunzMinted: 0,
        status: 'FAILED', errorMessage: 'Escaneo fuera del día permitido (Happy Hour inactiva)'
      });
      return NextResponse.json({ error: 'Hoy no hay Happy Hour en este negocio. ¡Vuelve pronto!' }, { status: 403 });
    }

    // Validate Happy Hour time
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = timeToMinutes(business.startTime);
    const endMinutes = timeToMinutes(business.endTime);

    if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
      await db.insert(transactions).values({
        userId: user.id, businessId, fiatAmount, bunzMinted: 0,
        status: 'FAILED', errorMessage: 'Escaneo fuera de la hora permitida'
      });
      return NextResponse.json({ error: `El escaneo solo es válido entre las ${business.startTime} y las ${business.endTime}` }, { status: 403 });
    }

    // Calculate reward
    const bunzEarned = Math.floor(fiatAmount * (business.rewardPercentage / 100));

    // Atomic update: update user balance AND insert transaction in one operation
    const [updatedUser] = await db
      .update(users)
      .set({ totalBunzEarned: sql`COALESCE(${users.totalBunzEarned}, 0) + ${bunzEarned}` })
      .where(eq(users.id, user.id))
      .returning();

    const [tx] = await db.insert(transactions).values({
      userId: user.id,
      businessId,
      fiatAmount,
      bunzMinted: bunzEarned,
      status: 'MINTED',
    }).returning();

    // Fire-and-forget referral + gamification triggers
    processReferralAndNotifications(user.id, 'EARN').catch(() => {});
    awardHops(user.id, false).catch(() => {});
    evaluateHatTricks(user.id, { type: 'TOTAL_VISITS', value: 1 }).catch(() => {});

    return NextResponse.json({
      success: true,
      bunzEarned,
      newBalance: updatedUser.totalBunzEarned,
      transactionId: tx.id
    });

  } catch (error) {
    console.error('Oracle Transaction Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
