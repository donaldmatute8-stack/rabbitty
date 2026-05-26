import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { walletAddress, packageCreditAmount } = await req.json();

    if (!walletAddress || !packageCreditAmount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const profile = await prisma.profile.findUnique({
      where: { smart_wallet_address: walletAddress },
      include: { business: true }
    });

    if (!profile || !profile.business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Assign the new minting credit and set the business as active
    const updatedBusiness = await prisma.business.update({
      where: { id: profile.business.id },
      data: {
        minting_credit: {
          increment: packageCreditAmount
        },
        is_active: true
      }
    });

    return NextResponse.json({ success: true, business: updatedBusiness });
  } catch (error: any) {
    console.error("Error funding business:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
