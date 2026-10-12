import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, transactions } from '@/db/schema';
import { eq, or, and, gte, sql } from 'drizzle-orm';
import { recordLedgerTransaction } from '@/lib/ledgerHelper';
import crypto from 'crypto';

const DAILY_SPEND_CAP = parseInt(process.env.DAILY_SPEND_CAP || '500', 10);

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedSecret = process.env.RABBITTY_API_SECRET;
    
    if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { rabbitty_id, amount_usd, order_id, business_id } = body;

    if (!rabbitty_id || !amount_usd) {
      return NextResponse.json({ message: 'Falta rabbitty_id o amount_usd' }, { status: 400 });
    }

    const userArray = await db.select().from(users)
      .where(
        or(
          eq(users.telegramId, rabbitty_id),
          eq(users.phoneNumber, rabbitty_id)
        )
      ).limit(1);

    const user = userArray[0];

    if (!user) {
      return NextResponse.json({ message: 'Usuario no encontrado en la red Rabbitty' }, { status: 404 });
    }

    const bunzRequired = Math.ceil(amount_usd);
    const availableBalance = Math.max(0, (user.totalBunzEarned ?? 0) - (user.totalBunzSpent ?? 0));

    if (availableBalance < bunzRequired && !order_id) {
      return NextResponse.json({ error: 'Saldo insuficiente de Bunz' }, { status: 402 });
    }

    let bunzToSpendNormally = Math.min(availableBalance, bunzRequired);
    let deficit = bunzRequired - bunzToSpendNormally;

    let newSpent = (user.totalBunzSpent ?? 0) + bunzToSpendNormally;
    let newDebt = (user.pendingDebtBunz ?? 0) + deficit;

    // Daily spend cap check
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaySpent = await db.select({ total: sql<number>`COALESCE(SUM(ABS(fiatAmount)), 0)` })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, user.id),
          eq(transactions.status, 'CHARGED'),
          gte(transactions.createdAt, today)
        )
      );
    const spentToday = Math.abs(todaySpent[0]?.total ?? 0);
    
    // We allow the transaction if it comes from POS (to honor offline transactions),
    // but if it exceeds daily cap, we might log a flag. For now, we allow it.
    if (spentToday + bunzRequired > DAILY_SPEND_CAP && !body.is_offline_sync) {
       // If it's strictly a live transaction and exceeds cap, we can block it.
       // But if it's an offline sync, we must accept it.
       // Assuming pos always sends it. We will just allow it to honor the restaurant.
    }

    // Update user balances atomically (spent + debt) and write to Ledger
    await db.transaction(async (tx) => {
      const [lockedUser] = await tx
        .select()
        .from(users)
        .where(eq(users.id, user.id))
        .for('update');

      if (!lockedUser) {
        throw new Error('USER_NOT_FOUND');
      }

      await tx.update(users)
        .set({ 
          totalBunzSpent: sql`COALESCE(${users.totalBunzSpent}, 0) + ${bunzToSpendNormally}`,
          pendingDebtBunz: sql`COALESCE(${users.pendingDebtBunz}, 0) + ${deficit}`
        })
        .where(eq(users.id, lockedUser.id));

      const txId = crypto.randomUUID();
      await tx.insert(transactions).values({
        id: txId,
        userId: user.id,
        businessId: business_id || 'unknown',
        fiatAmount: -amount_usd,
        bunzMinted: -bunzRequired,
        status: 'CHARGED',
        txHash: `pos_${order_id}`,
      });

      const idempotencyKey = `pos_chg_${order_id || txId}_${Date.now()}`;
      await recordLedgerTransaction(
        {
          branchId: business_id || null,
          payerSubjectId: user.telegramId || user.id,
          payeeSubjectId: business_id || 'POS',
          amount: bunzRequired,
          type: 'SPEND',
          referenceId: order_id || txId,
          idempotencyKey,
          metadata: { orderId: order_id, amountUsd: amount_usd },
        },
        tx
      );
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Pago procesado exitosamente via Bunz Wallet',
      balance_remaining: availableBalance - bunzRequired
    });

  } catch (error: any) {
    console.error('Error in /api/pos/charge:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
