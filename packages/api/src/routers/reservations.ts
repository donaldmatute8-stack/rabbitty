import { z } from "zod";
import { and, eq, desc } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { reservations, tables } from "@rabbitty/database-restaurant/schema";
import { miniappClient } from "../services/miniapp-client";



export const reservationsRouter = router({
  list: protectedProcedure
    .input(z.object({ branchId: z.string().optional(), date: z.string().optional(), status: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      let where = eq(reservations.branchId, input.branchId ?? ctx.branchId);
      if (input.status) where = and(where, eq(reservations.status, input.status))!;
      const result = await ctx.restaurantDb
        .select()
        .from(reservations)
        .where(where)
        .orderBy(desc(reservations.reservationTime));
      return result;
    }),

  create: protectedProcedure
    .input(
      z.object({
        branchId: z.string().optional(),
        tableId: z.string().optional(),
        customerName: z.string(),
        customerPhone: z.string().optional(),
        partySize: z.number().min(1),
        reservationTime: z.string(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [reservation] = await ctx.restaurantDb.insert(reservations).values({
        branchId: input.branchId ?? ctx.branchId,
        tableId: input.tableId ?? null,
        customerName: input.customerName,
        customerPhone: input.customerPhone ?? null,
        partySize: input.partySize,
        reservationTime: new Date(input.reservationTime),
        notes: input.notes ?? null,
      }).returning();

      // Sync to miniapp if we have a way to identify the business
      if (input.customerPhone) {
        try {
          const branch = await ctx.restaurantDb.select().from(tables).where(eq(tables.branchId, ctx.branchId));
          await miniappClient.createReservation({
            telegramId: input.customerPhone,
            businessName: ctx.branchId,
            offerTitle: `Reserva para ${input.customerName} (${input.partySize} pers)`,
            bunzCost: 0,
          });
        } catch {
          // Non-critical — reservation already saved locally
        }
      }

      return reservation;
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [reservation] = await ctx.restaurantDb
        .update(reservations)
        .set({ status: input.status })
        .where(eq(reservations.id, input.id))
        .returning();
      return reservation;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.restaurantDb.delete(reservations).where(eq(reservations.id, input.id));
      return { success: true };
    }),
});
