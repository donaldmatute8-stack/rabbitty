import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { rabbitterWallet, businessId, fiatAmount } = await req.json();

    if (!rabbitterWallet || !businessId || !fiatAmount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Get the rabbitter profile
    const rabbitter = await prisma.profile.findUnique({
      where: { smart_wallet_address: rabbitterWallet }
    });

    if (!rabbitter) {
      return NextResponse.json({ error: "Rabbitter profile not found" }, { status: 404 });
    }

    // Get the business to calculate bunz
    const business = await prisma.business.findUnique({
      where: { id: businessId }
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Calculate reward (e.g. 15% of $500 = 75)
    const bunzAmount = Math.floor(fiatAmount * (business.reward_percentage / 100));

    // Create the pending transaction
    const transaction = await prisma.transaction.create({
      data: {
        businessId: business.id,
        rabbitterProfileId: rabbitter.id,
        fiat_amount_claimed: fiatAmount,
        bunz_amount: bunzAmount,
        status: "PENDING"
      }
    });

    return NextResponse.json({ success: true, transaction });
  } catch (error: any) {
    console.error("Error creating claim:", error);
    return NextResponse.json({ error: "Failed to create claim" }, { status: 500 });
  }
}
