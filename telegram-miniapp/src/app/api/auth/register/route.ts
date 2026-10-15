import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, webSessions } from "@/db/schema";
import { and, eq, gt, or } from "drizzle-orm";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { telegramId, email, firstName, lastName, username, tonWalletAddress, smart_wallet_address, userId } = body;

    // Check Authorization header for native/web session token
    let sessionUserId: string | null = null;
    const authHeader = req.headers.get("authorization");
    let token: string | null = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.replace("Bearer ", "").trim();
    }
    if (token) {
      const session = await db.query.webSessions.findFirst({
        where: and(
          eq(webSessions.jwtToken, token),
          gt(webSessions.expiresAt, new Date())
        ),
      });
      if (session?.userId) {
        sessionUserId = session.userId;
      }
    }

    const effectiveUserId = sessionUserId || userId;

    if (!telegramId && !email && !effectiveUserId) {
      return NextResponse.json({ error: "Missing identifier" }, { status: 400 });
    }

    const effectiveWallet = tonWalletAddress || smart_wallet_address || null;
    const effectiveTelegramId = telegramId || null;

    // Check if user exists by id, telegramId or email
    let existingUser = null;
    if (effectiveUserId) {
      existingUser = await db.query.users.findFirst({ where: eq(users.id, effectiveUserId) });
    } else if (effectiveTelegramId) {
      existingUser = await db.query.users.findFirst({ where: eq(users.telegramId, effectiveTelegramId) });
    } else if (email) {
      existingUser = await db.query.users.findFirst({ where: eq(users.email, email) });
    }
    if (!existingUser && effectiveWallet) {
      existingUser = await db.query.users.findFirst({ where: eq(users.tonWalletAddress, effectiveWallet) });
    }

    if (existingUser) {
      const [updated] = await db.update(users).set({
        firstName: firstName ?? existingUser.firstName,
        lastName: lastName ?? existingUser.lastName,
        username: username ?? existingUser.username,
        email: email ?? existingUser.email,
        tonWalletAddress: effectiveWallet ?? existingUser.tonWalletAddress,
        updatedAt: new Date(),
      }).where(eq(users.id, existingUser.id)).returning();
      return NextResponse.json({ success: true, user: updated }, { status: 200 });
    }

    const [user] = await db.insert(users).values({
      telegramId: effectiveTelegramId,
      firstName: firstName || null,
      lastName: lastName || null,
      username: username || null,
      email: email || null,
      tonWalletAddress: effectiveWallet,
    }).returning();

    return NextResponse.json({ success: true, user }, { status: 200 });
  } catch (error) {
    console.error("[REGISTER_USER]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
