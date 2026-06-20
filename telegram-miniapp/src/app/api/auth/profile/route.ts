import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, referrals } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const telegramId = searchParams.get("telegramId");
    const wallet = searchParams.get("wallet");

    if (!telegramId && !wallet) {
      return NextResponse.json({ error: "Missing identifier" }, { status: 400 });
    }

    let profile = null;
    
    if (telegramId) {
      profile = await db.query.users.findFirst({
        where: eq(users.telegramId, telegramId),
      });
    } else if (wallet) {
      profile = await db.query.users.findFirst({
        where: eq(users.tonWalletAddress, wallet),
      });
    }

    // Calculate pending referral bunz
    let pendingBunz = 0;
    if (profile) {
      const result = await db.select({
        total: sql<number>`COALESCE(SUM(${referrals.rewardAmount}), 0)`,
      }).from(referrals)
        .where(and(eq(referrals.invitedId, profile.id), eq(referrals.status, "PENDING")));
      pendingBunz = result[0]?.total ?? 0;
    }

    return NextResponse.json({ profile: { ...profile, pendingBunz } }, { status: 200 });
  } catch (error) {
    console.error("[GET_PROFILE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
