/**
 * ── Impresoras de la sucursal ───────────────────────────────────────────────
 *
 * Catálogo para operar cocinas reales: varias impresoras por sucursal y una
 * asignación por estación (`stations.printerId`). No cambia el comportamiento
 * actual: si no hay impresoras configuradas, todo sigue imprimiendo como hoy.
 */

import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, posProcedure, posPermission } from "../trpc";
import { printers, stations } from "@rabbitty/database-restaurant/schema";

const roleSchema = z.enum(["RECEIPT", "KITCHEN", "BAR", "EXPO"]);
const connectionSchema = z.enum(["BLE", "SPP", "USB", "NETWORK"]);

export const printersRouter = router({
  /** Impresoras activas de la sucursal. */
  list: posProcedure.query(async ({ ctx }) => {
    return ctx.restaurantDb
      .select()
      .from(printers)
      .where(eq(printers.branchId, ctx.branchId))
      .orderBy(asc(printers.name));
  }),

  /** Crea o edita una impresora. */
  upsert: posPermission("POS_SETTINGS")
    .input(
      z.object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(60),
        role: roleSchema.default("RECEIPT"),
        connection: connectionSchema.default("BLE"),
        identifier: z.string().max(120).nullable().optional(),
        paperWidth: z.number().int().min(40).max(112).default(58),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.id) {
        const [updated] = await ctx.restaurantDb
          .update(printers)
          .set({
            name: input.name.trim(),
            role: input.role,
            connection: input.connection,
            identifier: input.identifier?.trim() || null,
            paperWidth: input.paperWidth,
            isActive: input.isActive ?? true,
            updatedAt: new Date(),
          })
          .where(and(eq(printers.id, input.id), eq(printers.branchId, ctx.branchId)))
          .returning();
        if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Impresora no encontrada" });
        return updated;
      }

      const [created] = await ctx.restaurantDb
        .insert(printers)
        .values({
          branchId: ctx.branchId,
          name: input.name.trim(),
          role: input.role,
          connection: input.connection,
          identifier: input.identifier?.trim() || null,
          paperWidth: input.paperWidth,
          isActive: input.isActive ?? true,
        })
        .returning();
      return created;
    }),

  /** Desactiva una impresora (no borra historial de estaciones). */
  remove: posPermission("POS_SETTINGS")
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.restaurantDb
        .update(printers)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(printers.id, input.id), eq(printers.branchId, ctx.branchId)));
      return { success: true };
    }),

  /** Asigna (o quita) la impresora de una estación. */
  assignStation: posPermission("POS_SETTINGS")
    .input(z.object({ stationId: z.string(), printerId: z.string().uuid().nullable() }))
    .mutation(async ({ ctx, input }) => {
      if (input.printerId) {
        const [printer] = await ctx.restaurantDb
          .select({ id: printers.id })
          .from(printers)
          .where(and(eq(printers.id, input.printerId), eq(printers.branchId, ctx.branchId)))
          .limit(1);
        if (!printer) throw new TRPCError({ code: "NOT_FOUND", message: "La impresora no es de esta sucursal" });
      }

      const [updated] = await ctx.restaurantDb
        .update(stations)
        .set({ printerId: input.printerId, updatedAt: new Date() })
        .where(and(eq(stations.id, input.stationId), eq(stations.branchId, ctx.branchId)))
        .returning({ id: stations.id, printerId: stations.printerId });

      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Estación no encontrada" });
      return updated;
    }),
});
