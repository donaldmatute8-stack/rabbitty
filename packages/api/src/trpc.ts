import { initTRPC, TRPCError } from "@trpc/server";
import type { getRestaurantDb, getCoreDb } from "./db";
import { rateLimit } from "./middleware/rateLimit";
import { logAudit } from "./middleware/auditLog";

export interface Context {
  userId?: string | null;
  user?: { id?: string | null; name?: string | null; email?: string | null; image?: string | null } | null;
  staffRole?: "WAITER" | "CASHIER" | "KITCHEN" | "MANAGER" | "ADMIN" | null;
  staffBranchId?: string | null;
  restaurantDb: ReturnType<typeof getRestaurantDb>;
  coreDb: ReturnType<typeof getCoreDb>;
  branchId: string;
}

export const t = initTRPC.context<Context>().create();
export const router = t.router;
export const publicProcedure = t.procedure;

const rateLimitMiddleware = t.middleware(async ({ ctx, next }) => {
  await rateLimit(ctx.userId);
  return next();
});

const auditMiddleware = t.middleware(async ({ ctx, path, type, next }) => {
  const result = await next();
  if (type === "mutation") {
    logAudit({
      userId: ctx.userId ?? null,
      action: path,
      resource: path.split(".")[0] ?? "unknown",
      resourceId: null,
      details: null,
    });
  }
  return result;
});

export const protectedProcedure = t.procedure
  .use(rateLimitMiddleware)
  .use(auditMiddleware)
  .use(({ ctx, next }) => {
    if (!ctx.userId) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return next({ ctx: { ...ctx, userId: ctx.userId } });
  });

// Blocks staff below ADMIN. Owners (staffRole === null) and ADMIN staff pass.
export const adminOnlyProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.staffRole && ctx.staffRole !== "ADMIN") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acción restringida a administradores" });
  }
  return next({ ctx });
});

// Platform-level functions: only owners (no staff role) may call.
export const platformOnlyProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.staffRole) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acción restringida a la plataforma" });
  }
  return next({ ctx });
});

// Staff are locked to their own branch regardless of client input.
export const resolveBranchId = (ctx: Context, inputBranchId?: string | null) =>
  ctx.staffRole && ctx.staffBranchId ? ctx.staffBranchId : (inputBranchId ?? ctx.branchId);

export const publicLimitedProcedure = t.procedure.use(rateLimitMiddleware);
