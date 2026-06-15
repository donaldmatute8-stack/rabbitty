import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { webhooks } from "@rabbitty/database-restaurant/schema";



export const webhooksRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.restaurantDb.select().from(webhooks).where(eq(webhooks.branchId, ctx.branchId));
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        url: z.string().url(),
        events: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [webhook] = await ctx.restaurantDb.insert(webhooks).values({
        branchId: ctx.branchId,
        name: input.name,
        url: input.url,
        events: input.events,
      }).returning();
      return webhook;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [webhook] = await ctx.restaurantDb.delete(webhooks).where(
        and(eq(webhooks.id, input.id), eq(webhooks.branchId, ctx.branchId))
      ).returning();
      if (!webhook) throw new Error("Webhook no encontrado");
      return { success: true };
    }),

  toggle: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [webhook] = await ctx.restaurantDb.select().from(webhooks).where(
        and(eq(webhooks.id, input.id), eq(webhooks.branchId, ctx.branchId))
      );
      if (!webhook) throw new Error("Webhook no encontrado");
      const [updated] = await ctx.restaurantDb
        .update(webhooks)
        .set({ isActive: !webhook.isActive })
        .where(eq(webhooks.id, input.id))
        .returning();
      return updated;
    }),
});
