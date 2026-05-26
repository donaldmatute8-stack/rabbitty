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
        transactions: {
          where: { status: "APPROVED" },
          include: { business: true },
          orderBy: { created_at: "desc" },
          take: 50
        }
      }
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const formattedHistory = profile.transactions.map((tx) => ({
      id: tx.id,
      name: tx.business.name,
      category: tx.business.category,
      amount: tx.type === "SPEND" ? `-${tx.bunz_amount}` : `+${tx.bunz_amount}`,
      type: tx.type === "SPEND" ? "spent" : "earned",
      date: tx.created_at.toISOString(),
      icon: getCategoryIcon(tx.business.category)
    }));

    return NextResponse.json({ success: true, history: formattedHistory });
  } catch (error) {
    console.error("[GET_HISTORY]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function getCategoryIcon(category: string) {
  const cat = category.toLowerCase();
  if (cat.includes("comida") || cat.includes("caf") || cat.includes("restaurante")) return "🍔";
  if (cat.includes("fit") || cat.includes("gym")) return "💪";
  if (cat.includes("tech") || cat.includes("tecno")) return "💻";
  if (cat.includes("belleza") || cat.includes("spa")) return "✨";
  return "🏷️";
}
