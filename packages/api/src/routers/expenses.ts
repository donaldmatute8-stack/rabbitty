import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { expenses, orders, payments } from "@rabbitty/database-restaurant/schema";

const EXPENSE_CATEGORIES = [
  "RENT", "PAYROLL", "UTILITIES", "SUPPLIES",
  "MAINTENANCE", "MARKETING", "INSURANCE", "OTHER",
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
      if (input?.startDate) conditions.push(sql`${expenses.expenseDate} >= ${new Date(input.startDate)}`);
      if (input?.endDate) {
        const end = new Date(input.endDate);
        end.setDate(end.getDate() + 1);
        conditions.push(sql`${expenses.expenseDate} < ${end}`);
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

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
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
            sql`${expenses.expenseDate} >= ${start}`,
            sql`${expenses.expenseDate} < ${end}`
          )
        );

      const revenueWhere = ctx.staffRole
        ? and(
            sql`${payments.createdAt} >= ${start}`,
            sql`${payments.createdAt} < ${end}`,
            eq(payments.status, "COMPLETED"),
            sql`${payments.orderId} IN (SELECT id FROM orders WHERE "branchId" = ${ctx.staffBranchId})`
          )
        : and(
            sql`${payments.createdAt} >= ${start}`,
            sql`${payments.createdAt} < ${end}`,
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
