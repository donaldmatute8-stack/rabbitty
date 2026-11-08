import { NextResponse } from "next/server";
import { db } from "@/db";
import { transactions, users, ownedBusinesses, systemSettings } from "@/db/schema";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/serverAuth";

export async function GET(req: Request) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get("businessId");
    const includeHistory = searchParams.get("includeHistory") === "1";

    // Tras un reset de economía, el dashboard muestra solo lo posterior al corte.
    // El historial sigue disponible con ?includeHistory=1.
    let resetAt: Date | null = null;
    try {
      const [resetRow] = await db
        .select({ value: systemSettings.value })
        .from(systemSettings)
        .where(eq(systemSettings.key, "bunz_economy_reset_at"))
        .limit(1);
      if (resetRow?.value) {
        const parsed = new Date(resetRow.value);
        if (!Number.isNaN(parsed.getTime())) resetAt = parsed;
      }
    } catch {
      // Sin marcador: se comporta como antes.
    }
    const businessScope = (bid: string) =>
      resetAt && !includeHistory
        ? and(eq(transactions.businessId, bid), gte(transactions.createdAt, resetAt))
        : eq(transactions.businessId, bid);

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
        .where(businessScope(businessId))
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
        .where(businessScope(business.id))
        .orderBy(desc(transactions.createdAt))
        .limit(20);
    }

    // Totales vigentes desde el último reset de economía (no mezclar con historial).
    let currentTotals: {
      delivered: number;
      redeemed: number;
      count: number;
      clients: number;
    } | null = null;
    const bizForTotals = businessId || (await db.query.ownedBusinesses.findFirst({
      where: eq(ownedBusinesses.ownerId, caller.id),
    }))?.id;
    if (bizForTotals) {
      try {
        const scope = resetAt
          ? and(eq(transactions.businessId, bizForTotals), gte(transactions.createdAt, resetAt))
          : eq(transactions.businessId, bizForTotals);
        const [agg] = await db
          .select({
            delivered: sql<number>`COALESCE(SUM(${transactions.bunzMinted}) FILTER (WHERE ${transactions.status} = 'MINTED' OR ${transactions.status} = 'COMPLETED'), 0)::int`,
            redeemed: sql<number>`COALESCE(-SUM(${transactions.bunzMinted}) FILTER (WHERE ${transactions.status} = 'CHARGED'), 0)::int`,
            count: sql<number>`COUNT(*)::int`,
            clients: sql<number>`COUNT(DISTINCT ${transactions.userId})::int`,
          })
          .from(transactions)
          .where(scope);
        currentTotals = {
          delivered: Number(agg?.delivered ?? 0),
          redeemed: Number(agg?.redeemed ?? 0),
          count: Number(agg?.count ?? 0),
          clients: Number(agg?.clients ?? 0),
        };
      } catch (aggErr) {
        console.warn("[business/transactions] currentTotals falló:", aggErr);
      }
    }

    return NextResponse.json({
      success: true,
      transactions: rows,
      resetAt: resetAt?.toISOString() ?? null,
      currentTotals,
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
  }
}
