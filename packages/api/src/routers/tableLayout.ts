import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { tables } from "@rabbitty/database-restaurant/schema";

const TABLE_TYPES = ["table_round", "table_square", "table_rect", "table_bar", "table_high"];

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
      type: z.string(),
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
      capacity: z.number().optional(),
      label: z.string().optional(),
      status: z.string().optional(),
      zone: z.string().optional(),
      rotation: z.number().optional(),
    })))
    .mutation(async ({ ctx, input }) => {
      // Solo se persisten mesas reales. Los elementos decorativos/estructurales
      // (paredes, sillas, plantas...) NO se guardan como filas: pos.getTables
      // las listaría como mesas seleccionables y rompería el flujo del POS.
      const toSave = input.filter((item) => TABLE_TYPES.includes(item.type));
      if (toSave.length === 0) return { success: true };

      const existing = await ctx.restaurantDb
        .select({ id: tables.id })
        .from(tables)
        .where(eq(tables.branchId, ctx.branchId));
      const existingIds = new Set(existing.map((t) => t.id));

      const maxRows = await ctx.restaurantDb
        .select({ max: sql<number>`coalesce(max(${tables.number}), 0)` })
        .from(tables)
        .where(eq(tables.branchId, ctx.branchId));
      let nextNumber = Number(maxRows[0]?.max ?? 0);

      for (const item of toSave) {
        // Número derivado del label ("M12" → 12); si no, secuencial.
        const labelNum = item.label ? parseInt(item.label.replace(/\D/g, ""), 10) : NaN;
        const tableNumber = Number.isFinite(labelNum) && labelNum > 0 ? labelNum : ++nextNumber;

        const layoutJson = JSON.stringify({
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          type: item.type,
          label: item.label,
          status: item.status,
          zone: item.zone,
          rotation: item.rotation,
        });

        await ctx.restaurantDb
          .insert(tables)
          .values({
            id: item.id,
            branchId: ctx.branchId,
            number: tableNumber,
            capacity: item.capacity ?? 4,
            location: layoutJson,
          })
          .onConflictDoUpdate({
            target: tables.id,
            set: {
              number: sql`excluded.number`,
              capacity: sql`excluded.capacity`,
              location: sql`excluded.location`,
              updatedAt: new Date(),
            },
          });
      }
      return { success: true };
    }),
});
