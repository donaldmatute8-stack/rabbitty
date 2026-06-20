import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { tables } from "@rabbitty/database-restaurant/schema";

export const tableLayoutRouter = router({
  getLayout: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.restaurantDb.select({
      id: tables.id,
      number: tables.number,
      capacity: tables.capacity,
      location: tables.location,
    }).from(tables).where(eq(tables.branchId, ctx.branchId));
  }),

  saveLayout: protectedProcedure
    .input(z.array(z.object({
      id: z.string(),
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
      capacity: z.number().optional(),
    })))
    .mutation(async ({ ctx, input }) => {
      for (const item of input) {
        const layoutJson = JSON.stringify({ x: item.x, y: item.y, width: item.width, height: item.height });
        await ctx.restaurantDb.update(tables).set({
          location: layoutJson,
          ...(item.capacity ? { capacity: item.capacity } : {}),
        }).where(eq(tables.id, item.id));
      }
      return { success: true };
    }),
});
