import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, ownedBusinesses, transactions } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { parseTelegramUser, validateTelegramInitData } from '@/lib/telegramAuth';
import { recordLedgerTransaction } from '@/lib/ledgerHelper';

export async function POST(req: NextRequest) {
  try {
    const { initData, businessId, bunzCost, title } = await req.json();

    if (!initData || !businessId || !title || bunzCost === undefined || bunzCost <= 0) {
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

    // Atomic SQL transaction with pessimistic row lock and authoritative Ledger entry
    const result = await db.transaction(async (tx) => {
      const [lockedUser] = await tx
        .select()
        .from(users)
        .where(eq(users.id, user.id))
        .for('update');

      if (!lockedUser) {
        throw new Error('USER_NOT_FOUND');
      }

      const available = (lockedUser.totalBunzEarned ?? 0) - (lockedUser.totalBunzSpent ?? 0);
      if (available < bunzCost) {
        throw new Error('INSUFFICIENT_FUNDS');
      }

      // Record spending in users table
      const [updatedUser] = await tx
        .update(users)
        .set({ totalBunzSpent: sql`COALESCE(${users.totalBunzSpent}, 0) + ${bunzCost}` })
        .where(eq(users.id, lockedUser.id))
        .returning();

      // Insert transaction audit
      const [appTx] = await tx
        .insert(transactions)
        .values({
          userId: user.id,
          businessId,
          fiatAmount: 0,
          bunzMinted: -bunzCost,
          status: 'REDEEMED',
          errorMessage: title,
        })
        .returning();

      // Record authoritative Ledger entry
      const idempotencyKey = `rdm_${appTx.id}_${Date.now()}`;
      await recordLedgerTransaction(
        {
          payerSubjectId: user.telegramId || user.id,
          payeeSubjectId: business.id,
          amount: bunzCost,
          type: 'SPEND',
          referenceId: appTx.id,
          idempotencyKey,
          metadata: { title, businessId },
        },
        tx
      );

      const newBalance = (updatedUser.totalBunzEarned ?? 0) - (updatedUser.totalBunzSpent ?? 0);
      return { tx: appTx, newBalance };
    });

    return NextResponse.json({ success: true, transaction: result.tx, newBalance: result.newBalance });
  } catch (error: any) {
    if (error?.message === 'INSUFFICIENT_FUNDS') {
      return NextResponse.json({ error: 'Saldo insuficiente de Bunz' }, { status: 400 });
    }
    console.error('Redeem Error:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
