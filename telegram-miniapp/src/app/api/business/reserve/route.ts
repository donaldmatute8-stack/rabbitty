import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { walletAddress, businessId, reserveAmount } = await req.json();

    if (!walletAddress || !businessId || !reserveAmount) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const profile = await tx.profile.findUnique({ where: { smart_wallet_address: walletAddress } });
      if (!profile) throw new Error("Profile not found");

      const business = await tx.business.findUnique({ where: { id: businessId } });
      if (!business || !business.is_active) throw new Error("Business not available");

      // Balance check
      if (profile.bunz_balance < reserveAmount) {
        throw new Error("Saldo insuficiente para reservar esta cantidad de Bunz.");
      }

      // Check business limits
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let currentTaken = business.daily_bunz_taken;
      if (business.last_cap_reset < today) {
        currentTaken = 0;
        await tx.business.update({
          where: { id: business.id },
          data: { daily_bunz_taken: 0, last_cap_reset: new Date() }
        });
      }

      if (currentTaken + reserveAmount > business.daily_bunz_cap) {
        throw new Error("El límite diario de este negocio no soporta esta reserva de Bunz.");
      }

      // Create reservation (expires in 2 hours)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 2);

      const reservation = await tx.reservation.create({
        data: {
          profileId: profile.id,
          businessId: business.id,
          reserved_bunz: reserveAmount,
          expires_at: expiresAt,
          status: "ACTIVE"
        }
      });

      // Update business daily cap temporarily
      await tx.business.update({
        where: { id: business.id },
        data: { daily_bunz_taken: { increment: reserveAmount } }
      });

      // Notify Business (If we had a way to push to business dashboard, but here we just store an info notif for the rabbitter)
      await tx.notification.create({
        data: {
          profileId: profile.id,
          title: "Reserva Confirmada",
          message: `Has reservado cupo para gastar ${reserveAmount} Bunz en ${business.name}. Tienes 2 horas para llegar.`,
          type: "INFO"
        }
      });

      return reservation;
    });

    return NextResponse.json({ success: true, reservation: result });
  } catch (error: any) {
    console.error("[RESERVE_ERROR]", error);
    return NextResponse.json({ error: error.message || "Failed to reserve" }, { status: 500 });
  }
}
