import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, ownedBusinesses, transactions } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { parseTelegramUser, validateTelegramInitData } from '@/lib/telegramAuth';
import { recordLedgerTransaction, findLedgerEntry } from '@/lib/ledgerHelper';
import { sendEcosystemNotification } from '@/lib/push/notify';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { initData, businessId, bunzCost, title, idempotencyKey: clientKey } = await req.json();

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
    const idempotencyKey = `rdm_${clientKey || crypto.randomUUID()}`;
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
        const balance = (lockedUser.totalBunzEarned ?? 0) - (lockedUser.totalBunzSpent ?? 0);
        return { tx: null, newBalance: balance, idempotent: true };
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

      // H16-ECONOMIA (corrección 2026-11-02): la redención CONSUME el stock de
      // respaldo del negocio (inventario cumple la oferta que respaldó esos
      // Bunz) — ya NO se acredita (creaba disponibilidad sin respaldo nuevo = inflación)
      //
      // D-13 · Patrón condicional atómico (modelo §3): el respaldo se consume
      // SOLO si alcanza. La condición vive en el WHERE (sin check-then-act) y si
      // no devuelve fila la redención NO puede completarse → throw y se revierte
      // toda la transacción (los Bunz del Rabbitter no se debitan).
      // `GREATEST(0)` queda solo como protección secundaria de escritura.
      const consumed = await tx
        .update(ownedBusinesses)
        .set({ bunzBalance: sql`GREATEST(0, COALESCE(${ownedBusinesses.bunzBalance}, 0) - ${bunzCost})` })
        .where(
          and(
            eq(ownedBusinesses.id, businessId),
            sql`COALESCE(${ownedBusinesses.bunzBalance}, 0) >= ${bunzCost}`
          )
        )
        .returning({ remaining: ownedBusinesses.bunzBalance });

      if (consumed.length === 0) {
        throw new Error('BUSINESS_BACKING_INSUFFICIENT');
      }


      // Record authoritative Ledger entry
      await recordLedgerTransaction(
        {
          payerSubjectId: `usr_${user.id}`,
          payeeSubjectId: business.id,
          amount: bunzCost,
          type: 'SPEND',
          referenceId: appTx.id,
          idempotencyKey,
          metadata: { title, businessId, telegramId: user.telegramId },
        },
        tx
      );

      const newBalance = (updatedUser.totalBunzEarned ?? 0) - (updatedUser.totalBunzSpent ?? 0);
      return { tx: appTx, newBalance, idempotent: false };
    });

    if (!result.idempotent) {
      // 1. Notificación push al usuario que canjeó
      await sendEcosystemNotification({
        userId: user.id,
        title: '🎉 ¡Canje Exitoso!',
        message: `Has canjeado "${title}" en ${business.name}. Tu nuevo saldo es de ${result.newBalance.toLocaleString()} Bunz.`,
        type: 'REWARD',
        route: '/profile/wallet',
        pushData: { businessId: business.id, bunzCost, newBalance: result.newBalance },
        threadId: 'coupons',
      });

      // 2. Notificación push al dueño del negocio afiliado
      if (business.ownerId && business.ownerId !== user.id) {
        await sendEcosystemNotification({
          userId: business.ownerId,
          title: `🎁 ¡Canje Realizado en Caja! - ${business.name}`,
          message: `${user.firstName || user.username || 'Un cliente'} acaba de canjear "${title}" (${bunzCost.toLocaleString()} Bunz).`,
          type: 'AFFILIATE',
          route: '/business',
          pushData: { businessId: business.id, bunzCost, customerId: user.id },
          threadId: 'business_redemptions',
        });
      }
    }

    // Notify business owner via Telegram Bot
    if (botToken && business.ownerId) {
      try {
        const owner = await db.query.users.findFirst({ where: eq(users.id, business.ownerId) });
        if (owner?.telegramId) {
          const redeemMsg =
            `🎁 *¡Canje Realizado en Caja! - ${business.name}*\n\n` +
            `Un cliente canjeó: *${title}*\n` +
            `Bunz deducidos: *${bunzCost.toLocaleString()} Bunz*\n` +
            `Cliente: ${user.firstName || user.username || 'Rabbitter'}\n\n` +
            `_Verifica el beneficio entregado al cliente._`;

          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: owner.telegramId,
              text: redeemMsg,
              parse_mode: 'Markdown',
            }),
          });
        }
      } catch (notifyErr) {
        console.error('[REDEEM_NOTIFY_ERROR]', notifyErr);
      }
    }

    return NextResponse.json({ success: true, transaction: result.tx, newBalance: result.newBalance });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Internal server error';
    if (errorMsg === 'INSUFFICIENT_FUNDS') {
      return NextResponse.json({ error: 'Saldo insuficiente de Bunz' }, { status: 400 });
    }
    if (errorMsg === 'BUSINESS_BACKING_INSUFFICIENT') {
      return NextResponse.json(
        { error: 'Este negocio no tiene respaldo suficiente para este canje en este momento. Tus Bunz siguen intactos.' },
        { status: 409 }
      );
    }
    console.error('Redeem Error:', error);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
