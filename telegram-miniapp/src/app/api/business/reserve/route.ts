import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, ownedBusinesses, reservations } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { recordLedgerTransaction, findLedgerEntry } from '@/lib/ledgerHelper';
import { parseTelegramUser, validateTelegramInitData } from '@/lib/telegramAuth';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { telegramId, businessId, title, bunzCost, initData, idempotencyKey: clientKey } = await req.json();

    if ((!initData && !telegramId) || !businessId || !title || bunzCost === undefined || bunzCost <= 0) {
      return NextResponse.json({ error: 'Missing required fields or invalid amount' }, { status: 400 });
    }

    const authHeader = req.headers.get('authorization');
    const expectedSecret = process.env.RABBITTY_API_SECRET;
    const serverAuthed = !!expectedSecret && authHeader === `Bearer ${expectedSecret}`;

    let resolvedTelegramId: string | null = null;
    if (serverAuthed) {
      resolvedTelegramId = telegramId ? telegramId.toString() : null;
    } else {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!initData) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
      if (botToken && !validateTelegramInitData(initData, botToken)) {
        return NextResponse.json({ error: 'Invalid Telegram authentication' }, { status: 401 });
      }
      const tUser = parseTelegramUser(initData);
      if (!tUser?.id) {
        return NextResponse.json({ error: 'Invalid user authentication' }, { status: 401 });
      }
      resolvedTelegramId = tUser.id.toString();
    }

    if (!resolvedTelegramId) {
      return NextResponse.json({ error: 'Could not resolve user identity' }, { status: 401 });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.telegramId, resolvedTelegramId),
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

    const idempotencyKey = `res_${clientKey || crypto.randomUUID()}`;

    // Atomic SQL transaction with pessimistic row lock and authoritative Ledger entry
    const reservation = await db.transaction(async (tx) => {
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
        return null;
      }

      const available = (lockedUser.totalBunzEarned ?? 0) - (lockedUser.totalBunzSpent ?? 0);
      if (available < bunzCost) {
        throw new Error('INSUFFICIENT_BUNZ');
      }

      // Record spending
      await tx
        .update(users)
        .set({ totalBunzSpent: sql`COALESCE(${users.totalBunzSpent}, 0) + ${bunzCost}` })
        .where(eq(users.id, lockedUser.id));

      const [resRow] = await tx
        .insert(reservations)
        .values({
          userId: user.id,
          businessId,
          title,
          bunzCost,
          status: 'PENDING',
        })
        .returning();

      // Record authoritative Ledger entry
      await recordLedgerTransaction(
        {
          branchId: business.id,
          payerSubjectId: `usr_${user.id}`,
          payeeSubjectId: business.id,
          amount: bunzCost,
          type: 'SPEND',
          referenceId: resRow.id,
          idempotencyKey,
          metadata: { title, businessId, telegramId: user.telegramId },
        },
        tx
      );

      return resRow;
    });

    if (!reservation) {
      return NextResponse.json({ success: true, message: 'Reserva ya procesada.' });
    }

    return NextResponse.json({ success: true, reservation });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Internal server error';
    if (errorMsg === 'INSUFFICIENT_BUNZ') {
      return NextResponse.json({ error: 'Saldo insuficiente de Bunz' }, { status: 400 });
    }
    console.error('Reserve Error:', error);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
