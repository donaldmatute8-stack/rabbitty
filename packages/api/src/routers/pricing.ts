import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { dynamicPricingRules, menuItems } from "@rabbitty/database-restaurant";

export const pricingRouter = router({
  list: protectedProcedure
    .input(z.object({ branchId: z.string().optional(), isActive: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      const conditions = [];
      if (input.branchId) conditions.push(eq(dynamicPricingRules.branchId, input.branchId));
      if (input.isActive !== undefined) conditions.push(eq(dynamicPricingRules.isActive, input.isActive));

      return conditions.length > 0
        ? await ctx.restaurantDb
            .select()
            .from(dynamicPricingRules)
            .where(and(...conditions))
            .orderBy(desc(dynamicPricingRules.priority))
        : await ctx.restaurantDb
            .select()
            .from(dynamicPricingRules)
            .orderBy(desc(dynamicPricingRules.priority));
    }),

  create: protectedProcedure
    .input(z.object({
      branchId: z.string(),
      menuItemId: z.string().optional(),
      name: z.string().min(1),
      priority: z.number().default(0),
      dayOfWeek: z.number().min(0).max(6).optional(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      adjustmentType: z.enum(["PERCENTAGE", "FIXED"]).default("PERCENTAGE"),
      adjustmentValue: z.number().default(0),
      minPrice: z.number().optional(),
      maxPrice: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [rule] = await ctx.restaurantDb.insert(dynamicPricingRules).values(input).returning();
      return rule;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      menuItemId: z.string().optional(),
      name: z.string().optional(),
      priority: z.number().optional(),
      dayOfWeek: z.number().optional(),
      startTime: z.string().nullable().optional(),
      endTime: z.string().nullable().optional(),
      adjustmentType: z.enum(["PERCENTAGE", "FIXED"]).optional(),
      adjustmentValue: z.number().optional(),
      minPrice: z.number().nullable().optional(),
      maxPrice: z.number().nullable().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [updated] = await ctx.restaurantDb
        .update(dynamicPricingRules)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(dynamicPricingRules.id, id))
        .returning();
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.restaurantDb.delete(dynamicPricingRules).where(eq(dynamicPricingRules.id, input.id));
      return { success: true };
    }),

  calculatePrice: protectedProcedure
    .input(z.object({
      menuItemId: z.string(),
      branchId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const [item] = await ctx.restaurantDb
        .select()
        .from(menuItems)
        .where(eq(menuItems.id, input.menuItemId));

      if (!item) throw new Error("MenuItem not found");

      const now = new Date();
      const currentDay = now.getDay();
      const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

      const rules = await ctx.restaurantDb
        .select()
        .from(dynamicPricingRules)
        .where(
          and(
            eq(dynamicPricingRules.branchId, input.branchId),
            eq(dynamicPricingRules.isActive, true),
            sql`(${dynamicPricingRules.menuItemId} IS NULL OR ${dynamicPricingRules.menuItemId} = ${input.menuItemId})`,
            sql`(${dynamicPricingRules.dayOfWeek} IS NULL OR ${dynamicPricingRules.dayOfWeek} = ${currentDay})`,
            sql`(${dynamicPricingRules.startTime} IS NULL OR ${dynamicPricingRules.startTime} <= ${currentTime})`,
            sql`(${dynamicPricingRules.endTime} IS NULL OR ${dynamicPricingRules.endTime} >= ${currentTime})`,
          )
        )
        .orderBy(desc(dynamicPricingRules.priority));

      let basePrice = item.price;
      const appliedRules: any[] = [];

      for (const rule of rules) {
        let adjustedPrice = basePrice;

        if (rule.adjustmentType === "PERCENTAGE") {
          adjustedPrice = basePrice * (1 + rule.adjustmentValue / 100);
        } else if (rule.adjustmentType === "FIXED") {
          adjustedPrice = basePrice + rule.adjustmentValue;
        }

        if (rule.minPrice !== null && adjustedPrice < rule.minPrice) {
          adjustedPrice = rule.minPrice;
        }
        if (rule.maxPrice !== null && adjustedPrice > rule.maxPrice) {
          adjustedPrice = rule.maxPrice;
        }

        appliedRules.push({
          ruleId: rule.id,
          ruleName: rule.name,
          adjustmentType: rule.adjustmentType,
          adjustmentValue: rule.adjustmentValue,
          originalPrice: basePrice,
          adjustedPrice: Math.round(adjustedPrice * 100) / 100,
        });

        basePrice = adjustedPrice;
      }

      return {
        menuItemId: input.menuItemId,
        menuItemName: item.name,
        basePrice: item.price,
        finalPrice: Math.round(basePrice * 100) / 100,
        appliedRules,
      };
    }),
});
