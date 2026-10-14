import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, referrals, webSessions } from "@/db/schema";
import { and, eq, gt, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const telegramId = searchParams.get("telegramId");
    const wallet = searchParams.get("wallet");
    const userId = searchParams.get("userId");

    // Check Authorization header for native/web session token
    let sessionUserId: string | null = null;
    const authHeader = req.headers.get("authorization");
    const customHeader = req.headers.get("x-session-token");
    let token: string | null = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.replace("Bearer ", "").trim();
    } else if (customHeader) {
      token = customHeader.trim();
    }

    if (token) {
      const session = await db.query.webSessions.findFirst({
        where: and(
          eq(webSessions.jwtToken, token),
          gt(webSessions.expiresAt, new Date())
        ),
      });
      if (session && session.userId) {
        sessionUserId = session.userId;
      }
    }

    const effectiveUserId = sessionUserId || userId;

    if (!telegramId && !wallet && !effectiveUserId) {
      return NextResponse.json({ error: "Missing identifier" }, { status: 400 });
    }

    // Fetch profile and join with levels
    let profile = null;
    if (effectiveUserId) {
      profile = await db.query.users.findFirst({
        where: eq(users.id, effectiveUserId),
        with: { level: true },
      });
    } else if (telegramId) {
      profile = await db.query.users.findFirst({
        where: eq(users.telegramId, telegramId),
        with: { level: true },
      });
    } else if (wallet) {
      profile = await db.query.users.findFirst({
        where: eq(users.tonWalletAddress, wallet),
        with: { level: true },
      });
    }

    // Calculate pending referral bunz
    let pendingBunz = 0;
    if (profile) {
      const result = await db.select({
        total: sql<number>`COALESCE(SUM(${referrals.rewardAmount}), 0)`,
      }).from(referrals)
        .where(and(eq(referrals.inviterId, profile.id), eq(referrals.status, "PENDING")));
      pendingBunz = result[0]?.total ?? 0;
    }

    return NextResponse.json({ profile: { ...profile, pendingBunz } }, { status: 200 });
  } catch (error) {
    console.error("[GET_PROFILE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
