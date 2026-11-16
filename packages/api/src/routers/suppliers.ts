import { z } from "zod";
import { eq, and, inArray, sql } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { suppliers, purchaseOrders, purchaseOrderItems, inventoryItems, inventoryMovements } from "@rabbitty/database-restaurant/schema";

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

  /** Detalle de una orden con sus insumos (para revisar antes de recibir). */
  getPurchaseOrder: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [order] = await ctx.restaurantDb
        .select()
        .from(purchaseOrders)
        .where(and(eq(purchaseOrders.id, input.id), eq(purchaseOrders.branchId, ctx.branchId)))
        .limit(1);
      if (!order) return null;
      const items = await ctx.restaurantDb
        .select({
          id: purchaseOrderItems.id,
          inventoryItemId: purchaseOrderItems.inventoryItemId,
          quantity: purchaseOrderItems.quantity,
          unitCost: purchaseOrderItems.unitCost,
          totalCost: purchaseOrderItems.totalCost,
          name: inventoryItems.name,
          unit: inventoryItems.unit,
        })
        .from(purchaseOrderItems)
        .innerJoin(inventoryItems, eq(inventoryItems.id, purchaseOrderItems.inventoryItemId))
        .where(eq(purchaseOrderItems.purchaseOrderId, order.id));
      return { order, items };
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
      if (input.items.length === 0) throw new Error("Agrega al menos un insumo");

      // Validación: todos los insumos deben ser de esta sucursal.
      const ids = [...new Set(input.items.map((i) => i.inventoryItemId))];
      const valid = await ctx.restaurantDb
        .select({ id: inventoryItems.id })
        .from(inventoryItems)
        .where(and(eq(inventoryItems.branchId, ctx.branchId), inArray(inventoryItems.id, ids)));
      if (valid.length !== ids.length) throw new Error("Hay insumos que no pertenecen a esta sucursal");

      return ctx.restaurantDb.transaction(async (tx) => {
        const [order] = await tx
          .insert(purchaseOrders)
          .values({
            branchId: ctx.branchId,
            supplierId: input.supplierId,
            total,
            notes: input.notes ?? null,
          })
          .returning();
        if (!order) throw new Error("Error al crear orden de compra");

        for (const item of input.items) {
          await tx.insert(purchaseOrderItems).values({
            purchaseOrderId: order.id,
            inventoryItemId: item.inventoryItemId,
            quantity: item.quantity,
            unitCost: item.unitCost,
            totalCost: item.quantity * item.unitCost,
          });
        }
        return order;
      });
    }),

  receivePurchaseOrder: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Idempotente: la fila se bloquea y el estado se re-verifica DENTRO de la
      // transacción. Un reintento no vuelve a sumar inventario.
      return ctx.restaurantDb.transaction(async (tx) => {
        const [order] = await tx
          .select()
          .from(purchaseOrders)
          .where(and(eq(purchaseOrders.id, input.id), eq(purchaseOrders.branchId, ctx.branchId)))
          .for("update")
          .limit(1);

        if (!order) throw new Error("Orden no encontrada");
        if (order.status === "RECEIVED") return { success: true, already: true, itemsReceived: 0 };
        if (order.status !== "APPROVED") throw new Error("La orden debe estar APPROVED para recibirla");

        const items = await tx
          .select()
          .from(purchaseOrderItems)
          .where(eq(purchaseOrderItems.purchaseOrderId, order.id));

        for (const item of items) {
          await tx
            .update(inventoryItems)
            .set({
              stock: sql`${inventoryItems.stock} + ${item.quantity}`,
              costPerUnit: item.unitCost,
            })
            .where(and(eq(inventoryItems.id, item.inventoryItemId), eq(inventoryItems.branchId, ctx.branchId)));

          // Bitácora de inventario: quién entró y con qué referencia.
          await tx.insert(inventoryMovements).values({
            itemId: item.inventoryItemId,
            branchId: ctx.branchId,
            type: "PURCHASE",
            quantity: item.quantity,
            reference: `po:${order.id}`,
            notes: "Recepción de orden de compra",
          });
        }

        await tx
          .update(purchaseOrders)
          .set({ status: "RECEIVED", receivedAt: new Date() })
          .where(eq(purchaseOrders.id, input.id));

        return { success: true, itemsReceived: items.length };
      });
    }),

  updatePurchaseOrderStatus: protectedProcedure
    .input(z.object({
      id: z.string(),
      status: z.enum(["PENDING", "APPROVED", "RECEIVED", "CANCELLED"]),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.restaurantDb.update(purchaseOrders).set({ status: input.status }).where(and(eq(purchaseOrders.id, input.id), eq(purchaseOrders.branchId, ctx.branchId)));
      return { success: true };
    }),
});
