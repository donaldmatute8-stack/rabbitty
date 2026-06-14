import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, pendingVaults, transactions, ownedBusinesses } from "@/db/schema";
import { eq, and, gte, sql, or } from "drizzle-orm";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    // 1. Validate API Secret
    const authHeader = request.headers.get("authorization");
    const expectedSecret = process.env.RABBITTY_API_SECRET;
    
    if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { phone, amount_usd, order_id, business_id } = body;

    if (!phone || !amount_usd) {
      return NextResponse.json({ error: "Missing phone or amount_usd" }, { status: 400 });
    }

    let rewardRate = 0.20;
    if (business_id) {
      const [business] = await db.select({ rewardPercentage: ownedBusinesses.rewardPercentage })
        .from(ownedBusinesses)
        .where(eq(ownedBusinesses.id, business_id))
        .limit(1);
      if (business) {
        rewardRate = (business.rewardPercentage ?? 20) / 100;
      }
    }
    const bunzToMint = Math.floor(amount_usd * rewardRate);

    if (bunzToMint <= 0) {
      return NextResponse.json({ message: "Amount too low to generate Bunz" }, { status: 200 });
    }

    // 2. Fetch Business Inventory (atomic update)
    let hasEnoughInventory = true;
    let businessId = business_id || "unknown";
    if (business_id) {
      const result = await db.update(ownedBusinesses)
        .set({ bunzBalance: sql`bunz_balance - ${bunzToMint}` })
        .where(
          and(
            eq(ownedBusinesses.id, business_id),
            gte(ownedBusinesses.bunzBalance, bunzToMint)
          )
        )
        .returning({ bunzBalance: ownedBusinesses.bunzBalance });
      hasEnoughInventory = result.length > 0;
    }

    const expirationDate = new Date();
    expirationDate.setMonth(expirationDate.getMonth() + 3);

    // 3. Find User
    const conditions = [
      eq(users.phoneNumber, phone),
      eq(users.telegramId, phone)
    ];
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(phone)) {
      conditions.push(eq(users.id, phone));
    }

    const existingUserArray = await db.select().from(users).where(or(...conditions)).limit(1);
    const existingUser = existingUserArray[0];

    if (!hasEnoughInventory) {
      // Business is out of Bunz, queue it as WAITING_BUSINESS_RECHARGE for BOTH existing and new users
      await db.insert(pendingVaults).values({
        id: crypto.randomUUID(),
        phoneNumber: phone,
        bunzAmount: bunzToMint,
        orderId: order_id,
        businessId: businessId !== 'unknown' ? businessId : null,
        status: 'WAITING_BUSINESS_RECHARGE',
        expiresAt: expirationDate,
      });

      return NextResponse.json({ 
        success: true, 
        message: 'Reward queued pending business recharge', 
        bunz: bunzToMint,
        status: 'WAITING_BUSINESS_RECHARGE'
      });
    }

    if (existingUser) {
      // 4a. Existing User: Pay off offline debt first
      let remainingMint = bunzToMint;
      let newDebt = existingUser.pendingDebtBunz ?? 0;
      let newEarned = existingUser.totalBunzEarned;

      if (newDebt > 0) {
        const payoff = Math.min(newDebt, remainingMint);
        newDebt -= payoff;
        remainingMint -= payoff;
      }

      newEarned += remainingMint;

      await db.update(users)
        .set({ 
          totalBunzEarned: newEarned,
          pendingDebtBunz: newDebt
        })
        .where(eq(users.id, existingUser.id));

      await db.insert(transactions).values({
        id: crypto.randomUUID(),
        userId: existingUser.id,
        businessId: businessId,
        fiatAmount: amount_usd,
        bunzMinted: bunzToMint,
        status: 'MINTED',
      });

      return NextResponse.json({ 
        success: true, 
        message: 'Bunz minted to existing user (Debt adjusted if applicable)', 
        bunz: bunzToMint,
        userId: existingUser.id,
      });

    } else {
      // 4b. New User: Create Temporary Vault
      await db.insert(pendingVaults).values({
        id: crypto.randomUUID(),
        phoneNumber: phone,
        bunzAmount: bunzToMint,
        orderId: order_id,
        businessId: businessId !== 'unknown' ? businessId : null,
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
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
