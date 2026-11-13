/**
 * ── Contexto del KDS (Fase 0C-4b / 0C-5) ───────────────────────────────────
 *
 * El KDS tiene dos formas de autenticarse y ambas deben producir el mismo
 * contexto: sucursal + estación + (usuario o terminal).
 *
 *  1. **Terminal POS**: la tablet manda `x-pos-terminal-token`; la sucursal y
 *     la estación salen del dispositivo.
 *  2. **Sesión NextAuth**: una pantalla abierta con la cuenta del negocio. La
 *     sucursal se resuelve de su staff o del negocio del dueño y se valida la
 *     pertenencia (anti-IDOR).
 *
 * Se usa tanto en el handler tRPC como en la emisión de tokens de Centrifugo,
 * para que no existan dos criterios de autorización distintos.
 */

import { and, eq } from "drizzle-orm";
import { staff, branches, restaurants } from "@rabbitty/database-restaurant/schema";
import { users, ownedBusinesses } from "@rabbitty/database-core/schema";
import { validateBranchMembership } from "./branchMembership";
import { isTerminalSessionsEnabled, readTerminalToken, resolvePosTerminalSession } from "./posTerminalAuth";

export type KdsPosAuth = {
  method: "terminal" | "admin" | "none";
  terminalId?: string;
  sessionId?: string;
  branchId?: string;
  stationId?: string | null;
  kind?: string | null;
  businessId?: string | null;
  terminalName?: string;
};

export type KdsCaller = {
  branchId: string;
  userId: string | null;
  staffRole: "WAITER" | "CASHIER" | "KITCHEN" | "MANAGER" | "ADMIN" | null;
  staffBranchId: string | null;
  posAuth: KdsPosAuth;
  posTerminal: Awaited<ReturnType<typeof resolvePosTerminalSession>>;
};

export class KdsAuthError extends Error {
  constructor(
    public code: "UNAUTHORIZED" | "FORBIDDEN",
    message: string,
  ) {
    super(message);
    this.name = "KdsAuthError";
  }
}

export async function resolveKdsCaller(params: {
  req: Request;
  session: { user?: { id?: string; email?: string | null } | null } | null;
  restaurantDb: any;
  coreDb: any;
}): Promise<KdsCaller> {
  const { req, session, restaurantDb, coreDb } = params;

  // ── 1. Terminal POS ──
  let posTerminal = null;
  if (isTerminalSessionsEnabled()) {
    const terminalToken = readTerminalToken(req.headers);
    if (terminalToken) {
      posTerminal = await resolvePosTerminalSession(coreDb, terminalToken);
      if (posTerminal) {
        const [terminalBranch] = await restaurantDb
          .select({ id: branches.id })
          .from(branches)
          .where(and(eq(branches.id, posTerminal.branchId), eq(branches.isActive, true)))
          .limit(1);
        if (!terminalBranch) posTerminal = null;
      }
    }
  }

  // ── 2. Sesión: ubicar al usuario en el grafo del negocio ──
  let effectiveUserId = session?.user?.id ?? null;
  let staffRole: KdsCaller["staffRole"] = null;
  let staffBranchId: string | null = null;

  if (session?.user?.email) {
    const [staffRecord] = await restaurantDb
      .select({ branchId: staff.branchId, role: staff.role })
      .from(staff)
      .where(and(eq(staff.email, session.user.email), eq(staff.isActive, true)))
      .limit(1);
    if (staffRecord) {
      staffBranchId = staffRecord.branchId;
      staffRole = staffRecord.role as KdsCaller["staffRole"];
    }

    const [coreUser] = await coreDb
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, session.user.email))
      .limit(1);
    if (coreUser?.id) effectiveUserId = coreUser.id;
  }

  // ── 3. Sucursal: terminal > env explícito > staff > negocio del dueño ──
  let branchId: string | null = posTerminal?.branchId ?? process.env.BRANCH_ID ?? null;
  if (!branchId && staffBranchId) branchId = staffBranchId;

  if (!branchId && effectiveUserId) {
    const [ownerBiz] = await coreDb
      .select({ id: ownedBusinesses.id })
      .from(ownedBusinesses)
      .where(eq(ownedBusinesses.ownerId, effectiveUserId))
      .limit(1)
      .catch(() => []);
    if (ownerBiz?.id) {
      const ownBranches = await restaurantDb
        .select({ id: branches.id, name: branches.name })
        .from(branches)
        .innerJoin(restaurants, eq(restaurants.id, branches.restaurantId))
        .where(and(eq(restaurants.businessId, ownerBiz.id), eq(branches.isActive, true)));
      const prodBranch =
        ownBranches.find(
          (b: any) =>
            !b.name.toLowerCase().includes("sandbox") && !b.name.toLowerCase().includes("entrenamiento"),
        ) ?? ownBranches[0];
      if (prodBranch?.id) branchId = prodBranch.id;
    }
  }

  if (!branchId) {
    throw new KdsAuthError("FORBIDDEN", "Sin sucursal asignada para esta sesión");
  }

  // ── 4. Pertenencia (solo camino con sesión) ──
  let userId: string | null = null;
  if (posTerminal) {
    // La terminal no aporta persona: su permiso viene de posAuth.method.
    userId = null;
  } else {
    const validatedUserId = await validateBranchMembership({
      userId: effectiveUserId,
      branchId,
      restaurantDb,
      coreDb,
    });
    if (!validatedUserId) {
      throw new KdsAuthError("FORBIDDEN", "Esta sucursal no pertenece a tu usuario");
    }
    userId = validatedUserId;
  }

  return {
    branchId,
    userId,
    staffRole,
    staffBranchId,
    posAuth: posTerminal
      ? {
          method: "terminal",
          terminalId: posTerminal.terminalId,
          sessionId: posTerminal.sessionId,
          branchId: posTerminal.branchId,
          stationId: posTerminal.stationId,
          kind: posTerminal.kind,
          businessId: posTerminal.businessId,
          terminalName: posTerminal.terminalName,
        }
      : { method: userId ? "admin" : "none" },
    posTerminal,
  };
}
