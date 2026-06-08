import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, pendingVaults, transactions, ownedBusinesses } from '@/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    // 1. Validate API Secret
    const authHeader = request.headers.get('authorization');
    const expectedSecret = process.env.RABBITTY_API_SECRET;
    
    if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { phone, amount_usd, order_id, business_id } = body;

    if (!phone || !amount_usd) {
      return NextResponse.json({ error: 'Missing phone or amount_usd' }, { status: 400 });
    }

    const globalRewardRate = 0.20; 
    const bunzToMint = Math.floor(amount_usd * globalRewardRate);

    if (bunzToMint <= 0) {
      return NextResponse.json({ message: 'Amount too low to generate Bunz' }, { status: 200 });
    }

    // 2. Buscar si el usuario existe por teléfono
    const existingUserArray = await db.select().from(users).where(eq(users.phoneNumber, phone)).limit(1);
    const existingUser = existingUserArray[0];

    if (existingUser) {
      // 3a. Usuario registrado: Mintear Bunz a su balance real
      await db.update(users)
        .set({ totalBunzEarned: existingUser.totalBunzEarned + bunzToMint })
        .where(eq(users.id, existingUser.id));

      await db.insert(transactions).values({
        id: crypto.randomUUID(),
        userId: existingUser.id,
        businessId: business_id || 'unknown',
        fiatAmount: amount_usd,
        bunzMinted: bunzToMint,
        status: 'MINTED',
      });

      return NextResponse.json({ 
        success: true, 
        message: 'Bunz minted to existing user', 
        bunz: bunzToMint,
        userId: existingUser.id,
      });

    } else {
      // 3b. Usuario NO registrado: Crear Bóveda Temporal (expira en 3 meses)
      const expirationDate = new Date();
      expirationDate.setMonth(expirationDate.getMonth() + 3); // 3 months from now

      await db.insert(pendingVaults).values({
        id: crypto.randomUUID(),
        phoneNumber: phone,
        bunzAmount: bunzToMint,
        orderId: order_id,
        status: 'PENDING',
        expiresAt: expirationDate,
      });

      return NextResponse.json({ 
        success: true, 
        message: 'Bunz saved to temporary vault', 
        bunz: bunzToMint,
        expiresAt: expirationDate
      });
    }

  } catch (error: any) {
    console.error('Error in /api/pos/reward:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
