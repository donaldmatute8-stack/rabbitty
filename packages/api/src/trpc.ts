import { initTRPC, TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import type { getRestaurantDb, getCoreDb } from "./db";
import { rateLimit } from "./middleware/rateLimit";
import { logAudit } from "./middleware/auditLog";
import { users as usersCore } from "@rabbitty/database-core";

export interface Context {
  userId?: string | null;
  user?: { id?: string | null; name?: string | null; email?: string | null; image?: string | null } | null;
  staffRole?: "WAITER" | "CASHIER" | "KITCHEN" | "MANAGER" | "ADMIN" | null;
  staffBranchId?: string | null;
  restaurantDb: ReturnType<typeof getRestaurantDb>;
  coreDb: ReturnType<typeof getCoreDb>;
  branchId: string;
  god2faVerified?: boolean; // cookie firmada de 2FA God Admin válida en esta sesión
  impersonating?: { businessId: string; branchId: string } | null; // Vista Tenant (God → afiliado)
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

// Blocks staff below MANAGER. Owners (staffRole === null), ADMIN and MANAGER staff pass.
// Managers operate their own branch (resolveBranchId scopes writes to ctx.branchId);
// OWNER-only guards exist separately via platformOnlyProcedure.
export const adminOnlyProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.staffRole && ctx.staffRole !== "ADMIN" && ctx.staffRole !== "MANAGER") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acción restringida a administradores y gerentes" });
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

// ── God Admin: identidad allowlist/role ADMIN + 2FA verificado en esta sesión ──
import { isGodAdminIdentity } from "./services/god2fa";
export const godAdminProcedure = platformOnlyProcedure.use(async ({ ctx, next }) => {
  let identityOk = isGodAdminIdentity(ctx.user?.email, ctx.user?.name);
  if (!identityOk && ctx.userId) {
    const [coreUser] = await ctx.coreDb
      .select({ role: usersCore.role, username: usersCore.username, email: usersCore.email })
      .from(usersCore)
      .where(eq(usersCore.id, ctx.userId))
      .limit(1);
    identityOk = Boolean(
      coreUser &&
        (coreUser.role === "ADMIN" || isGodAdminIdentity(coreUser.email, coreUser.username))
    );
  }
  if (!identityOk) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Operación reservada al God Admin de Rabbitty." });
  }
  if (!ctx.god2faVerified) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "2FA requerido: verifica tu código TOTP o tu passkey biométrico en /verify-2fa.",
    });
  }
  return next({ ctx });
});

// Non-admin staff (WAITER, CASHIER, KITCHEN) are locked to their own branch regardless of client input.
// Owners (staffRole === null), ADMIN and MANAGER can switch between active branches of their own restaurant
// (e.g. Production <-> Sandbox); any branchId outside their restaurant is rejected and falls back to ctx.branchId.
export async function resolveBranchId(ctx: Context, inputBranchId?: string | null): Promise<string> {
  const staffRole = ctx.staffRole ?? null;
  const isOperationalStaff = Boolean(
    staffRole && staffRole !== "ADMIN" && staffRole !== "MANAGER" && ctx.staffBranchId
  );
  if (isOperationalStaff) return ctx.staffBranchId as string;

  const chosen = inputBranchId ?? ctx.branchId;

  // ── Tenant guard: si se pide una sucursal distinta, debe pertenecer al mismo restaurante
  //    (activo) de la sucursal en contexto. Evita escrituras cruzadas entre tenants. ──
  if (chosen && ctx.branchId && chosen !== ctx.branchId) {
    try {
      const { branches } = await import("@rabbitty/database-restaurant/schema");
      const { and, eq } = await import("drizzle-orm");
      const [base] = await ctx.restaurantDb
        .select({ restaurantId: branches.restaurantId })
        .from(branches)
        .where(eq(branches.id, ctx.branchId))
        .limit(1);
      if (base?.restaurantId) {
        const [valid] = await ctx.restaurantDb
          .select({ id: branches.id })
          .from(branches)
          .where(
            and(
              eq(branches.id, chosen),
              eq(branches.restaurantId, base.restaurantId),
              eq(branches.isActive, true)
            )
          )
          .limit(1);
        if (valid) return chosen;
      }
    } catch {
      // Ante error de validación, no confiar en el input
    }
    return ctx.branchId;
  }

  return chosen;
}

export const publicLimitedProcedure = t.procedure.use(rateLimitMiddleware);
