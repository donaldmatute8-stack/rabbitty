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
  email?: string | null;
  role?: string | null;
  tonWalletAddress?: string | null;
  totalBunzEarned?: number | null;
  hops?: number | null;
  /** Push v2.1 §2.4: reglas por Rabbitter (proximidadAllAlerts y similares) */
  pushRules?: Record<string, boolean> | null;
  /** Categorías silenciadas (§2.2) — para el worker/proximidad */
  pushMutedCategories?: string[] | null;
}

/**
 * Extracts and verifies the authenticated user from:
 * 1. Bearer / X-Session-Token header (Web & Native iOS/Android persistent session)
 * 2. Telegram WebApp initData HMAC (X-Init-Data header or query param)
 */
/** Parser de pushRules/pushMutedCategories SIN cycle (reimpl local del contrato). */
function parseUserRulesJson(raw: unknown): Record<string, boolean> {
  if (typeof raw !== "string" || !raw.trim()) return {};
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const known: Record<string, string> = {
      proximityAllAlerts: "proximityAllAlerts",
    };
    const out: Record<string, boolean> = {};
    for (const [k, mapped] of Object.entries(known)) {
      out[mapped] = obj[k] === true;
    }
    return out;
  } catch { return {}; }
}
function parseUserCategories(raw: unknown): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as unknown[]).filter((x): x is string => typeof x === "string") : [];
  } catch { return []; }
}

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
            email: user.email,
            role: user.role,
            tonWalletAddress: user.tonWalletAddress,
            totalBunzEarned: user.totalBunzEarned,
            hops: user.hops,
            pushRules: parseUserRulesJson(user.pushRules),
            pushMutedCategories: parseUserCategories(user.pushMutedCategories),
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
            email: user.email,
            role: user.role,
            tonWalletAddress: user.tonWalletAddress,
            totalBunzEarned: user.totalBunzEarned,
            hops: user.hops,
            pushRules: parseUserRulesJson(user.pushRules),
            pushMutedCategories: parseUserCategories(user.pushMutedCategories),
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
