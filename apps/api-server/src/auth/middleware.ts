import { authenticateBusiness } from "./authenticators/business";
import { authenticateTelegram } from "./authenticators/telegram";
import { authenticateDevice } from "./authenticators/device";
import { AnonymousPrincipal, type Principal } from "./principal";

export async function parseAuthHeader(authHeader?: string | null): Promise<Principal> {
  if (!authHeader) return AnonymousPrincipal;

  if (authHeader.startsWith("Bearer ")) {
    const principal = await authenticateBusiness(authHeader);
    if (principal) return principal;
  }

  if (authHeader.startsWith("tma ")) {
    const principal = await authenticateTelegram(authHeader);
    if (principal) return principal;
  }

  if (authHeader.startsWith("device_")) {
    const principal = await authenticateDevice(authHeader);
    if (principal) return principal;
  }

  return AnonymousPrincipal;
}

export async function resolveTenant(principal: Principal, requestedTenantId?: string | null): Promise<Principal> {
  // If no specific tenant requested and principal already has one bound (e.g., Device), keep it.
  if (!requestedTenantId) return principal;

  // TODO: In a real implementation, query DB to check if principal.subjectId 
  // is a member of requestedTenantId and has capabilities within it.
  
  // For the skeleton, we allow the request if the user is a MANAGER
  if (principal.roles.includes("MANAGER") || principal.roles.includes("ADMIN")) {
    return {
      ...principal,
      tenantId: requestedTenantId,
    };
  }

  // If unauthorized for the requested tenant, we strip the tenant context.
  // The actual router/procedure will throw a 403 when it requires a tenantId.
  return principal;
}
