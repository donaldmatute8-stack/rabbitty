import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, transactions } from '@/db/schema';
import { eq, or, and, gte, sql } from 'drizzle-orm';
import crypto from 'crypto';

const DAILY_SPEND_CAP = 500;

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
    const availableBalance = (user.totalBunzEarned ?? 0) - (user.totalBunzSpent ?? 0);

    if (availableBalance < bunzRequired) {
      return NextResponse.json({ 
        message: `Saldo insuficiente. Requerido: ${bunzRequired}, Disponible: ${availableBalance}` 
      }, { status: 400 });
    }

    // Daily spend cap
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
    if (spentToday + bunzRequired > DAILY_SPEND_CAP) {
      return NextResponse.json({
        message: `Límite diario de ${DAILY_SPEND_CAP} Bunz alcanzado. Hoy has gastado ${spentToday}.`
      }, { status: 429 });
    }

    // Incrementar totalBunzSpent (no tocar totalBunzEarned — es contabilidad de por vida)
    await db.update(users)
      .set({ totalBunzSpent: (user.totalBunzSpent ?? 0) + bunzRequired })
      .where(eq(users.id, user.id));

    await db.insert(transactions).values({
      id: crypto.randomUUID(),
      userId: user.id,
      businessId: business_id || 'unknown',
      fiatAmount: -amount_usd,
      bunzMinted: -bunzRequired,
      status: 'CHARGED',
      txHash: `pos_${order_id}`,
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Pago procesado exitosamente via Bunz Wallet',
      balance_remaining: availableBalance - bunzRequired
    });

  } catch (error: any) {
    console.error('Error in /api/pos/charge:', error);
    return NextResponse.json({ error: 'Error interno del servidor', details: error.message }, { status: 500 });
  }
}
