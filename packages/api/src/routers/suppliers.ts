import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { suppliers, purchaseOrders, purchaseOrderItems, inventoryItems } from "@rabbitty/database-restaurant/schema";

export const suppliersRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.restaurantDb
      .select()
      .from(suppliers)
      .where(eq(suppliers.branchId, ctx.branchId));
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [supplier] = await ctx.restaurantDb
        .select()
        .from(suppliers)
        .where(and(eq(suppliers.id, input.id), eq(suppliers.branchId, ctx.branchId)));
      return supplier;
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string(),
      contactName: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      address: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [supplier] = await ctx.restaurantDb.insert(suppliers).values({
        branchId: ctx.branchId,
        ...input,
      }).returning();
      return supplier;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      contactName: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      address: z.string().optional(),
      notes: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await ctx.restaurantDb.update(suppliers).set(data).where(eq(suppliers.id, id));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.restaurantDb.delete(suppliers).where(eq(suppliers.id, input.id));
      return { success: true };
    }),

  // Purchase Orders
  getPurchaseOrders: protectedProcedure
    .input(z.object({ supplierId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const conditions = [eq(purchaseOrders.branchId, ctx.branchId)];
      if (input?.supplierId) conditions.push(eq(purchaseOrders.supplierId, input.supplierId));
      return ctx.restaurantDb
        .select()
        .from(purchaseOrders)
        .where(and(...conditions))
        .orderBy(purchaseOrders.orderedAt);
    }),

  createPurchaseOrder: protectedProcedure
    .input(z.object({
      supplierId: z.string(),
      items: z.array(z.object({
        inventoryItemId: z.string(),
        quantity: z.number(),
        unitCost: z.number(),
      })),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const total = input.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);

      const [order] = await ctx.restaurantDb.insert(purchaseOrders).values({
        branchId: ctx.branchId,
        supplierId: input.supplierId,
        total,
        notes: input.notes ?? null,
      }).returning();

      for (const item of input.items) {
        await ctx.restaurantDb.insert(purchaseOrderItems).values({
          purchaseOrderId: order.id,
          inventoryItemId: item.inventoryItemId,
          quantity: item.quantity,
          unitCost: item.unitCost,
          totalCost: item.quantity * item.unitCost,
        });
      }

      return order;
    }),

  receivePurchaseOrder: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [order] = await ctx.restaurantDb
        .select()
        .from(purchaseOrders)
        .where(eq(purchaseOrders.id, input.id));

      if (!order || order.status !== "APPROVED") {
        throw new Error("La orden debe estar APPROVED para recibirla");
      }

      const items = await ctx.restaurantDb
        .select()
        .from(purchaseOrderItems)
        .where(eq(purchaseOrderItems.purchaseOrderId, order.id));

      for (const item of items) {
        await ctx.restaurantDb
          .update(inventoryItems)
          .set({
            stock: sql`${inventoryItems.stock} + ${item.quantity}`,
            costPerUnit: item.unitCost,
          })
          .where(eq(inventoryItems.id, item.inventoryItemId));
      }

      await ctx.restaurantDb
        .update(purchaseOrders)
        .set({ status: "RECEIVED", receivedAt: new Date() })
        .where(eq(purchaseOrders.id, input.id));

      return { success: true, itemsReceived: items.length };
    }),

  updatePurchaseOrderStatus: protectedProcedure
    .input(z.object({
      id: z.string(),
      status: z.enum(["PENDING", "APPROVED", "RECEIVED", "CANCELLED"]),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.restaurantDb.update(purchaseOrders).set({ status: input.status }).where(eq(purchaseOrders.id, input.id));
      return { success: true };
    }),
});
