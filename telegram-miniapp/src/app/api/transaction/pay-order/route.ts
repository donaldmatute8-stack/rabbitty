import { NextResponse } from 'next/server';
import { db as coreDb } from '@/db';
import { users } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { parseTelegramUser, validateTelegramInitData } from '@/lib/telegramAuth';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as restaurantSchema from '@rabbitty/database-restaurant';
import { paymentIntents, orders, payments } from '@rabbitty/database-restaurant/schema';
import { z } from 'zod';

const paySchema = z.object({
  initData: z.string(),
  paymentIntentId: z.string().uuid(),
});

// Setup restaurant DB connection
const restaurantDbUrl = process.env.RESTAURANT_DATABASE_URL || process.env.DATABASE_URL;
const restaurantPool = postgres(restaurantDbUrl as string, { ssl: 'require' });
const restaurantDb = drizzle(restaurantPool, { schema: restaurantSchema });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = paySchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid input', details: result.error.format() }, { status: 400 });
    }
    
    const { initData, paymentIntentId } = result.data;

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (botToken && !validateTelegramInitData(initData, botToken)) {
      return NextResponse.json({ error: 'Invalid Telegram authentication' }, { status: 401 });
    }

    const tUser = parseTelegramUser(initData);
    if (!tUser || !tUser.id) {
      return NextResponse.json({ error: 'Invalid user authentication' }, { status: 401 });
    }

    const user = await coreDb.query.users.findFirst({
      where: eq(users.telegramId, tUser.id.toString())
    });

    if (!user) {
      return NextResponse.json({ error: 'User not registered' }, { status: 404 });
    }

    // Load Payment Intent
    const [intent] = await restaurantDb.select().from(paymentIntents).where(eq(paymentIntents.id, paymentIntentId));
    if (!intent) {
      return NextResponse.json({ error: 'Payment Intent not found' }, { status: 404 });
    }

    if (intent.status !== 'PENDING_PAYMENT') {
      return NextResponse.json({ error: `Payment Intent is already ${intent.status}` }, { status: 400 });
    }

    if (new Date() > intent.expiresAt) {
      await restaurantDb.update(paymentIntents).set({ status: 'EXPIRED' }).where(eq(paymentIntents.id, intent.id));
      await restaurantDb.update(orders).set({ status: 'EXPIRED' }).where(eq(orders.id, intent.orderId));
      return NextResponse.json({ error: 'Payment Intent has expired' }, { status: 400 });
    }

    if ((user.totalBunzEarned ?? 0) < intent.bunzAmount) {
      return NextResponse.json({ error: 'Saldo de Bunz insuficiente' }, { status: 400 });
    }

    // Atomic Execution
    // 1. Debit Core DB
    await coreDb.update(users)
      .set({ totalBunzEarned: sql`COALESCE(${users.totalBunzEarned}, 0) - ${intent.bunzAmount}` })
      .where(eq(users.id, user.id));

    // 2. Fulfill Restaurant DB (Atomic via single connection transaction)
    await restaurantDb.transaction(async (tx) => {
      // Create payment
      await tx.insert(payments).values({
        orderId: intent.orderId,
        method: "BUNZ",
        amount: intent.amountMxn,
        verificationMethod: "SYSTEM_VERIFIED",
      });

      // Mark intent as verified
      await tx.update(paymentIntents)
        .set({ status: 'PAYMENT_VERIFIED' })
        .where(eq(paymentIntents.id, intent.id));

      // Mark order as completed
      await tx.update(orders)
        .set({ status: 'COMPLETED' })
        .where(eq(orders.id, intent.orderId));
    });

    return NextResponse.json({
      success: true,
      newBalance: (user.totalBunzEarned ?? 0) - intent.bunzAmount,
      amountPaid: intent.amountMxn,
      bunzDeducted: intent.bunzAmount,
    });

  } catch (error) {
    console.error('Pay Order Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
