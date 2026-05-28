import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { transactions, ownedBusinesses } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const telegramId = searchParams.get("telegramId");

    if (!telegramId) {
      return NextResponse.json({ error: "Missing telegramId" }, { status: 400 });
    }

    // Get user's transactions joined with business info
    const rows = await db
      .select({
        id: transactions.id,
        fiatAmount: transactions.fiatAmount,
        bunzMinted: transactions.bunzMinted,
        status: transactions.status,
        createdAt: transactions.createdAt,
        businessName: ownedBusinesses.name,
        businessCategory: ownedBusinesses.category,
      })
      .from(transactions)
      .innerJoin(ownedBusinesses, eq(transactions.businessId, ownedBusinesses.id))
      .where(eq(transactions.status, "MINTED"))
      .orderBy(desc(transactions.createdAt))
      .limit(50);

    const formattedHistory = rows.map((tx) => ({
      id: tx.id,
      name: tx.businessName,
      category: tx.businessCategory,
      amount: `+${tx.bunzMinted}`,
      type: "earned",
      date: tx.createdAt?.toISOString() ?? "",
      icon: getCategoryIcon(tx.businessCategory),
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
