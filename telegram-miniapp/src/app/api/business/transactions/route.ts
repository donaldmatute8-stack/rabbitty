import { NextResponse } from "next/server";
import { db } from "@/db";
import { transactions, users, ownedBusinesses } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const telegramId = searchParams.get("telegramId");
    const businessId = searchParams.get("businessId");

    if (!telegramId && !businessId) {
      return NextResponse.json({ error: "Missing identifier" }, { status: 400 });
    }

    let rows;

    if (businessId) {
      rows = await db
        .select({
          id: transactions.id,
          fiatAmount: transactions.fiatAmount,
          bunzMinted: transactions.bunzMinted,
          status: transactions.status,
          createdAt: transactions.createdAt,
          userFirstName: users.firstName,
          userTelegramId: users.telegramId,
        })
        .from(transactions)
        .innerJoin(users, eq(transactions.userId, users.id))
        .where(eq(transactions.businessId, businessId))
        .orderBy(desc(transactions.createdAt))
        .limit(20);
    } else {
      // Find business by owner telegramId
      const owner = await db.query.users.findFirst({ where: eq(users.telegramId, telegramId!) });
      if (!owner) return NextResponse.json({ error: "User not found" }, { status: 404 });

      const business = await db.query.ownedBusinesses.findFirst({
        where: eq(ownedBusinesses.ownerId, owner.id)
      });
      if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

      rows = await db
        .select({
          id: transactions.id,
          fiatAmount: transactions.fiatAmount,
          bunzMinted: transactions.bunzMinted,
          status: transactions.status,
          createdAt: transactions.createdAt,
          userFirstName: users.firstName,
          userTelegramId: users.telegramId,
        })
        .from(transactions)
        .innerJoin(users, eq(transactions.userId, users.id))
        .where(eq(transactions.businessId, business.id))
        .orderBy(desc(transactions.createdAt))
        .limit(20);
    }

    return NextResponse.json({ success: true, transactions: rows });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
  }
}
