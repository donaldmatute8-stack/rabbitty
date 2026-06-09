import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { telegramId, email, firstName, lastName, username, tonWalletAddress, smart_wallet_address } = body;

    if (!telegramId && !email) {
      return NextResponse.json({ error: "Missing telegramId or email" }, { status: 400 });
    }

    const effectiveWallet = tonWalletAddress || smart_wallet_address || null;
    const effectiveId = telegramId || `email_${crypto.createHash("md5").update(email).digest("hex")}`;

    // Check if user exists by telegramId, email, or wallet
    let existingUser = null;
    if (telegramId) {
      existingUser = await db.query.users.findFirst({ where: eq(users.telegramId, telegramId) });
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
      telegramId: effectiveId,
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
