import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, ownedBusinesses, transactions } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { parseTelegramUser, validateTelegramInitData } from '@/lib/telegramAuth';
import { recordLedgerTransaction, findLedgerEntry } from '@/lib/ledgerHelper';

export async function POST(req: NextRequest) {
  try {
    const { initData, businessId, bunzAmount, title, idempotencyKey: clientKey } = await req.json();

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

    // SYSTEM mints are a platform-admin primitive. No user (not even a business
    // owner) may mint to their own wallet through this endpoint.
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado para emitir crédito' }, { status: 403 });
    }

    const idempotencyKey = `crd_${clientKey || `${businessId}_${user.id}_${bunzAmount}`}`;

    // Atomic SQL transaction with row lock and authoritative Ledger entry
    const result = await db.transaction(async (tx) => {
      const [lockedUser] = await tx
        .select()
        .from(users)
        .where(eq(users.id, user.id))
        .for('update');

      if (!lockedUser) {
        throw new Error('USER_NOT_FOUND');
      }

      const prior = await findLedgerEntry(idempotencyKey, tx);
      if (prior) {
        return { tx: null, newBalance: lockedUser.totalBunzEarned, idempotent: true };
      }

      const [credited] = await tx
        .update(users)
        .set({ totalBunzEarned: sql`COALESCE(${users.totalBunzEarned}, 0) + ${bunzAmount}` })
        .where(eq(users.id, lockedUser.id))
        .returning();

      const [appTx] = await tx
        .insert(transactions)
        .values({
          userId: user.id,
          businessId,
          fiatAmount: 0,
          bunzMinted: bunzAmount,
          status: 'MINTED',
          errorMessage: title,
        })
        .returning();

      await recordLedgerTransaction(
        {
          payerSubjectId: 'SYSTEM',
          payeeSubjectId: `usr_${user.id}`,
          amount: bunzAmount,
          type: 'MINT',
          referenceId: appTx.id,
          idempotencyKey,
          metadata: { title, businessId, telegramId: user.telegramId },
        },
        tx
      );

      return { tx: appTx, newBalance: credited.totalBunzEarned };
    });

    return NextResponse.json({ success: true, transaction: result.tx, newBalance: result.newBalance });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Internal server error';
    console.error('Credit Error:', error);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
