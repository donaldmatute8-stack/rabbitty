import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { email, smart_wallet_address, signer_wallet, referral_code: usedRef } = await req.json();

    if (!email || !smart_wallet_address) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    
    // For TON, we use the same address for both fields to keep backward compatibility
    const finalSignerWallet = signer_wallet || smart_wallet_address;

    // Check if profile exists
    const existing = await prisma.profile.findUnique({ where: { email } });

    if (existing) {
      // Update wallet if changed
      const profile = await prisma.profile.update({
        where: { email },
        data: { smart_wallet_address, signer_wallet: finalSignerWallet }
      });
      return NextResponse.json({ profile }, { status: 200 });
    }

    // New User Creation
    // Generate a unique 6 char referral code
    const newRefCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    let inviterId = null;
    let pendingBonus = 0;

    // Check if usedRef is valid
    if (usedRef) {
      const inviter = await prisma.profile.findUnique({ where: { referral_code: usedRef } });
      if (inviter) {
        inviterId = inviter.id;
        pendingBonus = 50; // 50 Bunz pending for both
        
        // Grant bonus to inviter
        await prisma.profile.update({
          where: { id: inviter.id },
          data: { pending_bunz: { increment: 50 } }
        });

        // Also create a notification for the inviter
        await prisma.notification.create({
          data: {
            profileId: inviter.id,
            title: "¡Nuevo Referido!",
            message: "Alguien se registró con tu código. ¡Has ganado 50 Bunz pendientes!",
            type: "SUCCESS"
          }
        });
      }
    }

    const profile = await prisma.profile.create({
      data: {
        email,
        smart_wallet_address,
        signer_wallet: finalSignerWallet,
        role: "RABBITTER",
        referral_code: newRefCode,
        referred_by_id: inviterId,
        pending_bunz: pendingBonus
      },
    });

    // Create welcome notification
    await prisma.notification.create({
      data: {
        profileId: profile.id,
        title: "¡Bienvenido a Rabbitty!",
        message: pendingBonus > 0 ? "Empezaste con 50 Bunz pendientes gracias a tu amigo. ¡Sube de nivel para gastarlos!" : "¡Sube de nivel consumiendo para ganar más recompensas!",
        type: "INFO"
      }
    });

    return NextResponse.json({ profile }, { status: 200 });
  } catch (error) {
    console.error("[REGISTER_PROFILE]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
