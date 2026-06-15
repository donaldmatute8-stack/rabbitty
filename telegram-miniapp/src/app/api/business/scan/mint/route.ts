import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, ownedBusinesses, transactions, levels } from "@/db/schema";
import { eq, and, or, sql } from "drizzle-orm";
import { processReferralAndNotifications } from '@/lib/referralLogic';
import { awardHops, evaluateHatTricks } from '@/lib/gamificationLogic';
import { sendToOracle } from '@/lib/oracle-client';
import crypto from 'crypto';
import { z } from 'zod';

const mintSchema = z.object({
  telegramId: z.string().min(1),
  businessId: z.string().uuid(),
  fiatAmount: z.number().positive(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = mintSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ error: "Datos de entrada inválidos.", details: result.error.format() }, { status: 400 });
    }
    
    const { telegramId, businessId, fiatAmount } = result.data;

    const business = await db.query.ownedBusinesses.findFirst({
      where: eq(ownedBusinesses.id, businessId)
    });

    if (!business) {
      return NextResponse.json({ error: "Negocio no encontrado o no autorizado." }, { status: 403 });
    }

    const conditions = [
      eq(users.telegramId, telegramId),
      eq(users.tonWalletAddress, telegramId)
    ];
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(telegramId)) {
      conditions.push(eq(users.id, telegramId));
    }

    const customer = await db.query.users.findFirst({
      where: or(...conditions)
    });

    if (!customer) {
      return NextResponse.json({ error: "El usuario no existe o no está registrado." }, { status: 404 });
    }

    // Check multiplier based on user level
    let multiplier = 1.0;
    if (customer.levelId) {
      const level = await db.query.levels.findFirst({ where: eq(levels.id, customer.levelId) });
      if (level) multiplier = level.bunzMultiplier;
    }

    const bunzReward = Math.floor(fiatAmount * (business.rewardPercentage / 100) * multiplier);

    if (bunzReward <= 0) {
      return NextResponse.json({ error: "El monto es muy bajo para generar una recompensa en Bunz." }, { status: 400 });
    }

    // Determine if it's a new business for the user
    const previousTransaction = await db.query.transactions.findFirst({
      where: and(eq(transactions.userId, customer.id), eq(transactions.businessId, business.id))
    });
    const isNewBusiness = !previousTransaction;

    // Insert transaction record
    await db.insert(transactions).values({
      userId: customer.id,
      businessId: business.id,
      fiatAmount,
      bunzMinted: bunzReward,
      status: "MINTED",
    });

    // Update customer balance atómicamente
    await db.update(users)
      .set({ totalBunzEarned: sql`COALESCE(${users.totalBunzEarned}, 0) + ${bunzReward}` })
      .where(eq(users.id, customer.id));

    // Trigger referral and notifications (EARN event)
    await processReferralAndNotifications(customer.id, 'EARN');

    // Gamification Engine
    await awardHops(customer.id, isNewBusiness);
    await evaluateHatTricks(customer.id, { type: 'TOTAL_VISITS', value: 1, category: business.category });

    // Oracle on-chain mint (fire-and-forget)
    const receiptHash = crypto.createHash('sha256').update(`${businessId}-${customer.id}-${fiatAmount}-${Date.now()}`).digest('hex');
    sendToOracle({
      businessAddress: businessId,
      userAddress: customer.id,
      purchaseAmount: fiatAmount,
      receiptHash,
    });

    return NextResponse.json({
      success: true,
      message: "Recompensa otorgada exitosamente.",
      bunzRewarded: bunzReward
    });

  } catch (error: any) {
    console.error("[MINT_ERROR]", error);
    return NextResponse.json({ error: error.message || "Error procesando la recompensa" }, { status: 500 });
  }
}
