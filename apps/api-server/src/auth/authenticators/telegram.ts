import type { Principal } from "../principal";

/**
 * Extracts a Principal from a Telegram InitData payload.
 * (Stub implementation for Phase 1)
 */
export async function authenticateTelegram(initData: string): Promise<Principal | null> {
  // TODO: Validate HMAC using TELEGRAM_BOT_TOKEN
  // Lookup Rabbitty User linked to this telegramId
  if (!initData.startsWith("tma ")) return null;

  return {
    subjectId: "mock-rabbiter-456",
    subjectType: "USER",
    roles: ["RABBITER"],
    capabilities: ["wallet:read", "bunz:receive"],
    authMethod: "TELEGRAM",
  };
}
