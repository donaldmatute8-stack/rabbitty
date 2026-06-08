import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import * as dbSchema from "@rabbitty/database-restaurant";
import { bus, EventTypes } from "@rabbitty/events";
import { staff as staffTable, staffShifts } from "@rabbitty/database-restaurant/schema";



export const staffRouter = router({
  getStaff: protectedProcedure
    .input(z.object({ branchId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where = input.branchId
        ? eq(staffTable.branchId, input.branchId)
        : eq(staffTable.branchId, ctx.branchId);
      const staff = await ctx.restaurantDb.select().from(staffTable).where(where);
      return staff;
    }),

  createStaff: protectedProcedure
    .input(
      z.object({
        branchId: z.string(),
        name: z.string(),
        email: z.string(),
        role: z.enum(["WAITER", "CASHIER", "MANAGER", "ADMIN"]).default("WAITER"),
        pinCode: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [result] = await ctx.restaurantDb.insert(staffTable).values({
        userId: ctx.userId,
        branchId: input.branchId,
        name: input.name,
        email: input.email,
        role: input.role,
        pinCode: input.pinCode ?? null,
      }).returning();
      return result;
    }),

  updateStaff: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        email: z.string().optional(),
        role: z.enum(["WAITER", "CASHIER", "MANAGER", "ADMIN"]).optional(),
        pinCode: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.restaurantDb.update(staffTable).set(input).where(eq(staffTable.id, input.id));
      return { success: true };
    }),

  deleteStaff: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.restaurantDb.delete(staffTable).where(eq(staffTable.id, input.id));
      return { success: true };
    }),

  clockIn: protectedProcedure
    .input(z.object({ staffId: z.string(), branchId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [shift] = await ctx.restaurantDb.insert(staffShifts).values({
        staffId: input.staffId,
        branchId: input.branchId,
        status: "ACTIVE",
      }).returning();
      bus.emit(EventTypes.STAFF_SHIFT_START, { shiftId: shift.id, staffId: input.staffId });
      return shift;
    }),

  clockOut: protectedProcedure
    .input(z.object({ staffId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [shift] = await ctx.restaurantDb.select().from(staffShifts).where(
        and(
          eq(staffShifts.staffId, input.staffId),
          eq(staffShifts.status, "ACTIVE")
        )
      );
      if (shift) {
        await ctx.restaurantDb.update(staffShifts).set({
          status: "FINISHED",
          checkOut: new Date(),
        }).where(eq(staffShifts.id, shift.id));
        bus.emit(EventTypes.STAFF_SHIFT_END, { shiftId: shift.id, staffId: input.staffId });
        return { success: true };
      }
      return { success: false };
    }),

  getActiveShifts: protectedProcedure.query(async ({ ctx }) => {
    const shifts = await ctx.restaurantDb.select().from(staffShifts).where(
      and(
        eq(staffShifts.branchId, ctx.branchId),
        eq(staffShifts.status, "ACTIVE")
      )
    );
    const shiftsWithStaff = [];
    for (const shift of shifts) {
      const staff = await ctx.restaurantDb.select().from(staffTable).where(eq(staffTable.id, shift.staffId));
      shiftsWithStaff.push({ ...shift, staff });
    }
    return shiftsWithStaff;
  }),
});
