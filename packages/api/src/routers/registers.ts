import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, adminOnlyProcedure, protectedProcedure } from "../trpc";
import { registers } from "@rabbitty/database-restaurant/schema";

/**
 * ── Cajas (registers) ──────────────────────────────────────────────────────
 * Catálogo por sucursal. `code` es el valor que ya usan terminales y turnos
 * ("MAIN", "C2"), así que agregar cajas no rompe nada existente.
 */
const codeSchema = z
  .string()
  .trim()
  .min(1)
  .max(12)
  .transform((v) => v.toUpperCase().replace(/\s+/g, ""))
  .refine((v) => /^[A-Z0-9_-]+$/.test(v), "El código solo admite letras, números, - y _");

export const registersRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.restaurantDb
      .select()
      .from(registers)
      .where(eq(registers.branchId, ctx.branchId))
      .orderBy(asc(registers.sortOrder), asc(registers.name));
    return rows;
  }),

  create: adminOnlyProcedure
    .input(
      z.object({
        code: codeSchema,
        name: z.string().trim().min(2).max(60),
        location: z.string().trim().max(80).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.restaurantDb
        .select({ id: registers.id })
        .from(registers)
        .where(and(eq(registers.branchId, ctx.branchId), eq(registers.code, input.code)))
        .limit(1);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: `Ya existe una caja con el código ${input.code}.` });
      }
      const [created] = await ctx.restaurantDb
        .insert(registers)
        .values({
          branchId: ctx.branchId,
          code: input.code,
          name: input.name,
          location: input.location ?? null,
        })
        .returning();
      return created;
    }),

  update: adminOnlyProcedure
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().trim().min(2).max(60).optional(),
        location: z.string().trim().max(80).nullable().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().int().min(0).max(999).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.restaurantDb
        .update(registers)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.location !== undefined ? { location: input.location } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(registers.id, input.id), eq(registers.branchId, ctx.branchId)))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Caja no encontrada." });
      return updated;
    }),
});
