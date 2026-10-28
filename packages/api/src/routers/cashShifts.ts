import { z } from "zod";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, adminOnlyProcedure, resolveBranchId } from "../trpc";
import { branches, cashDrops, cashShiftEvents, cashShifts, staff } from "@rabbitty/database-restaurant/schema";
import {
  CASHIER_ROLES,
  MANAGER_ROLES,
  computeShiftTotals,
  findStaffByPin,
  getOpenShift,
  lockShift,
  nameOf,
  round2,
} from "../services/cashShift";

const pin = z.string().regex(/^\d{4}$/, "El PIN debe ser de 4 dígitos");
const money = z.number().min(0).max(10_000_000);
const branchInput = { branchId: z.string().optional() };

export const cashShiftsRouter = router({
  /** Estado actual: turno abierto (si existe), totales y bitácora. Sin PIN (solo lectura). */
  current: protectedProcedure.input(z.object(branchInput)).query(async ({ ctx, input }) => {
    const branchId = await resolveBranchId(ctx, input.branchId);
    const [branch] = await ctx.restaurantDb
      .select({
        name: branches.name,
        cashDropEnabled: branches.cashDropEnabled,
        cashDropThreshold: branches.cashDropThreshold,
        cashDropManagerThreshold: branches.cashDropManagerThreshold,
      })
      .from(branches)
      .where(eq(branches.id, branchId));
    const shift = await getOpenShift(ctx.restaurantDb, branchId);
    if (!shift) {
      return { open: false as const, settings: branch ?? null };
    }
    const totals = await computeShiftTotals(ctx.restaurantDb, shift);
    const events = await ctx.restaurantDb
      .select()
      .from(cashShiftEvents)
      .where(eq(cashShiftEvents.shiftId, shift.id))
      .orderBy(cashShiftEvents.createdAt);
    return {
      open: true as const,
      shift: {
        ...shift,
        openedByName: await nameOf(ctx.restaurantDb, shift.openedByStaffId),
        currentStaffName: await nameOf(ctx.restaurantDb, shift.currentStaffId),
      },
      totals,
      events,
      settings: branch ?? null,
    };
  }),

  /** Apertura: PIN del cajero + fondo inicial. Un solo turno OPEN por caja (índice único). */
  open: protectedProcedure
    .input(z.object({ ...branchInput, pin, openingFloat: money, registerId: z.string().default("MAIN") }))
    .mutation(async ({ ctx, input }) => {
      const branchId = await resolveBranchId(ctx, input.branchId);
      const cashier = await findStaffByPin(ctx.restaurantDb, branchId, input.pin, CASHIER_ROLES, "PIN de cajero incorrecto");
      try {
        return await ctx.restaurantDb.transaction(async (tx: any) => {
          const existing = await getOpenShift(tx, branchId, input.registerId);
          if (existing) {
            throw new TRPCError({ code: "CONFLICT", message: "Ya hay un turno abierto en esta caja." });
          }
          const [shift] = await tx
            .insert(cashShifts)
            .values({
              branchId,
              registerId: input.registerId,
              openedByStaffId: cashier.id,
              currentStaffId: cashier.id,
              openingFloat: round2(input.openingFloat),
            })
            .returning();
          await tx.insert(cashShiftEvents).values({
            shiftId: shift.id,
            branchId,
            type: "OPEN",
            staffId: cashier.id,
            amount: round2(input.openingFloat),
          });
          return { shift, cashierName: cashier.name };
        });
      } catch (e: any) {
        if (e instanceof TRPCError) throw e;
        if (String(e?.message ?? e).includes("cash_shifts_one_open_per_register")) {
          throw new TRPCError({ code: "CONFLICT", message: "Ya hay un turno abierto en esta caja." });
        }
        throw e;
      }
    }),

  /** Retiro: PIN del cajero del turno. Sobre el umbral configurable exige PIN de manager/admin. */
  withdraw: protectedProcedure
    .input(
      z.object({
        ...branchInput,
        pin,
        managerPin: pin.optional(),
        amount: z.number().positive().max(10_000_000),
        category: z.enum(["EXPENSE", "SAFE"]).default("SAFE"),
        notes: z.string().max(300).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const branchId = await resolveBranchId(ctx, input.branchId);
      const shift = await getOpenShift(ctx.restaurantDb, branchId);
      if (!shift) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No hay turno abierto." });

      const actor = await findStaffByPin(ctx.restaurantDb, branchId, input.pin, CASHIER_ROLES);
      const isHolder = actor.id === shift.currentStaffId;
      const isManager = MANAGER_ROLES.includes(String(actor.role).toUpperCase());
      if (!isHolder && !isManager) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Solo el cajero del turno o un manager puede retirar." });
      }

      const [branch] = await ctx.restaurantDb
        .select({ t: branches.cashDropManagerThreshold })
        .from(branches)
        .where(eq(branches.id, branchId));
      const threshold = branch?.t ?? 1000;

      let authorizedById: string | null = isManager ? actor.id : null;
      if (input.amount > threshold && !isManager) {
        if (!input.managerPin) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `MANAGER_PIN_REQUIRED: Retiros mayores a $${threshold.toFixed(2)} requieren PIN de manager/admin.`,
          });
        }
        const mgr = await findStaffByPin(ctx.restaurantDb, branchId, input.managerPin, MANAGER_ROLES, "PIN de manager/admin incorrecto");
        authorizedById = mgr.id;
      }

      return await ctx.restaurantDb.transaction(async (tx: any) => {
        await lockShift(tx, shift.id);
        const totals = await computeShiftTotals(tx, shift);
        if (round2(input.amount) > totals.expectedCash) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Fondos insuficientes. Solo hay $${totals.expectedCash.toFixed(2)} en caja.`,
          });
        }
        const [drop] = await tx
          .insert(cashDrops)
          .values({
            branchId,
            shiftId: shift.id,
            staffId: actor.id,
            amount: round2(input.amount),
            category: input.category,
            notes: input.notes,
          })
          .returning();
        await tx.insert(cashShiftEvents).values({
          shiftId: shift.id,
          branchId,
          type: "WITHDRAWAL",
          staffId: actor.id,
          authorizedById,
          amount: round2(input.amount),
          notes: input.notes,
        });
        return { drop, cashierName: actor.name, authorizedByName: await nameOf(tx, authorizedById) };
      });
    }),

  /** Cierre parcial (Ticket X): reporte previo o arqueo, el turno sigue abierto. */
  partialClose: protectedProcedure
    .input(z.object({ ...branchInput, pin, countedCash: money.optional(), notes: z.string().max(300).optional() }))
    .mutation(async ({ ctx, input }) => {
      const branchId = await resolveBranchId(ctx, input.branchId);
      const shift = await getOpenShift(ctx.restaurantDb, branchId);
      if (!shift) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No hay turno abierto." });
      const actor = await findStaffByPin(ctx.restaurantDb, branchId, input.pin, CASHIER_ROLES);
      if (actor.id !== shift.currentStaffId && !MANAGER_ROLES.includes(String(actor.role).toUpperCase())) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Solo el cajero del turno o un manager puede hacer el corte X." });
      }
      return await ctx.restaurantDb.transaction(async (tx: any) => {
        await lockShift(tx, shift.id);
        const totals = await computeShiftTotals(tx, shift);
        const hasCounted = typeof input.countedCash === "number" && !isNaN(input.countedCash);
        const counted = hasCounted ? round2(input.countedCash!) : totals.expectedCash;
        const difference = hasCounted ? round2(counted - totals.expectedCash) : 0;
        await tx.insert(cashShiftEvents).values({
          shiftId: shift.id,
          branchId,
          type: "PARTIAL_CLOSE",
          staffId: actor.id,
          expectedAmount: totals.expectedCash,
          countedAmount: counted,
          difference,
          notes: input.notes || (hasCounted ? undefined : "Reporte Previo Informativo X"),
        });
        return {
          kind: "X" as const,
          cashierName: actor.name,
          openedAt: shift.openedAt,
          ...totals,
          countedCash: counted,
          difference,
          isInformativeOnly: !hasCounted,
        };
      });
    }),

  /** Traspaso: saliente cuenta con su PIN, entrante recibe con el suyo. Si hay descuadre exige manager. */
  handover: protectedProcedure
    .input(
      z.object({
        ...branchInput,
        outgoingPin: pin,
        incomingPin: pin,
        managerPin: pin.optional(),
        countedCash: money,
        notes: z.string().max(300).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const branchId = await resolveBranchId(ctx, input.branchId);
      const shift = await getOpenShift(ctx.restaurantDb, branchId);
      if (!shift) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No hay turno abierto." });

      const outgoing = await findStaffByPin(ctx.restaurantDb, branchId, input.outgoingPin, CASHIER_ROLES, "PIN del cajero saliente incorrecto");
      if (outgoing.id !== shift.currentStaffId && !MANAGER_ROLES.includes(String(outgoing.role).toUpperCase())) {
        throw new TRPCError({ code: "FORBIDDEN", message: "El PIN saliente no corresponde al cajero del turno." });
      }
      const incoming = await findStaffByPin(ctx.restaurantDb, branchId, input.incomingPin, CASHIER_ROLES, "PIN del cajero entrante incorrecto");
      if (incoming.id === shift.currentStaffId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "El cajero entrante debe ser distinto al saliente." });
      }

      // PIN de manager verificado FUERA de la transacción (un rollback no debe borrar el conteo de intentos)
      const managerCheck = input.managerPin
        ? await findStaffByPin(ctx.restaurantDb, branchId, input.managerPin, MANAGER_ROLES, "PIN de manager/admin incorrecto")
        : null;

      return await ctx.restaurantDb.transaction(async (tx: any) => {
        await lockShift(tx, shift.id);
        const totals = await computeShiftTotals(tx, shift);
        const counted = round2(input.countedCash);
        const difference = round2(counted - totals.expectedCash);

        let authorizedById: string | null = null;
        if (Math.abs(difference) >= 0.01) {
          if (!input.notes?.trim()) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Hay descuadre: escribe una nota justificativa." });
          }
          if (!managerCheck) {
            throw new TRPCError({ code: "FORBIDDEN", message: "MANAGER_PIN_REQUIRED: Descuadre en traspaso, requiere PIN de manager/admin." });
          }
          authorizedById = managerCheck?.id ?? null;
        }

        await tx.update(cashShifts).set({ currentStaffId: incoming.id }).where(eq(cashShifts.id, shift.id));
        await tx.insert(cashShiftEvents).values({
          shiftId: shift.id,
          branchId,
          type: "HANDOVER",
          staffId: outgoing.id,
          toStaffId: incoming.id,
          authorizedById,
          expectedAmount: totals.expectedCash,
          countedAmount: counted,
          difference,
          notes: input.notes,
        });
        return {
          kind: "HANDOVER" as const,
          cashierName: outgoing.name,
          incomingName: incoming.name,
          openedAt: shift.openedAt,
          ...totals,
          countedCash: counted,
          difference,
        };
      });
    }),

  /** Cierre Z: arqueo ciego + PIN manager/admin siempre. Descuadre exige nota. */
  close: protectedProcedure
    .input(
      z.object({
        ...branchInput,
        pin,
        managerPin: pin,
        countedCash: money,
        notes: z.string().max(300).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const branchId = await resolveBranchId(ctx, input.branchId);
      const shift = await getOpenShift(ctx.restaurantDb, branchId);
      if (!shift) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No hay turno abierto." });

      const actor = await findStaffByPin(ctx.restaurantDb, branchId, input.pin, CASHIER_ROLES);
      if (actor.id !== shift.currentStaffId && !MANAGER_ROLES.includes(String(actor.role).toUpperCase())) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Solo el cajero del turno o un manager puede cerrar." });
      }
      const mgr = await findStaffByPin(ctx.restaurantDb, branchId, input.managerPin, MANAGER_ROLES, "PIN de manager/admin incorrecto");

      const closedAt = new Date();
      return await ctx.restaurantDb.transaction(async (tx: any) => {
        await lockShift(tx, shift.id);
        const totals = await computeShiftTotals(tx, shift);
        const counted = round2(input.countedCash);
        const difference = round2(counted - totals.expectedCash);
        if (Math.abs(difference) >= 0.01 && !input.notes?.trim()) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Hay descuadre: escribe una nota justificativa." });
        }
        const updated = await tx
          .update(cashShifts)
          .set({
            status: "CLOSED",
            closedAt,
            closedByStaffId: actor.id,
            authorizedByStaffId: mgr.id,
            expectedCash: totals.expectedCash,
            countedCash: counted,
            difference,
            closeNotes: input.notes,
          })
          .where(and(eq(cashShifts.id, shift.id), eq(cashShifts.status, "OPEN")))
          .returning({ id: cashShifts.id });
        if (updated.length === 0) {
          throw new TRPCError({ code: "CONFLICT", message: "El turno ya fue cerrado." });
        }
        await tx.insert(cashShiftEvents).values({
          shiftId: shift.id,
          branchId,
          type: "CLOSE",
          staffId: actor.id,
          authorizedById: mgr.id,
          expectedAmount: totals.expectedCash,
          countedAmount: counted,
          difference,
          notes: input.notes,
        });

        return {
          kind: "Z" as const,
          cashierName: actor.name,
          authorizedByName: mgr.name,
          openedAt: shift.openedAt,
          closedAt,
          ...totals,
          countedCash: counted,
          difference,
          notes: input.notes ?? null,
        };
      });
    }),

  /** Historial de turnos (admin/manager). */
  history: adminOnlyProcedure
    .input(
      z.object({
        ...branchInput,
        from: z.string().optional(),
        to: z.string().optional(),
        limit: z.number().min(1).max(200).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const branchId = await resolveBranchId(ctx, input.branchId);
      const conds = [eq(cashShifts.branchId, branchId)];
      if (input.from) conds.push(gte(cashShifts.openedAt, new Date(input.from)));
      if (input.to) conds.push(lte(cashShifts.openedAt, new Date(input.to)));
      const rows = await ctx.restaurantDb
        .select()
        .from(cashShifts)
        .where(and(...conds))
        .orderBy(desc(cashShifts.openedAt))
        .limit(input.limit);
      const names = new Map<string, string>();
      const all = await ctx.restaurantDb.select({ id: staff.id, name: staff.name }).from(staff).where(eq(staff.branchId, branchId));
      all.forEach((s: any) => names.set(s.id, s.name));
      return rows.map((r: any) => ({
        ...r,
        openedByName: names.get(r.openedByStaffId) ?? null,
        closedByName: r.closedByStaffId ? names.get(r.closedByStaffId) ?? null : null,
        authorizedByName: r.authorizedByStaffId ? names.get(r.authorizedByStaffId) ?? null : null,
      }));
    }),

  /** Bitácora de un turno (inmutable). */
  events: adminOnlyProcedure
    .input(z.object({ ...branchInput, shiftId: z.string() }))
    .query(async ({ ctx, input }) => {
      const branchId = await resolveBranchId(ctx, input.branchId);
      const rows = await ctx.restaurantDb
        .select()
        .from(cashShiftEvents)
        .where(and(eq(cashShiftEvents.shiftId, input.shiftId), eq(cashShiftEvents.branchId, branchId)))
        .orderBy(cashShiftEvents.createdAt);
      const all = await ctx.restaurantDb.select({ id: staff.id, name: staff.name }).from(staff).where(eq(staff.branchId, branchId));
      const names = new Map<string, string>(all.map((s: any) => [s.id, s.name]));
      return rows.map((e: any) => ({
        ...e,
        staffName: e.staffId ? names.get(e.staffId) ?? null : null,
        toStaffName: e.toStaffId ? names.get(e.toStaffId) ?? null : null,
        authorizedByName: e.authorizedById ? names.get(e.authorizedById) ?? null : null,
      }));
    }),
});
