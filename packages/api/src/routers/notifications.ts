import { z } from "zod";
import { eq, desc, and } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { events } from "@rabbitty/database-restaurant/schema";

export const notificationsRouter = router({
  list: protectedProcedure
    .input(z.object({ limit: z.number().optional(), offset: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const limit = input.limit ?? 50;
      const offset = input.offset ?? 0;
      return await ctx.restaurantDb
        .select()
        .from(events)
        .orderBy(desc(events.createdAt))
        .limit(limit)
        .offset(offset);
    }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.restaurantDb.update(events).set({ read: true }).where(eq(events.id, input.id));
      return { success: true };
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.restaurantDb.update(events).set({ read: true }).where(eq(events.branchId, ctx.branchId));
    return { success: true };
  }),

  send: protectedProcedure
    .input(
      z.object({
        branchId: z.string(),
        type: z.string(),
        payload: z.record(z.any()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [event] = await ctx.restaurantDb.insert(events).values({
        branchId: input.branchId,
        type: input.type,
        payload: input.payload,
      }).returning();
      return event;
    }),
});
