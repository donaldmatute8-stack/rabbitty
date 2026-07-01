import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, ownedBusinesses, transactions } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

export async function POST(req: Request) {
  try {
    const { telegramId, businessId, bunzAmount } = await req.json();

    if (!telegramId || !businessId || !bunzAmount || bunzAmount <= 0) {
      return NextResponse.json({ error: 'Missing or invalid required fields' }, { status: 400 });
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

    // Check credit limit
    if (business.creditLimit > 0 && (business.creditUsed + bunzAmount) > business.creditLimit) {
      return NextResponse.json({
        error: `El negocio ha alcanzado su límite de crédito de minting (${business.creditLimit.toLocaleString()} Bunz). Contacta a soporte para aumentarlo.`
      }, { status: 400 });
    }

    // Deduct from credit
    await db.update(ownedBusinesses)
      .set({ creditUsed: sql`${ownedBusinesses.creditUsed} + ${bunzAmount}` })
      .where(eq(ownedBusinesses.id, business.id));

    // Add to pending debt + award Bunz immediately (credit flow)
    const [updatedUser] = await db
      .update(users)
      .set({
        totalBunzEarned: sql`COALESCE(${users.totalBunzEarned}, 0) + ${bunzAmount}`,
        pendingDebtBunz: sql`COALESCE(${users.pendingDebtBunz}, 0) + ${bunzAmount}`,
      })
      .where(eq(users.id, user.id))
      .returning();

    const [tx] = await db.insert(transactions).values({
      userId: user.id,
      businessId,
      fiatAmount: 0,
      bunzMinted: bunzAmount,
      status: 'MINTED',
    }).returning();

    return NextResponse.json({
      success: true,
      bunzAwarded: bunzAmount,
      newBalance: updatedUser.totalBunzEarned,
      pendingDebt: updatedUser.pendingDebtBunz,
      transactionId: tx.id,
    });
  } catch (error) {
    console.error('Credit Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
