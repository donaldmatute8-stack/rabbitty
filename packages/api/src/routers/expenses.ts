import { z } from "zod";
import { eq, and, gte, lt, sql } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { expenses, orders, payments, staff as staffTable } from "@rabbitty/database-restaurant/schema";
import { TRPCError } from "@trpc/server";
import { verifyPin } from "../services/crypto";

const EXPENSE_CATEGORIES = [
  "RENT", "PAYROLL", "UTILITIES", "SUPPLIES",
  "MAINTENANCE", "MARKETING", "INSURANCE",
  "REMODELING", "CONSTRUCTION", "OTHER",
] as const;

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
    }))
    .mutation(async ({ ctx, input }) => {
      const [expense] = await ctx.restaurantDb.insert(expenses).values({
        branchId: ctx.branchId,
        ...input,
        expenseDate: input.expenseDate ? new Date(input.expenseDate) : new Date(),
      }).returning();
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
