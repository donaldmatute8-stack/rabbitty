import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAchievements } from "@/services/gamification";

export async function POST(req: NextRequest) {
  try {
    const { transactionId, affiliateWallet, finalFiatAmount, receiptPhotoBase64 } = await req.json();

    if (!transactionId || !affiliateWallet) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Authenticate affiliate
    const affiliate = await prisma.profile.findUnique({
      where: { smart_wallet_address: affiliateWallet },
      include: { business: true }
    });

    if (!affiliate || !affiliate.business) {
      return NextResponse.json({ error: "Affiliate not found or no business linked" }, { status: 404 });
    }

    const business = affiliate.business;

    // Get the pending transaction
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { business: true }
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    if (transaction.businessId !== business.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (transaction.status !== "PENDING") {
      return NextResponse.json({ error: "Transaction is not pending" }, { status: 400 });
    }

    // Recalculate bunz based on final amount or original amount
    const approvedAmount = finalFiatAmount || transaction.fiat_amount_claimed;
    const finalBunz = Math.floor(approvedAmount * (business.reward_percentage / 100));

    // Ensure business has enough minting credit
    if (business.minting_credit < finalBunz) {
      return NextResponse.json({ error: "Not enough minting credit" }, { status: 400 });
    }

    // Execute atomic transaction to prevent race conditions
    const result = await prisma.$transaction([
      // 1. Mark transaction as approved and save photo if any
      prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: "APPROVED",
          fiat_amount_approved: approvedAmount,
          bunz_amount: finalBunz,
          receipt_photo_base64: receiptPhotoBase64 || null
        }
      }),
      // 2. Decrement business minting credit
      prisma.business.update({
        where: { id: business.id },
        data: {
          minting_credit: { decrement: finalBunz }
        }
      }),
      // 3. Increment rabbitter bunz balance
      prisma.profile.update({
        where: { id: transaction.rabbitterProfileId },
        data: {
          bunz_balance: { increment: finalBunz }
        }
      })
    ]);

    const finalTx = result[0];

    // Run gamification logic asynchronously without blocking the response
    checkAchievements(transaction.rabbitterProfileId).catch(console.error);

    // Also notify the Rabbitter
    await prisma.notification.create({
      data: {
        profileId: transaction.rabbitterProfileId,
        title: "¡Ticket Aprobado!",
        message: `Tu consumo en ${business.name} fue verificado. ¡Has ganado ${finalBunz} Bunz!`,
        type: "SUCCESS"
      }
    });

    return NextResponse.json({ success: true, transaction: finalTx });
  } catch (error: any) {
    console.error("Error approving transaction:", error);
    return NextResponse.json({ error: "Failed to approve transaction" }, { status: 500 });
  }
}
