import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, webSessions } from "@/db/schema";
import { and, eq, gt } from "drizzle-orm";
import { validateTelegramInitData, parseTelegramUser } from "@/lib/telegramAuth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { firstName, lastName, username, tonWalletAddress, smart_wallet_address, initData } = body;

    // 1. Authenticate via Bearer Session Token (Native iOS / Web)
    let authenticatedUserId: string | null = null;
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
        authenticatedUserId = session.userId;
      }
    }

    // 2. Or Authenticate via Cryptographic Telegram HMAC if provided
    let verifiedTelegramId: string | null = null;
    if (!authenticatedUserId && initData) {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (botToken && validateTelegramInitData(initData, botToken)) {
        const tUser = parseTelegramUser(initData);
        if (tUser?.id) {
          verifiedTelegramId = tUser.id.toString();
        }
      }
    }

    // Must have at least one verified identity mechanism
    if (!authenticatedUserId && !verifiedTelegramId) {
      return NextResponse.json({ error: "No autorizado. Token de sesión o initData inválido." }, { status: 401 });
    }

    const effectiveWallet = tonWalletAddress || smart_wallet_address || null;

    // Find authenticated user
    let existingUser = null;
    if (authenticatedUserId) {
      existingUser = await db.query.users.findFirst({ where: eq(users.id, authenticatedUserId) });
    } else if (verifiedTelegramId) {
      existingUser = await db.query.users.findFirst({ where: eq(users.telegramId, verifiedTelegramId) });
    }

    if (!existingUser) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const [updated] = await db.update(users).set({
      firstName: firstName !== undefined ? firstName : existingUser.firstName,
      lastName: lastName !== undefined ? lastName : existingUser.lastName,
      username: username !== undefined ? username : existingUser.username,
      tonWalletAddress: effectiveWallet ?? existingUser.tonWalletAddress,
      updatedAt: new Date(),
    }).where(eq(users.id, existingUser.id)).returning();

    return NextResponse.json({ success: true, user: updated }, { status: 200 });
  } catch (error) {
    console.error("[REGISTER_USER]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
