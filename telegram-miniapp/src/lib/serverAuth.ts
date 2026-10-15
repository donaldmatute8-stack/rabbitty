import { NextRequest } from "next/server";
import { db } from "@/db";
import { webSessions, users } from "@/db/schema";
import { and, eq, gt } from "drizzle-orm";
import { validateTelegramInitData, parseTelegramUser } from "./telegramAuth";

export interface AuthenticatedUser {
  id: string;
  telegramId?: string | null;
  username?: string | null;
  phoneNumber?: string | null;
  role?: string | null;
  tonWalletAddress?: string | null;
  totalBunzEarned?: number | null;
  hops?: number | null;
}

/**
 * Extracts and verifies the authenticated user from:
 * 1. Bearer / X-Session-Token header (Web & Native iOS/Android persistent session)
 * 2. Telegram WebApp initData HMAC (X-Init-Data header or query param)
 */
export async function getAuthenticatedUser(req: Request | NextRequest): Promise<AuthenticatedUser | null> {
  try {
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
        const user = await db.query.users.findFirst({
          where: eq(users.id, session.userId),
        });
        if (user) {
          return {
            id: user.id,
            telegramId: user.telegramId,
            username: user.username,
            phoneNumber: user.phoneNumber,
            role: user.role,
            tonWalletAddress: user.tonWalletAddress,
            totalBunzEarned: user.totalBunzEarned,
            hops: user.hops,
          };
        }
      }
    }

    // Fallback: Telegram HMAC validated initData
    const initData = req.headers.get("x-init-data");
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (initData && botToken && validateTelegramInitData(initData, botToken)) {
      const tgUser = parseTelegramUser(initData);
      if (tgUser && tgUser.id) {
        const user = await db.query.users.findFirst({
          where: eq(users.telegramId, tgUser.id.toString()),
        });
        if (user) {
          return {
            id: user.id,
            telegramId: user.telegramId,
            username: user.username,
            phoneNumber: user.phoneNumber,
            role: user.role,
            tonWalletAddress: user.tonWalletAddress,
            totalBunzEarned: user.totalBunzEarned,
            hops: user.hops,
          };
        }
      }
    }

    return null;
  } catch (error) {
    console.error("[getAuthenticatedUser Error]", error);
    return null;
  }
}
