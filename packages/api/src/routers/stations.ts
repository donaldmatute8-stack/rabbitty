/**
 * ── Estaciones de preparación (Fase 0C) ────────────────────────────────────
 *
 * Configuración del tenant: qué estaciones existen (cocina, barra, fríos) y a
 * cuál va cada categoría o producto. Sin configuración, todo cae a la estación
 * por defecto ("Cocina") y el POS se comporta igual que antes.
 *
 * Ver: Docs/POS-FASE-0/ADR-023-estaciones-y-kds.md
 */

import { z } from "zod";
import { and, asc, eq, ne } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, posProcedure, posPermission, resolveBranchId } from "../trpc";
import { stations, menuCategories, menuItems } from "@rabbitty/database-restaurant/schema";

const stationType = z.enum(["KITCHEN", "BAR", "EXPO", "COLD"]);

export const stationsRouter = router({
  /** Estaciones de la sucursal, en orden de operación. */
  list: posProcedure.query(async ({ ctx }) => {
    return ctx.restaurantDb
      .select()
      .from(stations)
      .where(eq(stations.branchId, ctx.branchId))
      .orderBy(asc(stations.sortOrder), asc(stations.name));
  }),

  /** Crea o edita una estación. */
  upsert: posPermission("POS_SETTINGS")
    .input(
      z.object({
        id: z.string().optional(),
        branchId: z.string().optional(),
        name: z.string().min(1).max(40),
        type: stationType.default("KITCHEN"),
        printerId: z.string().max(120).nullable().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().int().min(0).max(999).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const branchId = await resolveBranchId(ctx, input.branchId);

      if (input.id) {
        const [updated] = await ctx.restaurantDb
          .update(stations)
          .set({
            name: input.name.trim(),
            type: input.type,
            printerId: input.printerId ?? null,
            isActive: input.isActive ?? true,
            sortOrder: input.sortOrder ?? 0,
            updatedAt: new Date(),
          })
          .where(and(eq(stations.id, input.id), eq(stations.branchId, branchId)))
          .returning();
        if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Estación no encontrada" });
        return updated;
      }

      // Nombre único por sucursal (índice lower(name))
      const [dup] = await ctx.restaurantDb
        .select({ id: stations.id })
        .from(stations)
        .where(and(eq(stations.branchId, branchId), eq(stations.name, input.name.trim())))
        .limit(1);
      if (dup) throw new TRPCError({ code: "CONFLICT", message: "Ya existe una estación con ese nombre" });

      const [created] = await ctx.restaurantDb
        .insert(stations)
        .values({
          branchId,
          name: input.name.trim(),
          type: input.type,
          printerId: input.printerId ?? null,
          isActive: input.isActive ?? true,
          sortOrder: input.sortOrder ?? 0,
        })
        .returning();
      return created;
    }),

  /** Marca la estación que recibe todo lo que no tenga destino explícito. */
  setDefault: posPermission("POS_SETTINGS")
    .input(z.object({ id: z.string(), branchId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const branchId = await resolveBranchId(ctx, input.branchId);

      return await ctx.restaurantDb.transaction(async (tx: any) => {
        const [target] = await tx
          .select({ id: stations.id })
          .from(stations)
          .where(and(eq(stations.id, input.id), eq(stations.branchId, branchId)))
          .limit(1);
        if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Estación no encontrada" });

        // Una sola default por sucursal (índice parcial único).
        await tx
          .update(stations)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(and(eq(stations.branchId, branchId), ne(stations.id, input.id)));

        const [updated] = await tx
          .update(stations)
          .set({ isDefault: true, isActive: true, updatedAt: new Date() })
          .where(eq(stations.id, input.id))
          .returning();
        return updated;
      });
    }),

  /** Asigna la estación de una categoría (sus productos la heredan). */
  assignCategory: posPermission("POS_SETTINGS")
    .input(z.object({ categoryId: z.string(), stationId: z.string().nullable(), branchId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const branchId = await resolveBranchId(ctx, input.branchId);
      if (input.stationId) await assertStation(ctx, input.stationId, branchId);

      const [updated] = await ctx.restaurantDb
        .update(menuCategories)
        .set({ stationId: input.stationId })
        .where(and(eq(menuCategories.id, input.categoryId), eq(menuCategories.branchId, branchId)))
        .returning({ id: menuCategories.id, stationId: menuCategories.stationId });

      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Categoría no encontrada" });
      return updated;
    }),

  /** Override por producto. `null` = heredar de la categoría. */
  assignItem: posPermission("POS_SETTINGS")
    .input(z.object({ menuItemId: z.string(), stationId: z.string().nullable(), branchId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const branchId = await resolveBranchId(ctx, input.branchId);
      if (input.stationId) await assertStation(ctx, input.stationId, branchId);

      const [updated] = await ctx.restaurantDb
        .update(menuItems)
        .set({ stationId: input.stationId })
        .where(and(eq(menuItems.id, input.menuItemId), eq(menuItems.branchId, branchId)))
        .returning({ id: menuItems.id, stationId: menuItems.stationId });

      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Producto no encontrado" });
      return updated;
    }),
});

async function assertStation(ctx: any, stationId: string, branchId: string) {
  const [row] = await ctx.restaurantDb
    .select({ id: stations.id })
    .from(stations)
    .where(and(eq(stations.id, stationId), eq(stations.branchId, branchId)))
    .limit(1);
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "La estación no pertenece a esta sucursal" });
}
