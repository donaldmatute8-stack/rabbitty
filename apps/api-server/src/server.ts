import { router, publicProcedure, protectedProcedure, tenantProcedure, adminProcedure } from "./routers/trpc";
import { paymentsRouter } from "./routers/payments";

// Main Root Router
const appRouter = router({
  health: publicProcedure.query(() => ({ status: "ok" })),
  
  // Attach Domain Routers
  payments: paymentsRouter,
  
  getProfile: protectedProcedure.query(({ ctx }) => {
    return { id: ctx.principal.subjectId, roles: ctx.principal.roles };
  }),
  
  getTenantData: tenantProcedure.query(({ ctx }) => {
    return { data: `Data for tenant ${ctx.principal.tenantId}` };
  }),
  
  adminAction: adminProcedure.mutation(({ ctx }) => {
    return { success: true, executedBy: ctx.principal.subjectId };
  })
});

export type AppRouter = typeof appRouter;

import { createHTTPServer } from "@trpc/server/adapters/standalone";
import cors from "cors";

import { parseAuthHeader, resolveTenant } from "./auth/middleware";

const createContext = async ({ req, res }: any) => {
  const authHeader = (req.headers.authorization as string | undefined) || null;
  const requestedTenantId = (req.headers["x-tenant-id"] as string | undefined) || null;

  let principal = await parseAuthHeader(authHeader);

  // If local development fallback
  if (principal.subjectType === "ANONYMOUS" && process.env.NODE_ENV !== "production") {
    principal = {
      subjectId: "dev-pos-manager",
      tenantId: requestedTenantId || "default-tenant",
      subjectType: "USER",
      roles: ["MANAGER", "ADMIN"],
      capabilities: ["pos:checkout", "bunz:spend", "wallet:read"],
      authMethod: "BUSINESS_SESSION"
    };
  } else if (requestedTenantId) {
    try {
      principal = await resolveTenant(principal, requestedTenantId);
    } catch {
      // Keep principal as is
    }
  }

  return {
    req,
    res,
    principal
  };
};

const server = createHTTPServer({
  router: appRouter,
  createContext,
  middleware: cors(),
});

const PORT = process.env.PORT || 4000;
server.listen(PORT);
console.log(`[API-SERVER] TRPC Server listening on port ${PORT}`);
