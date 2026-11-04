import { z } from "zod";
import crypto from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { router, protectedProcedure, adminOnlyProcedure, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { branches, restaurants } from "@rabbitty/database-restaurant/schema";
import {
  posTerminals,
  posTerminalSessions,
  posAuthRequests,
} from "@rabbitty/database-core/schema";

/**
 * ── Terminales POS (Fase 1 del ADR-014) ──
 *
 * Objetivo: que el POS tenga su PROPIA sesión, separada del admin, para que un
 * empleado pueda volver a cobrar sin que el administrador escriba su clave cada
 * vez. La autorización del admin sigue siendo la de siempre (NextAuth + 2FA).
 *
 * TODO está detrás del flag `pos_terminal_sessions`: apagado, el POS funciona
 * exactamente como hoy (depende de la sesión de admin).
 *
 * Seguridad:
 *  · El cliente genera un `deviceKey` (secreto local) y el server guarda SOLO
 *    su hash con un pepper del servidor. Nunca se persiste el secreto.
 *  · La sesión de terminal es un token propio, con expiración y revocación.
 *  · Revocar una terminal NO borra historial: solo impide nuevas sesiones.
 */

const TERMINAL_SESSION_HOURS = 12;
const AUTH_REQUEST_MINUTES = 10;

function featureEnabled(): boolean {
  return process.env.POS_TERMINAL_SESSIONS === "1";
}

function hashDeviceKey(deviceKey: string): string {
  const pepper = process.env.POS_TERMINAL_PEPPER || "rabbitty-pos-terminal";
  return crypto.createHmac("sha256", pepper).update(deviceKey).digest("hex");
}

function newToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** Sucursal + negocio del contexto (el POS siempre opera en su sucursal). */
async function resolveScope(ctx: { restaurantDb: any; branchId: string }) {
  const [branch] = await ctx.restaurantDb
    .select({ id: branches.id, restaurantId: branches.restaurantId })
    .from(branches)
    .where(eq(branches.id, ctx.branchId))
    .limit(1);
  if (!branch?.restaurantId) return { branchId: ctx.branchId, businessId: null as string | null };
  const [rest] = await ctx.restaurantDb
    .select({ businessId: restaurants.businessId })
    .from(restaurants)
    .where(eq(restaurants.id, branch.restaurantId))
    .limit(1);
  return { branchId: branch.id, businessId: rest?.businessId ?? null };
}

export const posTerminalsRouter = router({
  /** ¿Está habilitado el modelo de terminal? (el POS decide si lo usa) */
  featureEnabled: publicProcedure.query(async () => ({ enabled: featureEnabled() })),

  /**
   * ── Contexto del POS (Fase 2) ──
   * Devuelve quién está operando: `terminal` (token propio) o `admin`
   * (NextAuth). El layout del POS lo usa como puerta de entrada cuando el flag
   * está activo. Sin principal → UNAUTHORIZED.
   *
   * `branches`: la terminal solo ve SU sucursal; el admin conserva el
   * comportamiento actual (null = que la UI siga usando admin.getBranches).
   */
  sessionContext: publicProcedure.query(async ({ ctx }) => {
    const method = ctx.posAuth?.method ?? "none";

    if (method === "terminal") {
      const [branch] = await ctx.restaurantDb
        .select({ id: branches.id, name: branches.name })
        .from(branches)
        .where(eq(branches.id, ctx.branchId))
        .limit(1);

      // Señal de adopción: una línea por arranque del POS (no por request).
      console.info(
        "[POS_AUTH]",
        JSON.stringify({
          method: "terminal",
          terminalId: ctx.posAuth?.terminalId,
          branchId: ctx.branchId,
        }),
      );

      return {
        mode: "terminal" as const,
        role: "TERMINAL" as const,
        branchId: ctx.branchId,
        businessId: ctx.posAuth?.businessId ?? null,
        terminalName: ctx.posAuth?.terminalName ?? null,
        branches: branch ? [branch] : [],
      };
    }

    if (ctx.userId) {
      console.info(
        "[POS_AUTH]",
        JSON.stringify({ method: "admin", userId: ctx.userId, branchId: ctx.branchId }),
      );
      return {
        mode: "admin" as const,
        role: (ctx.staffRole ?? "OWNER") as "OWNER" | "WAITER" | "CASHIER" | "KITCHEN" | "MANAGER" | "ADMIN",
        branchId: ctx.branchId,
        businessId: null,
        terminalName: null,
        branches: null,
      };
    }

    throw new TRPCError({ code: "UNAUTHORIZED", message: "Sin sesión de POS" });
  }),

  /** Terminales de MI sucursal (para la pantalla de administración). */
  list: protectedProcedure.query(async ({ ctx }) => {
    const scope = await resolveScope(ctx);
    const rows = await ctx.coreDb
      .select({
        id: posTerminals.id,
        name: posTerminals.name,
        platform: posTerminals.platform,
        status: posTerminals.status,
        authorizedAt: posTerminals.authorizedAt,
        expiresAt: posTerminals.expiresAt,
        lastSeenAt: posTerminals.lastSeenAt,
        revokedAt: posTerminals.revokedAt,
      })
      .from(posTerminals)
      .where(eq(posTerminals.branchId, scope.branchId))
      .orderBy(desc(posTerminals.authorizedAt));
    return { terminals: rows };
  }),

  /**
   * Activa ESTE dispositivo como terminal de la sucursal.
   * Requiere sesión administrativa (es un acto de configuración).
   */
  activate: adminOnlyProcedure
    .input(z.object({
      name: z.string().min(2).max(60),
      deviceKey: z.string().min(32).max(200),
      platform: z.string().max(30).optional(),
      hours: z.number().int().min(1).max(24 * 30).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const scope = await resolveScope(ctx);
      const deviceKeyHash = hashDeviceKey(input.deviceKey);
      const expiresAt = new Date(Date.now() + (input.hours ?? TERMINAL_SESSION_HOURS) * 3600_000);

      // Si el dispositivo ya estaba registrado, se reactiva (no se duplica).
      const [existing] = await ctx.coreDb
        .select({ id: posTerminals.id })
        .from(posTerminals)
        .where(eq(posTerminals.deviceKeyHash, deviceKeyHash))
        .limit(1);

      let terminalId: string;
      if (existing) {
        await ctx.coreDb
          .update(posTerminals)
          .set({
            name: input.name,
            branchId: scope.branchId,
            businessId: scope.businessId ?? undefined,
            platform: input.platform ?? null,
            status: "ACTIVE",
            expiresAt,
            revokedAt: null,
            revokedBy: null,
            authorizedBy: ctx.userId ?? null,
            authorizedAt: new Date(),
            lastSeenAt: new Date(),
          })
          .where(eq(posTerminals.id, existing.id));
        terminalId = existing.id;
      } else {
        const [created] = await ctx.coreDb
          .insert(posTerminals)
          .values({
            name: input.name,
            branchId: scope.branchId,
            businessId: scope.businessId ?? null,
            platform: input.platform ?? null,
            deviceKeyHash,
            status: "ACTIVE",
            authorizedBy: ctx.userId ?? null,
            expiresAt,
          })
          .returning({ id: posTerminals.id });
        if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No se pudo registrar la terminal" });
        terminalId = created.id;
      }

      const token = newToken();
      await ctx.coreDb.insert(posTerminalSessions).values({ terminalId, token, expiresAt });

      return { enabled: featureEnabled(), terminalId, sessionToken: token, expiresAt };
    }),

  /** Estado de ESTE dispositivo (sin crear sesión). */
  status: protectedProcedure
    .input(z.object({ deviceKey: z.string().min(32).max(200) }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.coreDb
        .select({
          id: posTerminals.id,
          name: posTerminals.name,
          branchId: posTerminals.branchId,
          status: posTerminals.status,
          expiresAt: posTerminals.expiresAt,
        })
        .from(posTerminals)
        .where(eq(posTerminals.deviceKeyHash, hashDeviceKey(input.deviceKey)))
        .limit(1);

      if (!row) return { authorized: false as const, reason: "NOT_REGISTERED" as const };
      if (row.status !== "ACTIVE") return { authorized: false as const, reason: "REVOKED" as const, name: row.name };
      if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) {
        return { authorized: false as const, reason: "EXPIRED" as const, name: row.name, branchId: row.branchId };
      }
      return { authorized: true as const, name: row.name, branchId: row.branchId, expiresAt: row.expiresAt, terminalId: row.id };
    }),

  /** Emite una sesión de terminal si el dispositivo sigue autorizado. */
  issueSession: protectedProcedure
    .input(z.object({ deviceKey: z.string().min(32).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.coreDb
        .select({ id: posTerminals.id, status: posTerminals.status, expiresAt: posTerminals.expiresAt })
        .from(posTerminals)
        .where(eq(posTerminals.deviceKeyHash, hashDeviceKey(input.deviceKey)))
        .limit(1);

      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Terminal no registrada" });
      if (row.status !== "ACTIVE") throw new TRPCError({ code: "FORBIDDEN", message: "Terminal revocada" });
      if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "La autorización de la terminal venció" });
      }

      const expiresAt = new Date(Date.now() + TERMINAL_SESSION_HOURS * 3600_000);
      const token = newToken();
      await ctx.coreDb.insert(posTerminalSessions).values({ terminalId: row.id, token, expiresAt });
      await ctx.coreDb.update(posTerminals).set({ lastSeenAt: new Date() }).where(eq(posTerminals.id, row.id));

      return { sessionToken: token, expiresAt };
    }),

  /** Revoca una terminal de mi sucursal (bloquea nuevas sesiones). */
  revoke: adminOnlyProcedure
    .input(z.object({ terminalId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const scope = await resolveScope(ctx);
      const [row] = await ctx.coreDb
        .select({ id: posTerminals.id, branchId: posTerminals.branchId })
        .from(posTerminals)
        .where(eq(posTerminals.id, input.terminalId))
        .limit(1);
      if (!row || row.branchId !== scope.branchId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Terminal no encontrada en esta sucursal" });
      }
      await ctx.coreDb
        .update(posTerminals)
        .set({ status: "REVOKED", revokedAt: new Date(), revokedBy: ctx.userId ?? null })
        .where(eq(posTerminals.id, row.id));
      await ctx.coreDb
        .update(posTerminalSessions)
        .set({ revokedAt: new Date() })
        .where(eq(posTerminalSessions.terminalId, row.id));
      return { success: true };
    }),

  /**
   * Crea una solicitud de reautorización (la aprueba el admin desde el móvil).
   * Devuelve un código corto de un solo uso con expiración de minutos.
   */
  createAuthRequest: protectedProcedure
    .input(z.object({ deviceKey: z.string().min(32).max(200), hours: z.number().int().min(1).max(720).optional() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.coreDb
        .select({ id: posTerminals.id })
        .from(posTerminals)
        .where(eq(posTerminals.deviceKeyHash, hashDeviceKey(input.deviceKey)))
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Terminal no registrada" });

      const code = String(crypto.randomInt(100000, 999999));
      const expiresAt = new Date(Date.now() + AUTH_REQUEST_MINUTES * 60_000);
      await ctx.coreDb.insert(posAuthRequests).values({
        terminalId: row.id,
        code,
        requestedById: ctx.userId ?? null,
        requestedHours: input.hours ?? TERMINAL_SESSION_HOURS,
        expiresAt,
      });
      return { code, expiresAt };
    }),

  /** Estado de una solicitud (el POS hace polling mientras espera). */
  authRequestStatus: protectedProcedure
    .input(z.object({ code: z.string().length(6) }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.coreDb
        .select({
          status: posAuthRequests.status,
          expiresAt: posAuthRequests.expiresAt,
          terminalId: posAuthRequests.terminalId,
        })
        .from(posAuthRequests)
        .where(eq(posAuthRequests.code, input.code))
        .limit(1);
      if (!row) return { status: "NOT_FOUND" as const };
      if (row.status === "PENDING" && new Date(row.expiresAt).getTime() < Date.now()) {
        return { status: "EXPIRED" as const };
      }
      return { status: row.status as "PENDING" | "APPROVED" | "DENIED" | "EXPIRED", terminalId: row.terminalId };
    }),

  /** Aprobación (la hace el administrador; aquí valida que sea su sucursal). */
  resolveAuthRequest: adminOnlyProcedure
    .input(z.object({ code: z.string().length(6), approve: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const scope = await resolveScope(ctx);
      const [req] = await ctx.coreDb
        .select({ id: posAuthRequests.id, terminalId: posAuthRequests.terminalId, status: posAuthRequests.status, hours: posAuthRequests.requestedHours })
        .from(posAuthRequests)
        .where(eq(posAuthRequests.code, input.code))
        .limit(1);
      if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "Solicitud no encontrada" });
      if (req.status !== "PENDING") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "La solicitud ya fue resuelta" });

      const [terminal] = await ctx.coreDb
        .select({ id: posTerminals.id, branchId: posTerminals.branchId })
        .from(posTerminals)
        .where(eq(posTerminals.id, req.terminalId))
        .limit(1);
      if (!terminal || terminal.branchId !== scope.branchId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Esa terminal no es de tu sucursal" });
      }

      await ctx.coreDb
        .update(posAuthRequests)
        .set({ status: input.approve ? "APPROVED" : "DENIED", resolvedAt: new Date(), resolvedBy: ctx.userId ?? null })
        .where(eq(posAuthRequests.id, req.id));

      if (input.approve) {
        await ctx.coreDb
          .update(posTerminals)
          .set({ status: "ACTIVE", expiresAt: new Date(Date.now() + req.hours * 3600_000), revokedAt: null, revokedBy: null })
          .where(eq(posTerminals.id, terminal.id));
      }

      return { success: true, approved: input.approve };
    }),
});
