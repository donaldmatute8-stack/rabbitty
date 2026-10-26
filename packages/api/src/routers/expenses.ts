import { z } from "zod";
import { eq, and, gte, lt, sql } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { expenses, orders, payments, staff as staffTable, cashDrops, cashShiftEvents, cashShifts } from "@rabbitty/database-restaurant/schema";
import { TRPCError } from "@trpc/server";
import { verifyPin } from "../services/crypto";
import { getOpenShift, computeShiftTotals, round2 } from "../services/cashShift";

const EXPENSE_CATEGORIES = [
  "RENT", "PAYROLL", "UTILITIES", "SUPPLIES",
  "MAINTENANCE", "MARKETING", "INSURANCE",
  "REMODELING", "CONSTRUCTION", "OTHER",
] as const;


/** Registro canónico de una salida de gaveta por gasto pagado con efectivo de caja.
 *  Valida saldo disponible (nunca deja la gaveta en negativo) y usa un reference
 *  auditable ligado al gasto para poder revertirlo al editar/eliminar. */
async function createExpenseCashDrop(opts: {
  branchId: string;
  shiftId: string;
  staffId: string | null;
  amount: number;
  description: string;
  expenseId: string;
  tx: any;
}) {
  const { branchId, shiftId, staffId, amount, description, expenseId, tx } = opts;
  // 1. Saldo disponible del turno (idéntico a la regla de cashShifts.withdraw)
  const [shiftRow] = await tx.select().from(cashShifts).where(eq(cashShifts.id, shiftId)).limit(1);
  if (!shiftRow) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "El turno de caja ya no está abierto." });
  const realTotals = await computeShiftTotals(tx, shiftRow);
  const available = round2(realTotals.expectedCash);
  if (amount > available) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `No hay efectivo suficiente en la gaveta para este gasto. Solo hay $${available.toFixed(2)} en caja.`,
    });
  }
  // 2. Revertir cualquier drop previo del mismo gasto (edición) y aplicar el nuevo
  await revertExpenseCashDrop(tx, expenseId);
  await tx.insert(cashDrops).values({
    branchId,
    shiftId,
    staffId,
    amount,
    category: "EXPENSE",
    notes: `Gasto Admin: ${description} (Ref: ${expenseId})`,
  });
  await tx.insert(cashShiftEvents).values({
    shiftId,
    branchId,
    type: "WITHDRAWAL",
    staffId,
    amount,
    notes: `Gasto Admin: ${description} (Ref: ${expenseId})`,
  });
}

/** Revierte el drop de caja de un gasto (elimina los registros ligados a su expenseId). */
async function revertExpenseCashDrop(tx: any, expenseId: string) {
  const prevDrops = await tx.select().from(cashDrops).where(sql`${cashDrops.notes} LIKE ${"%" + expenseId + "%"}`);
  for (const prev of prevDrops) {
    await tx.insert(cashShiftEvents).values({
      shiftId: prev.shiftId,
      branchId: prev.branchId,
      type: "EXPENSE_REVERSED",
      staffId: prev.staffId,
      amount: prev.amount,
      notes: `Reversión de gasto (Ref: ${expenseId})`,
    });
    await tx.delete(cashDrops).where(eq(cashDrops.id, prev.id));
  }
}

