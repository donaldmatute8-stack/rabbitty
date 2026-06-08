import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, ownedBusinesses, transactions } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const { telegramId, businessId, fiatAmount } = await req.json();

    if (!telegramId || !businessId || !fiatAmount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.telegramId, telegramId)
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const business = await db.query.ownedBusinesses.findFirst({
      where: eq(ownedBusinesses.id, businessId)
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const bunzAmount = Math.floor(fiatAmount * (business.rewardPercentage / 100));

    const [transaction] = await db.insert(transactions).values({
      userId: user.id,
      businessId: business.id,
      fiatAmount,
      bunzMinted: bunzAmount,
      status: "PENDING"
    }).returning();

    return NextResponse.json({ success: true, transaction });
  } catch (error) {
    console.error("Error creating claim:", error);
    return NextResponse.json({ error: "Failed to create claim" }, { status: 500 });
  }
}
