import { NextResponse } from "next/server";
import { db } from "@/db";
import { ownedBusinesses, ledgerEntries } from "@/db/schema";
import { eq, or, and, sql, desc } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/serverAuth";

export async function GET(req: Request) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const businessIdParam = searchParams.get("businessId");

    let business;
    if (businessIdParam) {
      business = await db.query.ownedBusinesses.findFirst({
        where: eq(ownedBusinesses.id, businessIdParam),
      });
    } else {
      business = await db.query.ownedBusinesses.findFirst({
        where: eq(ownedBusinesses.ownerId, caller.id),
      });
    }

    if (!business) {
      return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
    }

    if (business.ownerId !== caller.id && caller.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const bId = business.id;

    // 1. Immutable ledger aggregates for this business
    // Outflows (rewards granted / mints): payerSubjectId === bId
    const [rewardedAgg] = await db
      .select({
        totalRewarded: sql<number>`COALESCE(SUM(${ledgerEntries.amount}), 0)`,
        countRewarded: sql<number>`COUNT(*)`,
      })
      .from(ledgerEntries)
      .where(
        and(
          eq(ledgerEntries.payerSubjectId, bId),
          eq(ledgerEntries.type, "EARN")
        )
      );

    // Inflows (redemptions / payments received / stock returned): payeeSubjectId === bId
    const [redeemedAgg] = await db
      .select({
        totalRedeemed: sql<number>`COALESCE(SUM(${ledgerEntries.amount}), 0)`,
        countRedeemed: sql<number>`COUNT(*)`,
      })
      .from(ledgerEntries)
      .where(
        and(
          eq(ledgerEntries.payeeSubjectId, bId),
          or(
            eq(ledgerEntries.type, "SPEND"),
            eq(ledgerEntries.type, "TRANSFER")
          )
        )
      );

    const totalRewarded = Number(rewardedAgg?.totalRewarded || 0);
    const countRewarded = Number(rewardedAgg?.countRewarded || 0);
    const totalRedeemed = Number(redeemedAgg?.totalRedeemed || 0);
    const countRedeemed = Number(redeemedAgg?.countRedeemed || 0);

    const creditLimit = Number(business.creditLimit || 0);
    const creditUsed = Number(business.creditUsed || 0);
    const remainingInventory = creditLimit > 0 ? Math.max(0, creditLimit - creditUsed) : Infinity;

    // Needs recharge warning if inventory remaining is below 15% of limit
    const isLowInventory = creditLimit > 0 && remainingInventory <= creditLimit * 0.15;

    // 2. Query recent ledger entries involving this business
    const entries = await db
      .select({
        id: ledgerEntries.id,
        payerSubjectId: ledgerEntries.payerSubjectId,
        payeeSubjectId: ledgerEntries.payeeSubjectId,
        amount: ledgerEntries.amount,
        type: ledgerEntries.type,
        referenceId: ledgerEntries.referenceId,
        metadata: ledgerEntries.metadata,
        createdAt: ledgerEntries.createdAt,
      })
      .from(ledgerEntries)
      .where(
        or(
          eq(ledgerEntries.payerSubjectId, bId),
          eq(ledgerEntries.payeeSubjectId, bId)
        )
      )
      .orderBy(desc(ledgerEntries.createdAt))
      .limit(30);

    // Collect user IDs from payer/payee to hydrate names
    const userIds = new Set<string>();
    for (const e of entries) {
      if (e.payerSubjectId.startsWith("usr_")) {
        userIds.add(e.payerSubjectId.replace("usr_", ""));
      }
      if (e.payeeSubjectId.startsWith("usr_")) {
        userIds.add(e.payeeSubjectId.replace("usr_", ""));
      }
    }

    const userMap = new Map<string, { firstName: string | null; username: string | null }>();
    if (userIds.size > 0) {
      const userRows = await db.query.users.findMany({
        where: (u, { inArray }) => inArray(u.id, Array.from(userIds)),
        columns: { id: true, firstName: true, username: true },
      });
      for (const u of userRows) {
        userMap.set(u.id, { firstName: u.firstName, username: u.username });
      }
    }

    // Map into rich statement rows
    const statement = entries.map((e) => {
      const isOutflow = e.payerSubjectId === bId;
      const counterSubject = isOutflow ? e.payeeSubjectId : e.payerSubjectId;
      let counterpartyName = "Usuario";

      if (counterSubject.startsWith("usr_")) {
        const uid = counterSubject.replace("usr_", "");
        const u = userMap.get(uid);
        if (u) {
          counterpartyName = u.firstName || (u.username ? `@${u.username}` : "Usuario");
        }
      } else if (counterSubject.startsWith("sys_")) {
        counterpartyName = "Sistema Rabbitty";
      }

      return {
        id: e.id,
        direction: isOutflow ? "OUTFLOW" : "INFLOW",
        type: e.type,
        amount: e.amount,
        counterparty: counterpartyName,
        metadata: e.metadata,
        createdAt: e.createdAt,
      };
    });

    return NextResponse.json({
      success: true,
      business: {
        id: business.id,
        name: business.name,
        package: business.package,
        creditLimit,
        creditUsed,
        remainingInventory: remainingInventory === Infinity ? null : remainingInventory,
        isLowInventory,
      },
      audit: {
        totalRewarded,
        countRewarded,
        totalRedeemed,
        countRedeemed,
        netFlow: totalRedeemed - totalRewarded,
      },
      statement,
    });
  } catch (error) {
    console.error("[Business Ledger Audit] Error:", error);
    return NextResponse.json({ error: "Error al auditar el balance del comercio" }, { status: 500 });
  }
}
