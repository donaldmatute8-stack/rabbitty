import type { Principal } from "../principal";

/**
 * Extracts a Principal from a Business Session (NextAuth Bearer token or cookie).
 * (Stub implementation for Phase 1)
 */
export async function authenticateBusiness(token: string): Promise<Principal | null> {
  if (!token.startsWith("Bearer ")) return null;
  const rawToken = token.slice(7).trim();
  
  // 1. Production / Configured Terminal Secret Authentication
  const posSecret = process.env.POS_API_SECRET || process.env.RABBITTY_API_SECRET;
  if (posSecret && (rawToken === posSecret || rawToken === `pos_${posSecret}`)) {
    return {
      subjectId: "pos-terminal-service",
      subjectType: "USER",
      roles: ["MANAGER", "ADMIN"],
      capabilities: ["pos:checkout", "bunz:spend", "wallet:read"],
      authMethod: "BUSINESS_SESSION",
    };
  }

  // 2. In non-production, require designated dev tokens rather than accepting arbitrary strings
  if (process.env.NODE_ENV !== "production") {
    if (rawToken === "DEV_TOKEN" || rawToken === "POS_TOKEN" || rawToken.startsWith("dev-")) {
      return {
        subjectId: "dev-pos-manager",
        subjectType: "USER",
        roles: ["MANAGER"],
        capabilities: ["pos:checkout"],
        authMethod: "BUSINESS_SESSION",
      };
    }
    return null;
  }

  // In production: reject arbitrary tokens without valid cryptographic verification
  return null;
}
