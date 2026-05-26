import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get("wallet");

    if (!wallet) {
      return NextResponse.json({ error: "Missing wallet address" }, { status: 400 });
    }

    const profile = await prisma.profile.findUnique({
      where: { smart_wallet_address: wallet },
      include: {
        purchased_offers: {
          where: { status: "ACTIVE" },
          include: { offer: { include: { business: true } } },
          orderBy: { created_at: "desc" }
        },
        reservations: {
          where: { status: "ACTIVE" },
          include: { business: true },
          orderBy: { created_at: "desc" }
        }
      }
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      coupons: profile.purchased_offers,
      reservations: profile.reservations
    });
  } catch (error) {
    console.error("[GET_INVENTORY]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
