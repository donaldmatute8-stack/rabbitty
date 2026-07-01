import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, ownedBusinesses, systemSettings } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { recordTreasuryEntry } from '@/lib/treasury';

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

    const business = await db.query.ownedBusinesses.findFirst({
      where: eq(ownedBusinesses.id, businessId),
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Get fee from settings
    const feeRow = await db.query.systemSettings.findFirst({
      where: eq(systemSettings.key, 'registration_fee'),
    });
    const feeAmount = parseInt(feeRow?.value || '5000');

    if (feeAmount <= 0) {
      return NextResponse.json({ success: true, message: 'No fee required' });
    }

    // Check business has enough bunz balance
    if ((business.bunzBalance || 0) < feeAmount) {
      return NextResponse.json({
        error: `Saldo insuficiente. Necesitas ${feeAmount.toLocaleString()} Bunz para pagar la cuota. Tienes ${(business.bunzBalance || 0).toLocaleString()} Bunz.`,
      }, { status: 400 });
    }

    // Deduct from business bunz balance
    await db.update(ownedBusinesses)
      .set({ bunzBalance: sql`${ownedBusinesses.bunzBalance} - ${feeAmount}` })
      .where(eq(ownedBusinesses.id, business.id));

    // Record in treasury
    await recordTreasuryEntry({
      concept: 'Cuota de registro',
      amount: feeAmount,
      type: 'fee',
      referenceId: business.id,
      notes: `Pago de cuota por ${business.name} (${business.package || 'Sin paquete'})`,
    });

    return NextResponse.json({
      success: true,
      message: `Cuota de ${feeAmount.toLocaleString()} Bunz pagada exitosamente`,
      feePaid: feeAmount,
    });
  } catch (error) {
    console.error('Pay Fee Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
