import type { Principal } from "../principal";

/**
 * Extracts a Principal from a Business Session (NextAuth Bearer token or cookie).
 * (Stub implementation for Phase 1)
 */
export async function authenticateBusiness(token: string): Promise<Principal | null> {
  // TODO: Validate NextAuth token or Rabbitty Session Token
  // Lookup user in DB
  // For now, return a mocked Principal if token is valid structure
  if (!token.startsWith("Bearer ")) return null;
  
  return {
    subjectId: "mock-user-123",
    subjectType: "USER",
    roles: ["MANAGER"], // To be populated from DB
    capabilities: ["pos:checkout"],
    authMethod: "BUSINESS_SESSION",
  };
}
