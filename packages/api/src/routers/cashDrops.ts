import { settledPaymentStatuses } from "../services/payments/settled";
import { z } from "zod";
import { router, posProcedure, posPermission, resolveBranchId } from "../trpc";
import { eq, and, gte, sql } from "drizzle-orm";
import { branches, cashDrops, payments, orders } from "@rabbitty/database-restaurant/schema";
import { getOpenShift, computeShiftTotals } from "../services/cashShift";
import { TRPCError } from "@trpc/server";

export const cashDropsRouter = router({
  getSettings: posProcedure
    .input(z.object({ branchId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const branchId = await resolveBranchId(ctx, input.branchId);
      const [branch] = await ctx.restaurantDb
        .select({
          cashDropEnabled: branches.cashDropEnabled,
          cashDropThreshold: branches.cashDropThreshold,
          cashDropManagerThreshold: branches.cashDropManagerThreshold,
        })
        .from(branches)
        .where(eq(branches.id, branchId));
      if (!branch) throw new TRPCError({ code: "NOT_FOUND", message: "Branch not found" });
      return branch;
    }),

  updateSettings: posPermission("POS_CASH")
    .input(z.object({
      branchId: z.string().optional(),
      cashDropEnabled: z.boolean(),
      cashDropThreshold: z.number().min(0),
      cashDropManagerThreshold: z.number().min(0).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const branchId = await resolveBranchId(ctx, input.branchId);
      await ctx.restaurantDb
        .update(branches)
        .set({
          cashDropEnabled: input.cashDropEnabled,
          cashDropThreshold: input.cashDropThreshold,
          ...(input.cashDropManagerThreshold !== undefined ? { cashDropManagerThreshold: input.cashDropManagerThreshold } : {}),
        })
        .where(eq(branches.id, branchId));
      return { success: true };
    }),

  getStatus: posProcedure
    .input(z.object({ branchId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const branchId = await resolveBranchId(ctx, input.branchId);
      
      const [branch] = await ctx.restaurantDb
        .select({
          cashDropEnabled: branches.cashDropEnabled,
          cashDropThreshold: branches.cashDropThreshold,
        })
        .from(branches)
        .where(eq(branches.id, branchId));

      if (!branch) throw new TRPCError({ code: "NOT_FOUND", message: "Branch not found" });

      // Estado por turno abierto: fondo + ventas efectivo - retiros (+ ajustes). Sin turno => caja cerrada.
      const shift = await getOpenShift(ctx.restaurantDb, branchId);
      if (!shift) {
        return {
          enabled: branch.cashDropEnabled,
          threshold: branch.cashDropThreshold,
          shiftOpen: false,
          currentCash: 0,
          requiresDrop: false,
          totalCashReceived: 0,
          totalDropped: 0,
          openingFloat: 0,
        };
      }
      const totals = await computeShiftTotals(ctx.restaurantDb, shift);
      const currentCash = totals.expectedCash;
      const requiresDrop = branch.cashDropEnabled && currentCash >= branch.cashDropThreshold;

      return {
        enabled: branch.cashDropEnabled,
        threshold: branch.cashDropThreshold,
        shiftOpen: true,
        currentCash,
        requiresDrop,
        totalCashReceived: totals.cashSales,
        totalDropped: totals.withdrawals,
        openingFloat: totals.openingFloat,
      };
    }),

  listToday: posProcedure
    .input(z.object({ branchId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const branchId = await resolveBranchId(ctx, input.branchId);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return await ctx.restaurantDb
        .select()
        .from(cashDrops)
        .where(
          and(
            eq(cashDrops.branchId, branchId),
            gte(cashDrops.createdAt, today)
          )
        )
        .orderBy(cashDrops.createdAt);
    }),

  createDrop: posPermission("POS_CASH")
    .input(z.object({
      branchId: z.string().optional(),
      amount: z.number().positive(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const branchId = await resolveBranchId(ctx, input.branchId);
      // DEPRECADO: los retiros requieren turno abierto y PIN. Usar cashShifts.withdraw.
      if (branchId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Los retiros ahora requieren turno abierto y PIN (cashShifts.withdraw).",
        });
      }

      // Verify they don't drop more than they have
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const paymentsList = await ctx.restaurantDb
        .select({ amount: payments.amount })
        .from(payments)
        .innerJoin(orders, eq(payments.orderId, orders.id))
        .where(
          and(
            eq(orders.branchId, branchId),
            eq(payments.method, "CASH"),
            settledPaymentStatuses(),
            gte(payments.createdAt, today)
          )
        );
      const totalCashReceived = paymentsList.reduce((sum, p) => sum + Number(p.amount), 0);

      const dropsList = await ctx.restaurantDb
        .select({ amount: cashDrops.amount })
        .from(cashDrops)
        .where(
          and(
            eq(cashDrops.branchId, branchId),
            gte(cashDrops.createdAt, today)
          )
        );
      const totalDropped = dropsList.reduce((sum, d) => sum + Number(d.amount), 0);
      const currentCash = totalCashReceived - totalDropped;

      if (input.amount > currentCash) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Fondos insuficientes. Solo hay $${currentCash.toFixed(2)} en caja.`,
        });
      }

      // We need to resolve the staffId for the user creating the drop
      const { staff } = await import("@rabbitty/database-restaurant/schema");
      // La terminal no tiene userId: el retiro queda a nombre del turno, no de
      // un usuario core. Si hay sesión de usuario, se resuelve su staff.
      const [userStaff] = ctx.userId
        ? await ctx.restaurantDb
            .select({ id: staff.id })
            .from(staff)
            .where(and(eq(staff.userId, ctx.userId), eq(staff.branchId, branchId)))
            .limit(1)
        : [];

      const [drop] = await ctx.restaurantDb.insert(cashDrops).values({
        branchId,
        staffId: userStaff?.id ?? null,
        amount: input.amount,
        notes: input.notes,
      }).returning();

      return drop;
    }),
});
