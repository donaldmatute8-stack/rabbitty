import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import * as dbSchema from "@rabbitty/database-restaurant";
import { bus, EventTypes } from "@rabbitty/events";
import { restaurants, orders, tables } from "@rabbitty/database-restaurant/schema";
import { miniappClient } from "../services/miniapp-client";



export const adminRouter = router({
  getRestaurants: protectedProcedure.query(async ({ ctx }) => {
    const result = await ctx.restaurantDb.select().from(restaurants);
    return result;
  }),

  updateRestaurant: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        slug: z.string().optional(),
        currency: z.string().optional(),
        taxRate: z.number().optional(),
        timezone: z.string().optional(),
        defaultRewardRate: z.number().optional(),
        acceptsBunz: z.boolean().optional(),
        happyHourStart: z.string().optional().nullable(),
        happyHourEnd: z.string().optional().nullable(),
        happyHourRewardRate: z.number().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.restaurantDb.update(restaurants).set(input).where(eq(restaurants.id, input.id));

      // Auto-sync to miniapp
      try {
        const [updated] = await ctx.restaurantDb.select().from(restaurants).where(eq(restaurants.id, input.id));
        if (updated?.businessId) {
          await miniappClient.createBusiness({
            name: updated.name,
            category: "Restaurante",
            address: "",
            rewardPercentage: updated.defaultRewardRate ?? 10,
            telegramId: updated.businessId,
          });
        }
      } catch {
        // Non-critical — restaurant updated locally
      }

      return { success: true };
    }),

  verifyBusiness: protectedProcedure
    .input(z.object({ businessId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [restaurant] = await ctx.restaurantDb.select().from(restaurants).where(eq(restaurants.businessId, input.businessId));
      if (restaurant) {
        await ctx.restaurantDb.update(restaurants).set({ isActive: true }).where(eq(restaurants.id, restaurant.id));
        return { success: true, restaurantId: restaurant.id };
      }
      return { success: false };
    }),

  createCategory: protectedProcedure
    .input(
      z.object({
        branchId: z.string(),
        name: z.string(),
        description: z.string().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [category] = await ctx.restaurantDb.insert(dbSchema.menuCategories).values({
        branchId: input.branchId,
        name: input.name,
        description: input.description ?? null,
        sortOrder: input.sortOrder ?? 0,
      }).returning();
      return category;
    }),

  updateCategory: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.restaurantDb.update(dbSchema.menuCategories).set(input).where(eq(dbSchema.menuCategories.id, input.id));
      return { success: true };
    }),

  deleteCategory: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.restaurantDb.delete(dbSchema.menuCategories).where(eq(dbSchema.menuCategories.id, input.id));
      return { success: true };
    }),

  createMenuItem: protectedProcedure
    .input(
      z.object({
        categoryId: z.string(),
        branchId: z.string(),
        name: z.string(),
        description: z.string().optional(),
        price: z.number(),
        cost: z.number().optional(),
        imageUrl: z.string().optional(),
        sku: z.string().optional(),
        isAvailable: z.boolean().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [menuItem] = await ctx.restaurantDb.insert(dbSchema.menuItems).values({
        categoryId: input.categoryId,
        branchId: input.branchId,
        name: input.name,
        description: input.description ?? null,
        price: input.price,
        cost: input.cost ?? 0,
        imageUrl: input.imageUrl ?? null,
        sku: input.sku ?? null,
        isAvailable: input.isAvailable ?? true,
        sortOrder: input.sortOrder ?? 0,
      }).returning();
      return menuItem;
    }),

  updateMenuItem: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        categoryId: z.string().optional(),
        name: z.string().optional(),
        description: z.string().optional(),
        price: z.number().optional(),
        cost: z.number().optional(),
        imageUrl: z.string().optional(),
        sku: z.string().optional(),
        isAvailable: z.boolean().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.restaurantDb.update(dbSchema.menuItems).set(input).where(eq(dbSchema.menuItems.id, input.id));
      return { success: true };
    }),

  deleteMenuItem: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.restaurantDb.delete(dbSchema.menuItems).where(eq(dbSchema.menuItems.id, input.id));
      return { success: true };
    }),

  getSalesReport: protectedProcedure
    .input(
      z.object({
        startDate: z.string(),
        endDate: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const result = await ctx.restaurantDb.select().from(orders).where(
        and(
          eq(orders.branchId, ctx.branchId),
          sql`${orders.createdAt} BETWEEN ${input.startDate} AND ${input.endDate}`
        )
      );
      const totalSales = result.reduce((sum, order) => sum + order.total, 0);
      const totalOrders = result.length;
      return { totalSales, totalOrders };
    }),

  getDashboardStats: protectedProcedure.query(async ({ ctx }) => {
    const [totalOrdersResult, totalRevenueResult, activeTablesResult] = await Promise.all([
      ctx.restaurantDb.select().from(orders).where(eq(orders.branchId, ctx.branchId)),
      ctx.restaurantDb.select({ sum: orders.total }).from(orders).where(eq(orders.branchId, ctx.branchId)),
      ctx.restaurantDb.select().from(tables).where(eq(tables.branchId, ctx.branchId)),
    ]);
    
    const totalOrders = totalOrdersResult.length;
    const totalRevenue = Number(totalRevenueResult[0]?.sum ?? 0);
    const activeTables = activeTablesResult.length;
    
    const totalCustomersResult = await ctx.restaurantDb.select({ count: orders.id }).from(orders).where(eq(orders.branchId, ctx.branchId));
    const totalCustomers = Number(totalCustomersResult[0]?.count ?? 0);
    
    return {
      totalOrders,
      totalRevenue,
      activeTables,
      totalCustomers,
    };
  }),
});
