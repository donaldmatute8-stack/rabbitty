import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, eq, sql, inArray, or, isNotNull } from "drizzle-orm";
import { router, posProcedure } from "../trpc";
import * as dbSchema from "@rabbitty/database-restaurant";
import { bus, EventTypes } from "@rabbitty/events";
import { orders, tables, orderItems, menuItems, stations } from "@rabbitty/database-restaurant/schema";
import { withOrderMutation } from "../services/orderIntegrity";
import { enqueueRealtimeEvent, stationChannel, drainRealtimeInBackground } from "../services/realtimeOutbox";
import { resolveBusinessIdFromBranch as resolveBusinessIdForBranch } from "../services/businessContext";

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
/** Ítem tal como lo consume el KDS (con su destino de preparación). */
export interface KdsQueueItem {
  id: string;
  menuItemId: string;
  quantity: number;
  status: string;
  notes: string | null;
  unitPrice: number;
  totalPrice: number;
  modifiers: unknown;
  sortOrder: number;
  stationId: string | null;
  printerId: string | null;
  sentToStationAt: Date | null;
  name: string;
  allergies?: string | null;
  guestName?: string | null;
}

/** Comanda en la cola del KDS. */
export interface KdsQueueOrder {
  id: string;
  branchId: string;
  tableId: string | null;
  tableNumber: number | null;
  staffId: string | null;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  orderType: string;
  status: string;
  subtotal: number;
  tax: number;
  discount: number;
  tip: number;
  total: number;
  bunzReward: number | null;
  bunzPaid: number | null;
  notes: string | null;
  voidReason: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  items: KdsQueueItem[];
}

async function loadKdsQueue(
  ctx: any,
  opts: { status?: string; stationId?: string },
): Promise<KdsQueueOrder[]> {
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
        allergies: orderItems.allergies,
        guestName: orderItems.guestName,
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
    ? ordersWithItems.filter((o) => o.items.length > 0)
    : ordersWithItems;
}

export const kdsRouter = router({
  getOrders: posProcedure
    .input(z.object({ status: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      // Terminal atada a una estación: no puede pedir la cola completa (0C-4b).
      const bound = ctx.posAuth?.method === "terminal" ? ctx.posAuth.stationId ?? null : null;
      return loadKdsQueue(ctx, { status: input?.status, stationId: bound ?? undefined });
    }),

  /**
   * Cola de UNA estación. Es la que usa la pantalla de cocina/barra.
   * El filtro por estación es server-side: el cliente no puede pedir otra
   * sucursal ni una estación ajena (ADR-023 §5).
   */
  getStationQueue: posProcedure
    .input(
      z.object({
        stationId: z.string(),
        status: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Si la terminal tiene estación fija, MANDA la del token: el cliente no
      // puede pedir otra (aislamiento cocina/barra).
      const bound = ctx.posAuth?.method === "terminal" ? ctx.posAuth.stationId ?? null : null;
      if (bound && input.stationId && input.stationId !== bound) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Esta terminal está asignada a otra estación.",
        });
      }
      return loadKdsQueue(ctx, { stationId: bound ?? input.stationId, status: input.status });
    }),

  /**
   * Canal de tiempo real de una estación (0C-5). Lo calcula el servidor para
   * que cliente y publisher usen exactamente el mismo nombre.
   */
  realtimeChannel: posProcedure
    .input(z.object({ stationId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [station] = await ctx.restaurantDb
        .select({ id: stations.id })
        .from(stations)
        .where(and(eq(stations.id, input.stationId), eq(stations.branchId, ctx.branchId)))
        .limit(1);
      if (!station) throw new TRPCError({ code: "FORBIDDEN", message: "La estación no pertenece a esta sucursal" });

      // businessId determinista desde la sucursal (mismo que usa el publisher).
      const businessId = await resolveBusinessIdForBranch(ctx.restaurantDb, ctx.branchId);
      return { channel: stationChannel(businessId, ctx.branchId, input.stationId) };
    }),

  updateOrderItemStatus: posProcedure
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

            // Aviso en vivo al canal de la estación del ítem (0C-5).
            const [row] = await tx
              .select({ stationId: orderItems.stationId })
              .from(orderItems)
              .where(eq(orderItems.id, input.orderItemId))
              .limit(1);
            if (row?.stationId) {
              const bizId = await resolveBusinessIdForBranch(ctx.restaurantDb, ctx.branchId);
              await enqueueRealtimeEvent(tx, {
                businessId: bizId,
                branchId: ctx.branchId,
                channel: stationChannel(bizId, ctx.branchId, row.stationId),
                eventType: "order.item.updated",
                payload: {
                  orderId: kdsItem.orderId,
                  itemId: input.orderItemId,
                  stationId: row.stationId,
                  status: input.status,
                },
                eventId: `item-status-${input.orderItemId}-${input.status}`,
              });
            }
          },
        );
      });
      // Push casi inmediato a las demás pantallas de la estación.
      drainRealtimeInBackground(ctx.restaurantDb);
      bus.emit(EventTypes.KDS_ITEM_UPDATED, { orderItemId: input.orderItemId, status: input.status });
      return { success: true };
    }),

  getTable: posProcedure
    .input(z.object({ tableId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [table] = await ctx.restaurantDb.select().from(tables).where(and(eq(tables.id, input.tableId), eq(tables.branchId, ctx.branchId)));
      if (!table) return null;
      const items = await ctx.restaurantDb.select().from(orderItems).where(eq(orderItems.orderId, table.id));
      return { ...table, items };
    }),
});
