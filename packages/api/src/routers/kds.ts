import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, eq, sql, inArray, or, isNotNull } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import * as dbSchema from "@rabbitty/database-restaurant";
import { bus, EventTypes } from "@rabbitty/events";
import { orders, tables, orderItems, menuItems, stations } from "@rabbitty/database-restaurant/schema";
import { withOrderMutation } from "../services/orderIntegrity";

/**
 * Carga la cola del KDS.
 *
 * `stationId` es opcional: sin él devuelve la cola de la sucursal completa
 * (comportamiento histórico). Con él, filtra los **ítems** de esa estación y
 * descarta las comandas que no tengan nada para ella.
 *
 * La estación debe pertenecer a la sucursal del contexto: es la barrera que
 * impide que una cocina vea la barra de otra sucursal (ADR-023 §5).
 */
async function loadKdsQueue(
  ctx: any,
  opts: { status?: string; stationId?: string },
) {
  if (opts.stationId) {
    const [station] = await ctx.restaurantDb
      .select({ id: stations.id })
      .from(stations)
      .where(and(eq(stations.id, opts.stationId), eq(stations.branchId, ctx.branchId)))
      .limit(1);
    if (!station) {
      throw new TRPCError({ code: "FORBIDDEN", message: "La estación no pertenece a esta sucursal" });
    }
  }

  let where = and(
    eq(orders.branchId, ctx.branchId),
    // Cuenta enviada al móvil ≠ pedido: no entra a cocina.
    eq(orders.billOnly, false),
    or(
      inArray(orders.status, ["PENDING", "PAID", "CASH_PAYMENT_REQUESTED"]),
      and(eq(orders.status, "PENDING_PAYMENT"), isNotNull(orders.tableId))
    )
  );
  if (opts.status) {
    where = and(where, eq(orders.status, opts.status));
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

  const ordersWithItems = await Promise.all(result.map(async (order: any) => {
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
        stationId: orderItems.stationId,
        printerId: orderItems.printerId,
        sentToStationAt: orderItems.sentToStationAt,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id))
      .orderBy(orderItems.sortOrder);

    const visible = opts.stationId
      ? items.filter((i: any) => i.stationId === opts.stationId)
      : items;

    const itemsWithNames = await Promise.all(visible.map(async (item: any) => {
      const [menuItem] = await ctx.restaurantDb.select().from(menuItems).where(eq(menuItems.id, item.menuItemId));
      return { ...item, name: menuItem?.name ?? item.menuItemId };
    }));

    return { ...order, items: itemsWithNames };
  }));

  // Con estación: las comandas sin ítems para ella no se muestran.
  return opts.stationId
    ? ordersWithItems.filter((o: any) => o.items.length > 0)
    : ordersWithItems;
}

export const kdsRouter = router({
  getOrders: protectedProcedure
    .input(z.object({ status: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return loadKdsQueue(ctx, { status: input?.status });
    }),

  /**
   * Cola de UNA estación. Es la que usa la pantalla de cocina/barra.
   * El filtro por estación es server-side: el cliente no puede pedir otra
   * sucursal ni una estación ajena (ADR-023 §5).
   */
  getStationQueue: protectedProcedure
    .input(
      z.object({
        stationId: z.string(),
        status: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return loadKdsQueue(ctx, { stationId: input.stationId, status: input.status });
    }),

  updateOrderItemStatus: protectedProcedure
    .input(
      z.object({
        orderItemId: z.string(),
        status: z.enum(["PENDING", "IN_PROGRESS", "READY", "SERVED"]).default("PENDING"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [kdsItem] = await ctx.restaurantDb.select({ orderId: orderItems.orderId }).from(orderItems).where(eq(orderItems.id, input.orderItemId)).limit(1);
      if (kdsItem) {
        const [kdsOrder] = await ctx.restaurantDb.select({ branchId: orders.branchId }).from(orders).where(eq(orders.id, kdsItem.orderId)).limit(1);
        if (!kdsOrder || kdsOrder.branchId !== ctx.branchId) throw new TRPCError({ code: "FORBIDDEN", message: "Item no pertenece a esta sucursal" });
      }
      if (!kdsItem) throw new TRPCError({ code: "NOT_FOUND", message: "Item no encontrado" });
      // El bump de cocina también respeta el lock y la versión de la orden.
      await ctx.restaurantDb.transaction(async (tx: any) => {
        await withOrderMutation(
          tx,
          { orderId: kdsItem.orderId, type: "KDS_ITEM_STATUS", actor: { staffId: null, terminalId: null } },
          async (_o: any, _c: any) => {
            await tx.update(orderItems).set({
              status: input.status,
            }).where(eq(orderItems.id, input.orderItemId));
          },
        );
      });
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
