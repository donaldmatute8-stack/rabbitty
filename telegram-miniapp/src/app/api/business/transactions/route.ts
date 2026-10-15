import { NextResponse } from "next/server";
import { db } from "@/db";
import { transactions, users, ownedBusinesses } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/serverAuth";

export async function GET(req: Request) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get("businessId");

    let rows;

    if (businessId) {
      const business = await db.query.ownedBusinesses.findFirst({
        where: eq(ownedBusinesses.id, businessId),
      });

      if (!business) {
        return NextResponse.json({ error: "Business not found" }, { status: 404 });
      }

      if (business.ownerId !== caller.id && caller.role !== 'ADMIN') {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }

      rows = await db
        .select({
          id: transactions.id,
          userId: transactions.userId,
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
      const business = await db.query.ownedBusinesses.findFirst({
        where: eq(ownedBusinesses.ownerId, caller.id)
      });
      if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

      rows = await db
        .select({
          id: transactions.id,
          userId: transactions.userId,
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
