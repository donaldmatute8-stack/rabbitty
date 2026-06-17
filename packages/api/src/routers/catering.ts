import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { cateringEvents, branches } from "@rabbitty/database-restaurant";

export const cateringRouter = router({
  list: protectedProcedure
    .input(z.object({
      branchId: z.string().optional(),
      status: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [];
      if (input.branchId) conditions.push(eq(cateringEvents.branchId, input.branchId));
      if (input.status) conditions.push(eq(cateringEvents.status, input.status));

      const query = ctx.restaurantDb
        .select()
        .from(cateringEvents)
        .orderBy(desc(cateringEvents.eventDate));

      const result = conditions.length > 0
        ? await query.where(conditions.reduce((a, b) => a && b))
        : await query;

      return result;
    }),

  create: protectedProcedure
    .input(z.object({
      branchId: z.string(),
      eventName: z.string().min(1),
      eventDate: z.string(),
      partySize: z.number().default(1),
      customerName: z.string().min(1),
      customerPhone: z.string().optional(),
      customerEmail: z.string().optional(),
      menuDetails: z.any().optional(),
      deposit: z.number().default(0),
      totalAmount: z.number().default(0),
      status: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [event] = await ctx.restaurantDb.insert(cateringEvents).values({
        ...input,
        eventDate: new Date(input.eventDate),
        menuDetails: input.menuDetails ? JSON.stringify(input.menuDetails) : null,
      }).returning();
      return event;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      eventName: z.string().optional(),
      eventDate: z.string().optional(),
      partySize: z.number().optional(),
      customerName: z.string().optional(),
      customerPhone: z.string().optional(),
      customerEmail: z.string().optional(),
      menuDetails: z.any().optional(),
      deposit: z.number().optional(),
      totalAmount: z.number().optional(),
      status: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const updateData: any = { ...data, updatedAt: new Date() };
      if (data.eventDate) updateData.eventDate = new Date(data.eventDate);
      if (data.menuDetails) updateData.menuDetails = JSON.stringify(data.menuDetails);

      const [updated] = await ctx.restaurantDb
        .update(cateringEvents)
        .set(updateData)
        .where(eq(cateringEvents.id, id))
        .returning();
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.restaurantDb.delete(cateringEvents).where(eq(cateringEvents.id, input.id));
      return { success: true };
    }),
});
