import { authenticateBusiness } from "./authenticators/business";
import { authenticateTelegram } from "./authenticators/telegram";
import { authenticateDevice } from "./authenticators/device";
import { AnonymousPrincipal, type Principal } from "./principal";

export async function parseAuthHeader(authHeader?: string | null): Promise<Principal> {
  if (!authHeader) return AnonymousPrincipal;

  if (authHeader.startsWith("device_")) {
    const principal = await authenticateDevice(authHeader);
    if (principal) return principal;
  }

  if (authHeader.startsWith("tma ") || authHeader.startsWith("Bearer TMA_TOKEN")) {
    const principal = await authenticateTelegram(authHeader);
    if (principal) return principal;
  }

  if (authHeader.startsWith("Bearer ")) {
    const raw = authHeader.slice(7).trim();
    if (raw.startsWith("device_")) {
      const devPrincipal = await authenticateDevice(raw);
      if (devPrincipal) return devPrincipal;
    }

    // Check if telegram initData was sent as Bearer
    const tmaPrincipal = await authenticateTelegram(authHeader);
    if (tmaPrincipal) return tmaPrincipal;

    const principal = await authenticateBusiness(authHeader);
    if (principal) return principal;
  }

  return AnonymousPrincipal;
}

export async function resolveTenant(principal: Principal, requestedTenantId?: string | null): Promise<Principal> {
  if (!requestedTenantId) return principal;

  // Simulated DB Membership check
  // const membership = await db.membership.findFirst({ where: { userId: principal.subjectId, tenantId: requestedTenantId } });
  
  // For the skeleton, we allow the request if the user is a MANAGER or ADMIN globally
  const hasAccess = principal.roles.includes("MANAGER") || principal.roles.includes("ADMIN");

  if (!hasAccess) {
    throw new Error("TENANT_ACCESS_DENIED");
  }

  return {
    ...principal,
    tenantId: requestedTenantId,
    // In the future, tenant-scoped roles and capabilities would be mapped here
    // roles: membership.roles,
    // capabilities: membership.capabilities
  };
}
