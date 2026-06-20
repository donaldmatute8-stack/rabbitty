import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { waitlistEntries, tables } from "@rabbitty/database-restaurant/schema";
import { bus, EventTypes } from "@rabbitty/events";
import { miniappClient } from "../services/miniapp-client";

export const waitlistRouter = router({
  list: protectedProcedure
    .input(z.object({ status: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const conditions = [eq(waitlistEntries.branchId, ctx.branchId)];
      if (input?.status) {
        conditions.push(eq(waitlistEntries.status, input.status));
      }
      const entries = await ctx.restaurantDb
        .select()
        .from(waitlistEntries)
        .where(and(...conditions))
        .orderBy(waitlistEntries.createdAt);
      return entries;
    }),

  add: protectedProcedure
    .input(z.object({
      customerName: z.string(),
      customerPhone: z.string(),
      partySize: z.number().default(1),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const activeEntries = await ctx.restaurantDb
        .select()
        .from(waitlistEntries)
        .where(
          and(
            eq(waitlistEntries.branchId, ctx.branchId),
            eq(waitlistEntries.status, "WAITING")
          )
        );

      const avgWait = 15; // avg minutes per party
      const estimatedWait = (activeEntries.length + 1) * avgWait;

      const [entry] = await ctx.restaurantDb.insert(waitlistEntries).values({
        branchId: ctx.branchId,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        partySize: input.partySize,
        notes: input.notes ?? null,
        estimatedWaitMinutes: estimatedWait,
      }).returning();
      if (!entry) throw new Error("Error al crear entrada en lista de espera");

      bus.emit(EventTypes.WAITLIST_ADDED, {
        waitlistId: entry.id,
        branchId: ctx.branchId,
        customerName: input.customerName,
        partySize: input.partySize,
        estimatedWait,
      });

      try {
        await miniappClient.sendNotification({
          userId: input.customerPhone,
          title: "Lista de Espera",
          message: `Estás en la lista de espera. Tiempo estimado: ${estimatedWait} min.`,
          type: "waitlist",
        });
      } catch {
        // notification best-effort
      }

      return entry;
    }),

  updateStatus: protectedProcedure
    .input(z.object({
      id: z.string(),
      status: z.enum(["WAITING", "CALLED", "SEATED", "CANCELLED"]),
      tableId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updateData: Record<string, unknown> = { status: input.status };
      if (input.tableId) updateData.tableId = input.tableId;

      if (input.status === "CALLED") {
        updateData.notifiedAt = new Date();
        updateData.notifiedViaTelegram = true;
      }

      await ctx.restaurantDb.update(waitlistEntries)
        .set(updateData)
        .where(eq(waitlistEntries.id, input.id));

      const eventType = input.status === "CALLED"
        ? EventTypes.WAITLIST_CALLED
        : input.status === "SEATED"
          ? EventTypes.WAITLIST_SEATED
          : EventTypes.WAITLIST_CANCELLED;

      bus.emit(eventType, { waitlistId: input.id, branchId: ctx.branchId });

      if (input.status === "CALLED") {
        const [entry] = await ctx.restaurantDb
          .select()
          .from(waitlistEntries)
          .where(eq(waitlistEntries.id, input.id));

        if (entry?.customerPhone) {
          try {
            await miniappClient.sendNotification({
              userId: entry.customerPhone,
              title: "¡Tu mesa está lista!",
              message: "Tu mesa ya está preparada. Por favor acércate al host.",
              type: "waitlist",
            });
          } catch {
            // best-effort
          }
        }
      }

      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.restaurantDb.delete(waitlistEntries).where(eq(waitlistEntries.id, input.id));
      return { success: true };
    }),

  stats: protectedProcedure.query(async ({ ctx }) => {
    const all = await ctx.restaurantDb
      .select()
      .from(waitlistEntries)
      .where(eq(waitlistEntries.branchId, ctx.branchId));

    return {
      waiting: all.filter((e) => e.status === "WAITING").length,
      called: all.filter((e) => e.status === "CALLED").length,
      seated: all.filter((e) => e.status === "SEATED").length,
      cancelled: all.filter((e) => e.status === "CANCELLED").length,
      total: all.length,
    };
  }),
});
