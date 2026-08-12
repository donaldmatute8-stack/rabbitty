import { z } from "zod";
import { and, eq, inArray, sql } from "drizzle-orm";
import { router, protectedProcedure, resolveBranchId } from "../trpc";
import * as dbSchema from "@rabbitty/database-restaurant";
import { bus, EventTypes } from "@rabbitty/events";
import { inventoryItems, inventoryMovements } from "@rabbitty/database-restaurant/schema";



export const inventoryRouter = router({
  getItems: protectedProcedure
    .input(z.object({ branchId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where = eq(inventoryItems.branchId, resolveBranchId(ctx, input.branchId));
      const items = await ctx.restaurantDb.select().from(inventoryItems).where(where);
      return items;
    }),

  createItem: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        sku: z.string().optional(),
        unit: z.string().default("pz"),
        stock: z.number().default(0),
        minStock: z.number().default(0),
        costPerUnit: z.number().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const generatedSku = input.sku || `SKU-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      
      const [item] = await ctx.restaurantDb.insert(inventoryItems).values({
        branchId: ctx.branchId,
        name: input.name,
        sku: generatedSku,
        unit: input.unit,
        stock: input.stock,
        minStock: input.minStock,
        costPerUnit: input.costPerUnit,
      }).returning();
      return item;
    }),

  updateStock: protectedProcedure
    .input(
      z.object({
        itemId: z.string(),
        quantity: z.number(),
        type: z.enum(["ADD", "REMOVE", "ADJUST"]).default("ADJUST"),
        reference: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [item] = await ctx.restaurantDb.select().from(inventoryItems).where(eq(inventoryItems.id, input.itemId));
      if (!item) {
        throw new Error("Producto no encontrado");
      }
      if (item.branchId !== ctx.branchId) {
        throw new Error("Producto de otra sucursal");
      }
      let newStock = item.stock;
      if (input.type === "ADD") {
        newStock += input.quantity;
      } else if (input.type === "REMOVE") {
        newStock -= input.quantity;
      } else {
        newStock = input.quantity;
      }
      await ctx.restaurantDb.update(inventoryItems).set({ stock: newStock }).where(eq(inventoryItems.id, input.itemId));
      await ctx.restaurantDb.insert(inventoryMovements).values({
        itemId: input.itemId,
        branchId: ctx.branchId,
        type: input.type,
        quantity: input.quantity,
        reference: input.reference ?? null,
        notes: input.notes ?? null,
      }).returning();
      if (newStock <= item.minStock) {
        bus.emit(EventTypes.INVENTORY_LOW, { itemId: input.itemId, stock: newStock });
      }
      return { success: true, newStock };
    }),

  getLowStockItems: protectedProcedure.query(async ({ ctx }) => {
    const items = await ctx.restaurantDb.select().from(inventoryItems).where(
      and(
        eq(inventoryItems.branchId, ctx.branchId),
        sql`${inventoryItems.stock} <= ${inventoryItems.minStock}`
      )
    );
    return items;
  }),

  getRecipe: protectedProcedure
    .input(z.object({ menuItemId: z.string() }))
    .query(async ({ ctx, input }) => {
      const ingredients = await ctx.restaurantDb
        .select()
        .from(dbSchema.menuItemIngredients)
        .where(eq(dbSchema.menuItemIngredients.menuItemId, input.menuItemId));
      return ingredients;
    }),

  addRecipeIngredient: protectedProcedure
    .input(
      z.object({
        menuItemId: z.string(),
        inventoryItemId: z.string().trim().optional().transform((v) => v || undefined),
        subRecipeId: z.string().trim().optional().transform((v) => v || undefined),
        quantityRequired: z.number().positive(),
        unit: z.string(),
      }).refine(
        (d) => !!d.inventoryItemId || !!d.subRecipeId,
        { message: "Se requiere inventoryItemId o subRecipeId" }
      )
    )
    .mutation(async ({ ctx, input }) => {
      const menuIds = [input.menuItemId];
      if (input.subRecipeId) menuIds.push(input.subRecipeId);

      const owned = await ctx.restaurantDb
        .select({ id: dbSchema.menuItems.id, branchId: dbSchema.menuItems.branchId })
        .from(dbSchema.menuItems)
        .where(inArray(dbSchema.menuItems.id, menuIds));

      if (owned.length !== menuIds.length) {
        throw new Error("Platillo no encontrado");
      }
      if (owned.some((m) => m.branchId !== ctx.branchId)) {
        throw new Error("Platillo de otra sucursal");
      }

      const dataToInsert = {
        menuItemId: input.menuItemId,
        inventoryItemId: input.inventoryItemId ?? null,
        subRecipeId: input.subRecipeId ?? null,
        quantityRequired: input.quantityRequired,
        unit: input.unit,
      };
      const [ing] = await ctx.restaurantDb.insert(dbSchema.menuItemIngredients).values(dataToInsert).returning();
      return ing;
    }),
  
  removeRecipeIngredient: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [ing] = await ctx.restaurantDb
        .select()
        .from(dbSchema.menuItemIngredients)
        .where(eq(dbSchema.menuItemIngredients.id, input.id));
      if (!ing) {
        throw new Error("Ingrediente no encontrado");
      }
      const [menuItem] = await ctx.restaurantDb
        .select({ branchId: dbSchema.menuItems.branchId })
        .from(dbSchema.menuItems)
        .where(eq(dbSchema.menuItems.id, ing.menuItemId));
      if (!menuItem || menuItem.branchId !== ctx.branchId) {
        throw new Error("No autorizado: ingrediente de otra sucursal");
      }
      await ctx.restaurantDb.delete(dbSchema.menuItemIngredients).where(eq(dbSchema.menuItemIngredients.id, input.id));
      return { success: true };
    }),
});
