import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { walletAddress, offerId } = await req.json();

    if (!walletAddress || !offerId) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    // Run transaction
    const result = await prisma.$transaction(async (tx) => {
      const profile = await tx.profile.findUnique({ where: { smart_wallet_address: walletAddress } });
      if (!profile) throw new Error("Profile not found");

      const offer = await tx.offer.findUnique({ 
        where: { id: offerId },
        include: { business: true } 
      });
      if (!offer || !offer.is_active) throw new Error("Offer not available");

      // Check balance
      if (profile.bunz_balance < offer.bunz_price) {
        throw new Error("Insufficient Bunz balance");
      }

      // Check business daily limits
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let currentTaken = offer.business.daily_bunz_taken;
      if (offer.business.last_cap_reset < today) {
        currentTaken = 0;
        // Reset it in the DB
        await tx.business.update({
          where: { id: offer.business.id },
          data: { daily_bunz_taken: 0, last_cap_reset: new Date() }
        });
      }

      if (currentTaken + offer.bunz_price > offer.business.daily_bunz_cap) {
        throw new Error("El negocio ha alcanzado su límite diario de Bunz");
      }

      // Deduct balance from user
      await tx.profile.update({
        where: { id: profile.id },
        data: { bunz_balance: { decrement: offer.bunz_price } }
      });

      // Update business daily taken
      await tx.business.update({
        where: { id: offer.business.id },
        data: { daily_bunz_taken: { increment: offer.bunz_price } }
      });

      // Log the transaction history
      await tx.transaction.create({
        data: {
          rabbitterProfileId: profile.id,
          businessId: offer.business.id,
          fiat_amount_claimed: 0,
          fiat_amount_approved: 0,
          bunz_amount: offer.bunz_price,
          status: "APPROVED",
          type: "SPEND"
        }
      });

      // Create the Purchased Offer (Coupon)
      const qrCodeData = crypto.randomBytes(16).toString('hex');
      const purchasedOffer = await tx.purchasedOffer.create({
        data: {
          profileId: profile.id,
          offerId: offer.id,
          qr_code_data: qrCodeData,
          status: "ACTIVE"
        }
      });

      // Notify User
      await tx.notification.create({
        data: {
          profileId: profile.id,
          title: "¡Compra Exitosa!",
          message: `Adquiriste ${offer.title} en ${offer.business.name}. Revisa tu inventario.`,
          type: "SUCCESS"
        }
      });

      return purchasedOffer;
    });

    return NextResponse.json({ success: true, purchasedOffer: result });
  } catch (error: any) {
    console.error("[SPEND_ERROR]", error);
    return NextResponse.json({ error: error.message || "Failed to process spend" }, { status: 500 });
  }
}
