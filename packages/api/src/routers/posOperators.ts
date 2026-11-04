import crypto from "crypto";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, terminalProcedure, posPermissionsOf, resolvePosRole } from "../trpc";
import { posOperatorSessions } from "@rabbitty/database-core/schema";
import { staff as staffTable } from "@rabbitty/database-restaurant/schema";
import { verifyPin } from "../services/crypto";
import { assertPinNotLocked, registerPinFail, clearPinFails } from "../services/cashShift";
import { isOperatorSessionsEnabled } from "../services/posOperatorAuth";

/**
 * ── Turno del empleado en la terminal (Fase 3 del ADR-014) ──
 *
 * Todo aquí exige `terminalProcedure`: token de terminal válido. El panel de
 * admin no puede iniciar turnos.
 *
 * El PIN es el `staff.pinCode` que YA existe (scrypt + salt + lockout por
 * intentos). No se crea un PIN nuevo ni se guarda en claro.
 */

const SHIFT_HOURS = 16;

function newToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export const posOperatorsRouter = router({
  /**
   * Estado del turno para la terminal actual.
   * `required` depende del flag; con el flag apagado el POS no pide PIN.
   */
  status: terminalProcedure.query(async ({ ctx }) => ({
    required: isOperatorSessionsEnabled(),
    active: Boolean(ctx.posOperator),
    role: resolvePosRole(ctx),
    permissions: posPermissionsOf(ctx),
    operator: ctx.posOperator
      ? {
          staffId: ctx.posOperator.staffId,
          name: ctx.posOperator.name,
          role: ctx.posOperator.role,
        }
      : null,
    terminalName: ctx.posAuth?.terminalName ?? null,
    branchId: ctx.branchId,
  })),

  /** Empleados activos con PIN configurado. Nunca expone el hash. */
  staffList: terminalProcedure.query(async ({ ctx }) => {
    if (!isOperatorSessionsEnabled()) return [];
    const rows = await ctx.restaurantDb
      .select({ id: staffTable.id, name: staffTable.name, role: staffTable.role, pinCode: staffTable.pinCode })
      .from(staffTable)
      .where(and(eq(staffTable.branchId, ctx.branchId), eq(staffTable.isActive, true)));
    return rows
      .filter((s) => Boolean(s.pinCode))
      .map((s) => ({ id: s.id, name: s.name, role: s.role }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }),

  /**
   * Inicia turno con PIN. Un turno abierto por terminal: antes de crear el
   * nuevo se cierran los huérfanos de esa misma terminal.
   */
  startShift: terminalProcedure
    .input(z.object({ pin: z.string().length(4, "El PIN debe ser de 4 dígitos") }))
    .mutation(async ({ ctx, input }) => {
      if (!isOperatorSessionsEnabled()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "El turno por PIN no está habilitado en este entorno.",
        });
      }

      // Un solo turno por terminal. Si ya hay uno, es idempotente.
      if (ctx.posOperator) {
        return {
          alreadyActive: true as const,
          token: null,
          operator: {
            staffId: ctx.posOperator.staffId,
            name: ctx.posOperator.name,
            role: ctx.posOperator.role,
          },
        };
      }

      const terminalId = ctx.posAuth?.terminalId;
      if (!terminalId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Terminal no identificada" });
      }

      const scope = `pin:pos-operator:${ctx.branchId}`;
      await assertPinNotLocked(ctx.restaurantDb, scope);

      const list = await ctx.restaurantDb
        .select()
        .from(staffTable)
        .where(and(eq(staffTable.branchId, ctx.branchId), eq(staffTable.isActive, true)));

      const match = list.find((s) => s.pinCode && verifyPin(input.pin, s.pinCode));
      if (!match) {
        await registerPinFail(ctx.restaurantDb, scope);
        throw new TRPCError({ code: "UNAUTHORIZED", message: "PIN incorrecto" });
      }
      await clearPinFails(ctx.restaurantDb, scope);

      // Cierra turnos huérfanos de ESTA terminal (p. ej. el navegador perdió
      // el token) para no acumular sesiones abiertas.
      await ctx.coreDb
        .update(posOperatorSessions)
        .set({ endedAt: new Date() })
        .where(
          and(
            eq(posOperatorSessions.terminalId, terminalId),
            isNull(posOperatorSessions.endedAt),
          ),
        );

      const token = newToken();
      const expiresAt = new Date(Date.now() + SHIFT_HOURS * 3600_000);
      const [created] = await ctx.coreDb
        .insert(posOperatorSessions)
        .values({
          terminalId,
          staffId: match.id,
          token,
          expiresAt,
        })
        .returning({ id: posOperatorSessions.id });

      if (!created) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "No se pudo iniciar el turno",
        });
      }

      console.info(
        "[POS_OPERATOR]",
        JSON.stringify({
          event: "start",
          staffId: match.id,
          role: match.role,
          terminalId: ctx.posAuth?.terminalId,
          branchId: ctx.branchId,
        }),
      );

      return {
        alreadyActive: false as const,
        token,
        expiresAt,
        operator: { staffId: match.id, name: match.name, role: match.role },
      };
    }),

  /** Termina el turno actual (o cierra huérfanos de esta terminal). */
  endShift: terminalProcedure.mutation(async ({ ctx }) => {
    const terminalId = ctx.posAuth?.terminalId;
    if (!terminalId) return { closed: false };

    const endedAt = new Date();
    await ctx.coreDb
      .update(posOperatorSessions)
      .set({ endedAt })
      .where(and(eq(posOperatorSessions.terminalId, terminalId), isNull(posOperatorSessions.endedAt)));

    if (ctx.posOperator) {
      console.info(
        "[POS_OPERATOR]",
        JSON.stringify({
          event: "end",
          staffId: ctx.posOperator.staffId,
          terminalId,
          branchId: ctx.branchId,
        }),
      );
    }

    return { closed: true };
  }),
});
