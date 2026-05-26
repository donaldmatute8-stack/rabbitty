import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get("wallet");

    if (!wallet) {
      return NextResponse.json({ error: "Missing wallet address" }, { status: 400 });
    }

    const affiliate = await prisma.profile.findUnique({
      where: { smart_wallet_address: wallet },
      include: { business: true }
    });

    if (!affiliate || !affiliate.business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const transactions = await prisma.transaction.findMany({
      where: { businessId: affiliate.business.id },
      include: {
        rabbitter: {
          select: { first_name: true, bunz_balance: true }
        }
      },
      orderBy: { created_at: 'desc' },
      take: 20
    });

    return NextResponse.json({ success: true, transactions });
  } catch (error: any) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
  }
}
