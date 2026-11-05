import { initTRPC, TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import type { getRestaurantDb, getCoreDb } from "./db";
import { rateLimit } from "./middleware/rateLimit";
import { logAudit } from "./middleware/auditLog";
import { users as usersCore } from "@rabbitty/database-core";
import {
  hasPosPermission,
  normalizePosRole,
  permissionsForRole,
  posPermissionLabel,
  posRoleLabel,
  type PosPermission,
  type PosRole,
} from "./services/posPermissions";
import { isOperatorSessionsEnabled } from "./services/posOperatorAuth";

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
  /**
   * Identidad del dispositivo POS cuando trae un token de terminal válido.
   * Es "doble lectura": puede coexistir con la sesión de admin. Si existe,
   * manda para el scoping de sucursal (el dispositivo está atado a una).
   */
  posAuth?: {
    method: "admin" | "terminal" | "none";
    terminalId?: string;
    sessionId?: string;
    branchId?: string;
    businessId?: string | null;
    terminalName?: string;
  };
  /**
   * Turno del empleado sobre la terminal (Fase 3). Solo existe si hay terminal
   * válida y un token de turno vigente; identifica a la PERSONA que opera.
   */
  posOperator?: {
    sessionId: string;
    staffId: string;
    name: string;
    role: string;
  } | null;
}

export const t = initTRPC.context<Context>().create();
export const router = t.router;
export const publicProcedure = t.procedure;

const rateLimitMiddleware = t.middleware(async ({ ctx, next }) => {
  // La terminal no tiene userId: se limita por sesión de terminal, no como
  // "anonymous" (todas las terminales compartirían un solo cubo de 60/min).
  const scope =
    ctx.posAuth?.method === "terminal" && ctx.posAuth.sessionId
      ? `terminal:${ctx.posAuth.sessionId}`
      : null;
  await rateLimit(ctx.userId, scope);
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
      // Con turno de empleado, la auditoría dice QUIÉN operó, no solo qué
      // dispositivo lo hizo. Sin turno se conserva el detalle actual (null).
      details: ctx.posOperator
        ? {
            staffId: ctx.posOperator.staffId,
            staffRole: ctx.posOperator.role,
            terminalId: ctx.posAuth?.terminalId ?? null,
            via: "pos_operator",
          }
        : null,
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

/**
 * ── POS: terminal O admin (Fase 2 del ADR-014) ──
 *
 * - Con sesión de admin: idéntico a `protectedProcedure` (cero regresión).
 * - Con token de terminal válido: solo habilita los namespaces del POS.
 *
 * La allowlist por `path` es defensa en profundidad: aunque alguien aplique
 * `posProcedure` a un router administrativo, la terminal no podrá llamarlo.
 */
const TERMINAL_ALLOWED_PREFIXES = [
  "pos.",
  "payments.",
  "memberships.",
  "cashDrops.",
  "cashShifts.",
  "printing.",
] as const;
const TERMINAL_ALLOWED_EXACT = new Set(["staff.verifyAdminPin"]);

export function terminalCanCallPath(path: string): boolean {
  return (
    TERMINAL_ALLOWED_EXACT.has(path) ||
    TERMINAL_ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix))
  );
}

export const posProcedure = t.procedure
  .use(rateLimitMiddleware)
  .use(auditMiddleware)
  .use(({ ctx, path, next }) => {
    if (ctx.userId) {
      return next({ ctx: { ...ctx, userId: ctx.userId } });
    }
    if (ctx.posAuth?.method === "terminal" && terminalCanCallPath(path)) {
      return next({ ctx });
    }
    throw new TRPCError({ code: "UNAUTHORIZED" });
  });

/**
 * ── Permisos por rol (Fase 3.5) ──
 * La terminal aporta el dispositivo y el turno aporta a la persona; de su rol
 * salen las acciones permitidas. Un admin del panel conserva su rol de staff.
 */
export function resolvePosRole(ctx: Context): PosRole | null {
  if (ctx.posAuth?.method === "terminal") {
    if (ctx.posOperator) return normalizePosRole(ctx.posOperator.role);
    // Terminal de Fase 2 sin turno: si el flag de turnos está apagado, se
    // mantiene el acceso completo anterior. Si está encendido y no hay turno,
    // no hay rol → las acciones sensibles quedan bloqueadas.
    return isOperatorSessionsEnabled() ? null : "OWNER";
  }
  if (ctx.userId) return ctx.staffRole ? normalizePosRole(ctx.staffRole) : "OWNER";
  return null;
}

export function posPermissionsOf(ctx: Context): PosPermission[] {
  return permissionsForRole(resolvePosRole(ctx));
}

/**
 * Exige un permiso POS. Se aplica sobre `posProcedure` (admin o terminal).
 *
 * · Terminal con turno: SIEMPRE se aplica (es el camino nuevo y seguro).
 * · Panel admin: se aplica solo con `POS_ROLE_ENFORCEMENT=1`, para no cambiar
 *   el comportamiento existente de un día para otro. La UI ya respeta la
 *   matriz en ambos casos.
 */
export function posPermission(permission: PosPermission) {
  return posProcedure.use(({ ctx, next }) => {
    const isTerminalPrincipal = ctx.posAuth?.method === "terminal";
    const enforce = isTerminalPrincipal || process.env.POS_ROLE_ENFORCEMENT === "1";
    if (!enforce) return next({ ctx });

    const role = resolvePosRole(ctx);
    if (!role || !hasPosPermission(role, permission)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Tu rol${role ? ` (${posRoleLabel(role)})` : ""} no permite ${posPermissionLabel(permission)}.`,
      });
    }
    return next({ ctx });
  });
}

/**
 * ── Solo terminal POS (Fase 3) ──
 * Para operaciones que exigen un dispositivo vinculado (turno del empleado).
 * El admin no puede iniciar turnos desde el panel.
 */
export const terminalProcedure = t.procedure
  .use(rateLimitMiddleware)
  .use(auditMiddleware)
  .use(({ ctx, next }) => {
    if (ctx.posAuth?.method !== "terminal") {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Se requiere una terminal POS autorizada",
      });
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
    // Solo el correo allowlist. Un rol ADMIN de un tenant NO concede God.
    identityOk = Boolean(coreUser && isGodAdminIdentity(coreUser.email, coreUser.username));
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
  // La terminal está físicamente atada a una sucursal: no puede cambiar de
  // sucursal ni por header ni por input, aunque sea del mismo tenant.
  if (ctx.posAuth?.method === "terminal") return ctx.branchId;

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


/**
 * ── Restaurante del contexto (aislamiento de tenant) ──
 * Deriva el restaurantId de la sucursal en contexto (staff-lock incluido).
 * Debe usarse en TODO lo que necesite "el restaurante de esta sesión".
 *
 * Nunca usar `select().from(restaurants).limit(1)`: eso toma un restaurante
 * arbitrario de la plataforma y filtraba datos entre negocios (626 Café veía
 * clientes/reportes de Ka13).
 */
export async function resolveRestaurantId(ctx: Context): Promise<string | null> {
  const branchId = ctx.staffRole && ctx.staffBranchId ? ctx.staffBranchId : ctx.branchId;
  if (!branchId) return null;
  const { branches } = await import("@rabbitty/database-restaurant/schema");
  const [branch] = await ctx.restaurantDb
    .select({ restaurantId: branches.restaurantId })
    .from(branches)
    .where(eq(branches.id, branchId))
    .limit(1);
  return branch?.restaurantId ?? null;
}

export const publicLimitedProcedure = t.procedure.use(rateLimitMiddleware);
