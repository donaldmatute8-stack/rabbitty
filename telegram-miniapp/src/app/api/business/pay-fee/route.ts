import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, ownedBusinesses, systemSettings } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { recordTreasuryEntry } from '@/lib/treasury';
import { recordLedgerTransaction } from '@/lib/ledgerHelper';

export async function POST(req: Request) {
  try {
    const { telegramId, businessId } = await req.json();

    if (!telegramId || !businessId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.telegramId, telegramId.toString()),
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get fee from settings
    const feeRow = await db.query.systemSettings.findFirst({
      where: eq(systemSettings.key, 'registration_fee'),
    });
    const feeAmount = parseInt(feeRow?.value || '5000');

    if (feeAmount <= 0) {
      return NextResponse.json({ success: true, message: 'No fee required' });
    }

    // Atomic SQL transaction with row lock and authoritative Ledger entry
    await db.transaction(async (tx) => {
      const [business] = await tx
        .select()
        .from(ownedBusinesses)
        .where(eq(ownedBusinesses.id, businessId))
        .for('update');

      if (!business) {
        throw new Error('BUSINESS_NOT_FOUND');
      }

      if ((business.bunzBalance || 0) < feeAmount) {
        throw new Error('INSUFFICIENT_BUNZ_BALANCE');
      }

      // Deduct from business bunz balance
      await tx
        .update(ownedBusinesses)
        .set({ bunzBalance: sql`${ownedBusinesses.bunzBalance} - ${feeAmount}` })
        .where(eq(ownedBusinesses.id, business.id));

      // Record in authoritative Ledger
      const idempotencyKey = `fee_${business.id}_${Date.now()}`;
      await recordLedgerTransaction(
        {
          branchId: business.id,
          payerSubjectId: business.id,
          payeeSubjectId: 'TREASURY',
          amount: feeAmount,
          type: 'BURN',
          referenceId: business.id,
          idempotencyKey,
          metadata: { concept: 'Cuota de registro', businessName: business.name },
        },
        tx
      );

      // Record in treasury log
      await recordTreasuryEntry({
        concept: 'Cuota de registro',
        amount: feeAmount,
        type: 'fee',
        referenceId: business.id,
        notes: `Pago de cuota por ${business.name} (${business.package || 'Sin paquete'})`,
      });
    });

    return NextResponse.json({
      success: true,
      message: `Cuota de ${feeAmount.toLocaleString()} Bunz pagada exitosamente`,
      feePaid: feeAmount,
    });
  } catch (error: any) {
    if (error?.message === 'INSUFFICIENT_BUNZ_BALANCE') {
      return NextResponse.json({
        error: 'Saldo insuficiente de Bunz para pagar la cuota.',
      }, { status: 400 });
    }
    console.error('Pay Fee Error:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
