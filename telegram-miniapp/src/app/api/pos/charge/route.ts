import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, transactions, ownedBusinesses } from '@/db/schema';
import { eq, or, and, gte, sql } from 'drizzle-orm';
import { recordLedgerTransaction, findLedgerEntry } from '@/lib/ledgerHelper';
import { sendEcosystemNotification } from '@/lib/push/notify';
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

    const bunzRequired = Math.round(amount_usd);
    const preAvailable = Math.max(0, (user.totalBunzEarned ?? 0) - (user.totalBunzSpent ?? 0));

    if (preAvailable < bunzRequired && !order_id) {
      return NextResponse.json({ error: 'Saldo insuficiente de Bunz' }, { status: 402 });
    }

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
    
    // Cap diario real: bloquea el gasto vivo que lo exceda (offline sync queda exenta
    // para no bloquear la conciliación del restaurante)
    if (spentToday + bunzRequired > DAILY_SPEND_CAP && !body.is_offline_sync) {
      return NextResponse.json({ error: `Límite diario de gasto excedido (cap ${DAILY_SPEND_CAP} Bunz). Intenta mañana.` }, { status: 402 });
    }

    // Stable idempotency key: prefer a client-supplied key, then the POS order id.
    const idempotencyKey = `pos_chg_${body.idempotency_key || body.idempotencyKey || order_id || crypto.randomUUID()}`;

    // Update user balances atomically (spent + debt) and write to Ledger
    const result = await db.transaction(async (tx) => {
      const [lockedUser] = await tx
        .select()
        .from(users)
        .where(eq(users.id, user.id))
        .for('update');

      if (!lockedUser) {
        throw new Error('USER_NOT_FOUND');
      }

      // Idempotent replay: a re-delivered request must not double-charge.
      const prior = await findLedgerEntry(idempotencyKey, tx);
      const availableBalance = Math.max(0, (lockedUser.totalBunzEarned ?? 0) - (lockedUser.totalBunzSpent ?? 0));
      if (prior) {
        return { balanceRemaining: availableBalance, idempotent: true };
      }

      // Authoritative balance is recomputed from the LOCKED row.
      if (availableBalance < bunzRequired && !order_id) {
        throw new Error('INSUFFICIENT_BUNZ');
      }

      const bunzToSpendNormally = Math.min(availableBalance, bunzRequired);
      const deficit = bunzRequired - bunzToSpendNormally;

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

      await recordLedgerTransaction(
        {
          branchId: business_id || null,
          payerSubjectId: `usr_${user.id}`,
          payeeSubjectId: business_id || 'POS',
          amount: bunzRequired,
          type: 'SPEND',
          referenceId: order_id || txId,
          idempotencyKey,
          metadata: { orderId: order_id, amountUsd: amount_usd, telegramId: user.telegramId },
        },
        tx
      );

      return { balanceRemaining: availableBalance - bunzToSpendNormally, idempotent: false };
    });

    if (!result.idempotent) {
      // Resolver nombre del negocio afiliado para el mensaje
      let businessName = 'tu compra';
      if (business_id) {
        const [biz] = await db
          .select({ name: ownedBusinesses.name })
          .from(ownedBusinesses)
          .where(eq(ownedBusinesses.id, business_id))
          .limit(1);
        if (biz?.name) businessName = biz.name;
      }

      await sendEcosystemNotification({
        userId: user.id,
        title: '💸 Pago realizado con éxito',
        message: `Has gastado ${bunzRequired.toLocaleString()} Bunz en ${businessName}. Tu saldo actual es de ${result.balanceRemaining.toLocaleString()} Bunz.`,
        type: 'SYSTEM',
        route: '/profile/wallet',
        pushData: { businessId: business_id, bunzSpent: bunzRequired, newBalance: result.balanceRemaining, orderId: order_id },
        threadId: 'spending',
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Pago procesado exitosamente via Bunz Wallet',
      balance_remaining: result.balanceRemaining
    });

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : '';
    if (errorMsg === 'INSUFFICIENT_BUNZ') {
      return NextResponse.json({ error: 'Saldo insuficiente de Bunz' }, { status: 402 });
    }
    console.error('Error in /api/pos/charge:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
