import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, ownedBusinesses, systemSettings } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { recordTreasuryEntry } from '@/lib/treasury';
import { recordLedgerTransaction, findLedgerEntry } from '@/lib/ledgerHelper';
import { getAuthenticatedUser } from '@/lib/serverAuth';

export async function POST(req: Request) {
  try {
    const { telegramId, businessId, idempotencyKey: clientKey } = await req.json();

    if (!businessId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    // Resolve the caller: authenticated session first, or the server-to-server
    // shared secret (which may pass telegramId directly). A raw client-supplied
    // telegramId is never trusted on its own.
    const caller = await getAuthenticatedUser(req);
    const authHeader = req.headers.get('authorization');
    const expectedSecret = process.env.RABBITTY_API_SECRET;
    const serverAuthed = !!expectedSecret && authHeader === `Bearer ${expectedSecret}`;

    let user;

    if (caller) {
      user = await db.query.users.findFirst({ where: eq(users.id, caller.id) });
    } else if (serverAuthed && telegramId) {
      user = await db.query.users.findFirst({ where: eq(users.telegramId, telegramId.toString()) });
    } else {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

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

    const idempotencyKey = `fee_${clientKey || `${businessId}_${feeAmount}`}`;

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

      // Only the business owner or a platform admin may pay the business fee.
      if (business.ownerId !== user.id && user.role !== 'ADMIN') {
        throw new Error('NOT_AUTHORIZED');
      }

      const prior = await findLedgerEntry(idempotencyKey, tx);
      if (prior) {
        return;
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

      // Record in treasury log (inside the same transaction)
      await recordTreasuryEntry({
        concept: 'Cuota de registro',
        amount: feeAmount,
        type: 'fee',
        referenceId: business.id,
        notes: `Pago de cuota por ${business.name} (${business.package || 'Sin paquete'})`,
      }, tx);
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
    if (error?.message === 'NOT_AUTHORIZED') {
      return NextResponse.json({ error: 'No autorizado para pagar la cuota de este negocio.' }, { status: 403 });
    }
    console.error('Pay Fee Error:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
