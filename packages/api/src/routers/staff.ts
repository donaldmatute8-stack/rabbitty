import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import * as dbSchema from "@rabbitty/database-restaurant";
import { bus, EventTypes } from "@rabbitty/events";
import { staff as staffTable, staffShifts } from "@rabbitty/database-restaurant/schema";
import { hashPin, verifyPin } from "../services/crypto";



export const staffRouter = router({
  getStaff: protectedProcedure
    .input(z.object({ branchId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where = input.branchId
        ? eq(staffTable.branchId, input.branchId)
        : eq(staffTable.branchId, ctx.branchId);
      const staff = await ctx.restaurantDb.select().from(staffTable).where(where);
      return staff.map((s) => ({ ...s, pinCode: undefined }));
    }),

  createStaff: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        role: z.enum(["WAITER", "CASHIER", "MANAGER", "ADMIN"]).default("WAITER"),
        pinCode: z.string().length(4).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [result] = await ctx.restaurantDb.insert(staffTable).values({
        userId: ctx.userId,
        branchId: ctx.branchId,
        name: input.name,
        email: input.email,
        role: input.role,
        pinCode: input.pinCode ? hashPin(input.pinCode) : null,
      }).returning();
      return { ...result, pinCode: undefined };
    }),

  updateStaff: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        email: z.string().optional(),
        role: z.enum(["WAITER", "CASHIER", "MANAGER", "ADMIN"]).optional(),
        pinCode: z.string().length(4).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const data: Record<string, unknown> = {};
      if (input.name) data.name = input.name;
      if (input.email) data.email = input.email;
      if (input.role) data.role = input.role;
      if (input.pinCode !== undefined) data.pinCode = input.pinCode ? hashPin(input.pinCode) : null;
      await ctx.restaurantDb.update(staffTable).set(data).where(eq(staffTable.id, input.id));
      return { success: true };
    }),

  deleteStaff: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.restaurantDb.delete(staffTable).where(eq(staffTable.id, input.id));
      return { success: true };
    }),

  verifyPin: publicProcedure
    .input(z.object({
      pin: z.string().length(4),
      branchId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const staffList = await ctx.restaurantDb.select()
        .from(staffTable)
        .where(eq(staffTable.branchId, input.branchId));

      for (const s of staffList) {
        if (s.pinCode && verifyPin(input.pin, s.pinCode)) {
          return { verified: true, staffId: s.id, name: s.name, role: s.role };
        }
      }
      return { verified: false };
    }),

  clockIn: protectedProcedure
    .input(z.object({ staffId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [shift] = await ctx.restaurantDb.insert(staffShifts).values({
        staffId: input.staffId,
        branchId: ctx.branchId,
        status: "ACTIVE",
      }).returning();
      if (!shift) {
        throw new Error("Error al registrar entrada");
      }
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
      shiftsWithStaff.push({ ...shift, staff: staff.map((s) => ({ ...s, pinCode: undefined })) });
    }
    return shiftsWithStaff;
  }),
});
