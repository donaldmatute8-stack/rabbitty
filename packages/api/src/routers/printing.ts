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
    return { printers: restaurant?.printerType ? [{ type: restaurant.printerType, config: restaurant.printerConfig }] : [] };
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
