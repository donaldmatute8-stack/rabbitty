// We use fetch adapter for modern runtimes (Next API routes / Edge / Fastify / Node fetch)
// For now, let's mock a generic FetchContext
import { parseAuthHeader, resolveTenant } from "../auth/middleware";
import type { Principal } from "../auth/principal";

export interface RequestContext {
  principal: Principal;
  // db: getRestaurantDb() 
  // coreDb: getCoreDb()
}

/**
 * Parses the incoming Request and builds the Context injecting the Canonical Principal.
 */
export async function createContext(req: Request): Promise<RequestContext> {
  const authHeader = req.headers.get("authorization");
  const requestedTenantId = req.headers.get("x-tenant-id");

  const rawPrincipal = await parseAuthHeader(authHeader);
  const principal = await resolveTenant(rawPrincipal, requestedTenantId);

  return {
    principal,
  };
}
