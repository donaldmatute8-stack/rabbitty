import type { Principal } from "../principal";

/**
 * Extracts a Principal from a hardware device token (e.g. Rabbitty Printer).
 * (Stub implementation for Phase 1)
 */
export async function authenticateDevice(deviceToken: string): Promise<Principal | null> {
  // TODO: Validate Device Credential against DB
  if (!deviceToken.startsWith("device_")) return null;

  return {
    subjectId: "mock-printer-789",
    subjectType: "DEVICE",
    tenantId: "b1", // Tied to a specific branch/tenant
    roles: ["PRINTER"],
    capabilities: ["print:execute"],
    authMethod: "DEVICE",
  };
}
