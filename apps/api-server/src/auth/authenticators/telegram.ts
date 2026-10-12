import crypto from "crypto";
import type { Principal } from "../principal";

function validateTelegramInitData(initData: string, botToken: string): boolean {
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get("hash");
    if (!hash) return false;

    urlParams.delete("hash");
    urlParams.sort();

    let dataCheckString = "";
    for (const [key, value] of urlParams.entries()) {
      dataCheckString += `${key}=${value}\n`;
    }
    dataCheckString = dataCheckString.slice(0, -1);

    const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
    const calculatedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    if (calculatedHash.length !== hash.length) return false;
    return crypto.timingSafeEqual(Buffer.from(calculatedHash, "utf-8"), Buffer.from(hash, "utf-8"));
  } catch {
    return false;
  }
}

function parseTelegramUser(initData: string): any {
  try {
    const urlParams = new URLSearchParams(initData);
    const userStr = urlParams.get("user");
    if (!userStr) return null;
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * Extracts a Principal from a Telegram InitData payload.
 */
export async function authenticateTelegram(authHeader: string): Promise<Principal | null> {
  const initData = authHeader.replace(/^(tma|bearer)\s+/i, "").trim();
  if (!initData) return null;

  // In non-production, permit dev token
  if (process.env.NODE_ENV !== "production" && initData === "TMA_TOKEN") {
    return {
      subjectId: "mock-rabbiter-456",
      subjectType: "USER",
      roles: ["RABBITER"],
      capabilities: ["wallet:read", "bunz:receive", "bunz:spend"],
      authMethod: "TELEGRAM",
    };
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (botToken && validateTelegramInitData(initData, botToken)) {
    const tUser = parseTelegramUser(initData);
    return {
      subjectId: tUser?.id ? tUser.id.toString() : "telegram-user",
      subjectType: "USER",
      roles: ["RABBITER"],
      capabilities: ["wallet:read", "bunz:receive", "bunz:spend"],
      authMethod: "TELEGRAM",
    };
  }

  return null;
}
