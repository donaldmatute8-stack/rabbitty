import { NextResponse } from 'next/server';
import { db } from '@/db';
import { ownedBusinesses } from '@/db/schema';
import { and, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import { restaurantDb } from '@/db/restaurant';
import { orders, orderItems, menuItems, tables, branches, restaurants } from '@rabbitty/database-restaurant/schema';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { deriveOrderStage, ORDER_STAGE_META, orderStageStepIndex, ORDER_FIRST_STEPS, type OrderStage } from '@rabbitty/events';

export const runtime = 'nodejs';

/**
 * H-TRACK · GET /api/orders/[id] — detalle UNO del pedido (para el full-screen
 * de la tarjeta de seguimiento). Guard: la orden debe ser del caller.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
    const { id: orderIdParam } = await params;

    const [order] = await restaurantDb
      .select({
        id: orders.id,
        branchId: orders.branchId,
        tableId: orders.tableId,
        status: orders.status,
        orderType: orders.orderType,
        total: orders.total,
        subtotal: orders.subtotal,
        tax: orders.tax,
        tip: orders.tip,
        bunzPaid: orders.bunzPaid,
        bunzReward: orders.bunzReward,
        createdAt: orders.createdAt,
        customerId: orders.customerId,
      })
      .from(orders)
      .where(and(eq(orders.id, String(orderIdParam ?? '')), isNull(orders.voidReason)))
      .limit(1);

    if (!order || order.customerId !== caller.id) {
      return NextResponse.json({ success: false, error: 'Orden no encontrada' }, { status: 404 });
    }

    // items con estatus de KDS (el progreso real de la comanda)
    const items = await restaurantDb
      .select({
        id: orderItems.id,
        name: menuItems.name,
        quantity: orderItems.quantity,
        unitPrice: orderItems.unitPrice,
        totalPrice: orderItems.totalPrice,
        status: orderItems.status,
        notes: orderItems.notes,
      })
      .from(orderItems)
      .leftJoin(menuItems, eq(orderItems.menuItemId, menuItems.id))
      .where(and(eq(orderItems.orderId, order.id), sql`${orderItems.voidedAt} IS NULL`))
      .orderBy(orderItems.sortOrder);

    let tableNumber: number | null = null;
    if (order.tableId) {
      const [tbl] = await restaurantDb.select({ number: tables.number }).from(tables).where(eq(tables.id, order.tableId)).limit(1);
      tableNumber = tbl?.number ?? null;
    }

    let businessId: string | null = null;
    let businessName = 'Rabbitty';
    let logoUrl: string | null = null;
    if (order.branchId) {
      const [b] = await restaurantDb
        .select({ businessId: restaurants.businessId, restaurantName: restaurants.name })
        .from(branches)
        .innerJoin(restaurants, eq(branches.restaurantId, restaurants.id))
        .where(eq(branches.id, order.branchId))
        .limit(1);
      if (b?.businessId) {
        businessId = b.businessId;
        businessName = b.restaurantName || businessName;
        const [biz] = await db
          .select({ name: ownedBusinesses.name, logoUrl: ownedBusinesses.logoUrl })
          .from(ownedBusinesses)
          .where(eq(ownedBusinesses.id, b.businessId))
          .limit(1);
        if (biz) { businessName = biz.name; logoUrl = biz.logoUrl; }
      }
    }

    const stage: OrderStage = deriveOrderStage({ order: { status: order.status }, items });
    const meta = ORDER_STAGE_META[stage];

    return NextResponse.json({
      success: true,
      order: {
        orderId: order.id,
        status: order.status,
        orderType: order.orderType,
        tableNumber,
        businessId,
        businessName,
        logoUrl,
        total: Number(order.total ?? 0),
        subtotal: Number(order.subtotal ?? 0),
        tax: Number(order.tax ?? 0),
        tip: Number(order.tip ?? 0),
        bunzPaid: Number(order.bunzPaid ?? 0),
        bunzReward: Number(order.bunzReward ?? 0),
        createdAt: order.createdAt,
        stage,
        stageLabel: meta.label,
        stageStep: orderStageStepIndex(stage),
        stageCount: ORDER_FIRST_STEPS.length,
        canPay: stage !== 'DONE' && order.status !== 'PAID',
        items: items.map((it) => ({
          name: it.name ?? 'Producto',
          quantity: it.quantity,
          unitPrice: Number(it.unitPrice ?? 0),
          totalPrice: Number(it.totalPrice ?? 0),
          status: it.status,
          notes: it.notes,
        })),
      },
    });
  } catch (error) {
    console.error('[ORDER TRACK ERROR]', error);
    return NextResponse.json({ success: false, error: 'No se pudo leer el pedido' }, { status: 500 });
  }
}
