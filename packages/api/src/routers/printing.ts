import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import * as dbSchema from "@rabbitty/database-restaurant";
import { restaurants, branches, orders } from "@rabbitty/database-restaurant/schema";

export const printingRouter = router({
  getPrinters: protectedProcedure.query(async ({ ctx }) => {
    const [branch] = await ctx.restaurantDb.select().from(branches).where(eq(branches.id, ctx.branchId));
    if (!branch) return { printers: [] };
    const [restaurant] = await ctx.restaurantDb.select().from(restaurants).where(eq(restaurants.id, branch.restaurantId));
    return { 
      printers: restaurant?.printerType ? [{ type: restaurant.printerType, config: restaurant.printerConfig }] : [],
      restaurant,
      branch
    };
  }),

  getTicketData: protectedProcedure
    .input(z.object({ orderId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      let [branch] = await ctx.restaurantDb.select().from(branches).where(eq(branches.id, ctx.branchId));
      let restaurant = null;
      if (branch) {
        [restaurant] = await ctx.restaurantDb.select().from(restaurants).where(eq(restaurants.id, branch.restaurantId));
      } else {
        // Fallback para Superadmin que no tiene un staff asociado a una sucursal específica.
        // Tomamos el primer restaurante y su primera sucursal.
        const allRestaurants = await ctx.restaurantDb.select().from(restaurants);
        if (allRestaurants.length > 0 && allRestaurants[0]) {
          restaurant = allRestaurants[0];
          const restBranches = await ctx.restaurantDb.select().from(branches).where(eq(branches.restaurantId, restaurant.id));
          if (restBranches.length > 0) {
            branch = restBranches[0];
          }
        }
      }

      let order = null;
      if (input?.orderId) {
        [order] = await ctx.restaurantDb.select().from(orders).where(eq(orders.id, input.orderId));
      }

      return {
        restaurant,
        branch,
        order,
      };
    }),

  printOrder: protectedProcedure
    .input(z.object({ orderId: z.string() }))
    .mutation(async ({ ctx, input }) => {
       const [order] = await ctx.restaurantDb.select().from(orders).where(eq(orders.id, input.orderId));
       if (!order) {
         throw new Error("Orden no encontrada");
       }
      return { success: true, orderId: input.orderId };
    }),
});
