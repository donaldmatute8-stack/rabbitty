import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import * as dbSchema from "@rabbitty/database-restaurant";
import { bus, EventTypes } from "@rabbitty/events";
import { orders, tables, orderItems, menuItems } from "@rabbitty/database-restaurant/schema";

export const kdsRouter = router({
  getOrders: protectedProcedure
    .input(z.object({ status: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      let where = and(eq(orders.branchId, ctx.branchId));
      if (input?.status) {
        where = and(where, eq(orders.status, input.status));
      }
      const result = await ctx.restaurantDb
        .select({
          id: orders.id,
          branchId: orders.branchId,
          tableId: orders.tableId,
          tableNumber: tables.number,
          staffId: orders.staffId,
          customerId: orders.customerId,
          customerName: orders.customerName,
          customerPhone: orders.customerPhone,
          orderType: orders.orderType,
          status: orders.status,
          subtotal: orders.subtotal,
          tax: orders.tax,
          discount: orders.discount,
          tip: orders.tip,
          total: orders.total,
          bunzReward: orders.bunzReward,
          bunzPaid: orders.bunzPaid,
          notes: orders.notes,
          voidReason: orders.voidReason,
          createdAt: orders.createdAt,
          updatedAt: orders.updatedAt,
        })
        .from(orders)
        .leftJoin(tables, eq(orders.tableId, tables.id))
        .where(where);
      const ordersWithItems = await Promise.all(result.map(async (order) => {
        const items = await ctx.restaurantDb
          .select({
            id: orderItems.id,
            menuItemId: orderItems.menuItemId,
            quantity: orderItems.quantity,
            status: orderItems.status,
            notes: orderItems.notes,
            unitPrice: orderItems.unitPrice,
            totalPrice: orderItems.totalPrice,
            modifiers: orderItems.modifiers,
            sortOrder: orderItems.sortOrder,
          })
          .from(orderItems)
          .where(eq(orderItems.orderId, order.id))
          .orderBy(orderItems.sortOrder);
        
        const itemsWithNames = await Promise.all(items.map(async (item) => {
          const [menuItem] = await ctx.restaurantDb.select().from(menuItems).where(eq(menuItems.id, item.menuItemId));
          return { ...item, name: menuItem?.name ?? item.menuItemId };
        }));
        
        return { ...order, items: itemsWithNames };
      }));
      return ordersWithItems;
    }),

  updateOrderItemStatus: protectedProcedure
    .input(
      z.object({
        orderItemId: z.string(),
        status: z.enum(["PENDING", "IN_PROGRESS", "READY", "SERVED"]).default("PENDING"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.restaurantDb.update(orderItems).set({
        status: input.status,
      }).where(eq(orderItems.id, input.orderItemId));
      bus.emit(EventTypes.KDS_ITEM_UPDATED, { orderItemId: input.orderItemId, status: input.status });
      return { success: true };
    }),

  getTable: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [table] = await ctx.restaurantDb.select().from(tables).where(and(eq(tables.id, input.tableId), eq(tables.branchId, ctx.branchId)));
      if (!table) return null;
      const items = await ctx.restaurantDb.select().from(orderItems).where(eq(orderItems.orderId, table.id));
      return { ...table, items };
    }),
});
