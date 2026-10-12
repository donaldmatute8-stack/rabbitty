import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, ownedBusinesses, reservations } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { recordLedgerTransaction } from '@/lib/ledgerHelper';

export async function POST(req: NextRequest) {
  try {
    const { telegramId, businessId, title, bunzCost } = await req.json();

    if (!telegramId || !businessId || !title || bunzCost === undefined || bunzCost <= 0) {
      return NextResponse.json({ error: 'Missing required fields or invalid amount' }, { status: 400 });
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
      const idempotencyKey = `res_${resRow.id}_${Date.now()}`;
      await recordLedgerTransaction(
        {
          branchId: business.id,
          payerSubjectId: user.telegramId || user.id,
          payeeSubjectId: business.id,
          amount: bunzCost,
          type: 'SPEND',
          referenceId: resRow.id,
          idempotencyKey,
          metadata: { title, businessId },
        },
        tx
      );

      return resRow;
    });

    return NextResponse.json({ success: true, reservation });
  } catch (error: any) {
    if (error?.message === 'INSUFFICIENT_BUNZ') {
      return NextResponse.json({ error: 'Saldo insuficiente de Bunz' }, { status: 400 });
    }
    console.error('Reserve Error:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