export const expensesRouter = router({
  list: protectedProcedure
    .input(z.object({
      category: z.enum(EXPENSE_CATEGORIES).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const conditions = [eq(expenses.branchId, ctx.branchId)];
      if (input?.category) conditions.push(eq(expenses.category, input.category));
      if (input?.startDate) {
        const start = new Date(input.startDate);
        conditions.push(gte(expenses.expenseDate, start));
      }
      if (input?.endDate) {
        const end = new Date(input.endDate);
        end.setDate(end.getDate() + 1);
        conditions.push(lt(expenses.expenseDate, end));
      }

      return ctx.restaurantDb
        .select()
        .from(expenses)
        .where(and(...conditions))
        .orderBy(expenses.expenseDate);
    }),

  create: protectedProcedure
    .input(z.object({
      category: z.enum(EXPENSE_CATEGORIES),
      description: z.string(),
      amount: z.number().positive(),
      expenseDate: z.string().optional(),
      reference: z.string().optional(),
      paidTo: z.string().optional(),
      notes: z.string().optional(),
      deductFromCashDrawer: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { deductFromCashDrawer, ...expenseData } = input;

      const [expense] = await ctx.restaurantDb.insert(expenses).values({
        branchId: ctx.branchId,
        ...expenseData,
        expenseDate: expenseData.expenseDate ? new Date(expenseData.expenseDate) : new Date(),
      }).returning();

      // Si el dueño marca que el gasto se pagó con efectivo de la gaveta, registrar salida en el turno activo
      if (deductFromCashDrawer) {
        const activeShift = await getOpenShift(ctx.restaurantDb, ctx.branchId);
        if (activeShift) {
          const amount = round2(expenseData.amount);
          await ctx.restaurantDb.insert(cashDrops).values({
            branchId: ctx.branchId,
            shiftId: activeShift.id,
            staffId: activeShift.currentStaffId,
            amount,
            category: "EXPENSE",
            notes: `Gasto Admin: ${expenseData.description}${expense?.id ? ` (Ref: ${expense.id})` : ""}`,
          });

          await ctx.restaurantDb.insert(cashShiftEvents).values({
            shiftId: activeShift.id,
            branchId: ctx.branchId,
            type: "WITHDRAWAL",
            staffId: activeShift.currentStaffId,
            amount,
            notes: `Gasto Admin: ${expenseData.description}`,
          });
        }
      }

      return expense;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      category: z.enum(EXPENSE_CATEGORIES),
      description: z.string(),
      amount: z.number().positive(),
      expenseDate: z.string().optional(),
      reference: z.string().optional(),
      paidTo: z.string().optional(),
      notes: z.string().optional(),
      editReason: z.string().min(1, "Debes especificar el motivo del cambio"),
      adminPin: z.string().length(4).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify Admin / Manager PIN
      const admins = await ctx.restaurantDb
        .select()
        .from(staffTable)
        .where(
          and(
            eq(staffTable.branchId, ctx.branchId),
            sql`lower(${staffTable.role}) IN ('admin', 'manager')`
          )
        );

      const hasConfiguredPin = admins.some((a) => !!a.pinCode);

      if (hasConfiguredPin) {
        if (!input.adminPin) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Se requiere PIN de Administrador para editar gastos",
          });
        }

        const isValid = admins.some(
          (a) => a.pinCode && verifyPin(input.adminPin!, a.pinCode)
        );

        if (!isValid) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "PIN de Administrador incorrecto",
          });
        }
      }

      const formattedNotes = input.editReason
        ? `${input.notes ? input.notes + " | " : ""}Motivo edición: ${input.editReason}`
        : input.notes;

      const [updated] = await ctx.restaurantDb
        .update(expenses)
        .set({
          category: input.category,
          description: input.description,
          amount: input.amount,
          expenseDate: input.expenseDate ? new Date(input.expenseDate) : undefined,
          reference: input.reference ?? null,
          paidTo: input.paidTo ?? null,
          notes: formattedNotes,
          updatedAt: new Date(),
        })
        .where(and(eq(expenses.id, input.id), eq(expenses.branchId, ctx.branchId)))
        .returning();

      // ── Sincronizar gaveta si el gasto pagó con efectivo de caja ──
      if (updated) {
        const activeShift = await getOpenShift(ctx.restaurantDb, ctx.branchId);
        if (activeShift) {
          await createExpenseCashDrop({
            branchId: ctx.branchId,
            shiftId: activeShift.id,
            staffId: activeShift.currentStaffId,
            amount: round2(updated.amount),
            description: updated.description,
            expenseId: updated.id,
            tx: ctx.restaurantDb,
          });
        } else {
          // Sin turno abierto: revertir ajuste previo. revertExpenseCashDrop registra
          // los eventos de reversión con el shiftId de cada drop original.
          await revertExpenseCashDrop(ctx.restaurantDb, updated.id);
        }
      }

      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ 
      id: z.string(),
      adminPin: z.string().length(4).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Find admin/managers for this branch
      const admins = await ctx.restaurantDb
        .select()
        .from(staffTable)
        .where(
          and(
            eq(staffTable.branchId, ctx.branchId),
            sql`lower(${staffTable.role}) IN ('admin', 'manager')`
          )
        );

      const hasConfiguredPin = admins.some((a) => !!a.pinCode);

      if (hasConfiguredPin) {
        if (!input.adminPin) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Se requiere PIN de Administrador para eliminar gastos",
          });
        }

        const isValid = admins.some(
          (a) => a.pinCode && verifyPin(input.adminPin!, a.pinCode)
        );

        if (!isValid) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "PIN de Administrador incorrecto",
          });
        }
      }

      await ctx.restaurantDb.delete(expenses).where(eq(expenses.id, input.id));

      // ── Revertir el ajuste de gaveta ligado a este gasto ──
      const activeShift = await getOpenShift(ctx.restaurantDb, ctx.branchId);
      await revertExpenseCashDrop(ctx.restaurantDb, input.id);
      if (activeShift) {
        await ctx.restaurantDb.insert(cashShiftEvents).values({
          shiftId: activeShift.id,
          branchId: ctx.branchId,
          type: "EXPENSE_REVERSED",
          notes: `Gasto eliminado: ajuste de gaveta revertido (Ref: ${input.id})`,
        });
      }
      return { success: true };
    }),

  getPandL: protectedProcedure
    .input(z.object({
      startDate: z.string(),
      endDate: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const start = new Date(input.startDate);
      const end = new Date(input.endDate);
      end.setDate(end.getDate() + 1);

      const expenseList = await ctx.restaurantDb
        .select()
        .from(expenses)
        .where(
          and(
            eq(expenses.branchId, ctx.branchId),
            gte(expenses.expenseDate, start),
            lt(expenses.expenseDate, end)
          )
        );

      const revenueWhere = ctx.staffRole
        ? and(
            gte(payments.createdAt, start),
            lt(payments.createdAt, end),
            eq(payments.status, "COMPLETED"),
            sql`${payments.orderId} IN (SELECT id FROM orders WHERE "branchId" = ${ctx.staffBranchId})`
          )
        : and(
            gte(payments.createdAt, start),
            lt(payments.createdAt, end),
            eq(payments.status, "COMPLETED")
          );

      const revenue = await ctx.restaurantDb
        .select({ total: sql<number>`COALESCE(SUM(${payments.amount}), 0)` })
        .from(payments)
        .where(revenueWhere);

      const totalRevenue = revenue[0]?.total ?? 0;
      const totalExpenses = expenseList.reduce((sum, e) => sum + e.amount, 0);

      const byCategory = EXPENSE_CATEGORIES.map((cat) => ({
        category: cat,
        total: expenseList.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0),
        count: expenseList.filter((e) => e.category === cat).length,
      })).filter((c) => c.count > 0);

      return {
        period: { start: input.startDate, end: input.endDate },
        revenue: totalRevenue,
        expenses: totalExpenses,
        netProfit: totalRevenue - totalExpenses,
        margin: totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0,
        byCategory,
        totalTransactions: expenseList.length,
      };
    }),
});
