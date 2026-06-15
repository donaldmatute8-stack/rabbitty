import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, transactions } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { transactionId, finalFiatAmount } = await req.json();

    if (!transactionId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const [transaction] = await db.select().from(transactions).where(eq(transactions.id, transactionId));

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    if (transaction.status !== "PENDING") {
      return NextResponse.json({ error: "Transaction is not pending" }, { status: 400 });
    }

    const approvedAmount = finalFiatAmount || transaction.fiatAmount;
    const finalBunz = transaction.bunzMinted;

    const [updatedTx] = await db
      .update(transactions)
      .set({ status: "MINTED", fiatAmount: approvedAmount })
      .where(eq(transactions.id, transactionId))
      .returning();

    // Update user balance atómicamente
    await db.update(users)
      .set({ totalBunzEarned: sql`COALESCE(${users.totalBunzEarned}, 0) + ${finalBunz}` })
      .where(eq(users.id, transaction.userId));

    return NextResponse.json({ success: true, transaction: updatedTx });
  } catch (error) {
    console.error("Error approving transaction:", error);
    return NextResponse.json({ error: "Failed to approve transaction" }, { status: 500 });
  }
}
