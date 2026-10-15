import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, referrals, webSessions } from "@/db/schema";
import { and, eq, gt, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    // Solo se puede consultar el perfil propio, autenticado con session token.
    // No se acepta telegramId/userId/wallet por query (evita IDOR).
    const authHeader = req.headers.get("authorization");
    const customHeader = req.headers.get("x-session-token");
    let token: string | null = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.replace("Bearer ", "").trim();
    } else if (customHeader) {
      token = customHeader.trim();
    }

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await db.query.webSessions.findFirst({
      where: and(
        eq(webSessions.jwtToken, token),
        gt(webSessions.expiresAt, new Date())
      ),
    });

    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
      with: { level: true },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Calculate pending referral bunz
    let pendingBunz = 0;
    const result = await db.select({
      total: sql<number>`COALESCE(SUM(${referrals.rewardAmount}), 0)`,
    }).from(referrals)
      .where(and(eq(referrals.inviterId, profile.id), eq(referrals.status, "PENDING")));
    pendingBunz = result[0]?.total ?? 0;

    return NextResponse.json({ profile: { ...profile, pendingBunz } }, { status: 200 });
  } catch (error) {
    console.error("[GET_PROFILE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
