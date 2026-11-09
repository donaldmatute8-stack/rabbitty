import { NextResponse } from 'next/server';
import { db } from '@/db';
import { ownedBusinesses } from '@/db/schema';
import { and, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import { restaurantDb } from '@/db/restaurant';
import { orders, orderItems, menuItems, branches, restaurants } from '@rabbitty/database-restaurant/schema';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { deriveOrderStage, ORDER_STAGE_META, orderStageStepIndex, ORDER_FIRST_STEPS, type OrderStage } from '@rabbitty/events';

export const runtime = 'nodejs';

/**
 * H-TRACK · GET /api/orders/active — pedidos ACTIVOS del Rabbitter con etapa
 * derivada (mismo contrato que el POS: deriveOrderStage). Fuente: orders +
 * order_items (estatus KDS) del restaurante + identidad del negocio (core).
 *
 * Ventana: 24h y sin voidReason — la tarjeta muere sola cuando ya no aplica.
 */
export async function GET(req: Request) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
    const userId = caller.id;

    const rows = await restaurantDb
      .select({
        id: orders.id,
        branchId: orders.branchId,
        status: orders.status,
        orderType: orders.orderType,
        total: orders.total,
        bunzPaid: orders.bunzPaid,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(and(
        eq(orders.customerId, userId),
        inArray(orders.status, ['PENDING', 'PENDING_PAYMENT', 'CASH_PAYMENT_REQUESTED', 'PAID']),
        gte(orders.createdAt, sql`(now() AT TIME ZONE 'UTC') - interval '24 hours'`),
        isNull(orders.voidReason),
      ))
      .orderBy(desc(orders.createdAt))
      .limit(6);

    if (rows.length === 0) return NextResponse.json({ success: true, orders: [] });

    const orderIds = rows.map((o) => o.id);

    // items con estatus de KDS (fuente de la etapa)
    const itemRows = await restaurantDb
      .select({
        orderId: orderItems.orderId,
        name: menuItems.name,
        quantity: orderItems.quantity,
        status: orderItems.status,
      })
      .from(orderItems)
      .leftJoin(menuItems, eq(orderItems.menuItemId, menuItems.id))
      .where(and(inArray(orderItems.orderId, orderIds), sql`${orderItems.voidedAt} IS NULL`));

    const itemsByOrder = new Map<string, Array<{ name: string; quantity: number; status: string | null }>>();
    for (const row of itemRows) {
      const list = itemsByOrder.get(row.orderId) ?? [];
      list.push({ name: row.name ?? 'Producto', quantity: row.quantity, status: row.status });
      itemsByOrder.set(row.orderId, list);
    }

    // identidad del negocio: branch → restaurant → ownedBusinesses (core)
    const branchIds = Array.from(new Set(rows.map((o) => o.branchId).filter((x): x is string => !!x)));
    const bizByBranch = new Map<string, { businessId: string; restaurantName: string }>();
    if (branchIds.length > 0) {
      const branchRows = await restaurantDb
        .select({ branchId: branches.id, businessId: restaurants.businessId, restaurantName: restaurants.name })
        .from(branches)
        .innerJoin(restaurants, eq(branches.restaurantId, restaurants.id))
        .where(inArray(branches.id, branchIds));
      for (const b of branchRows) {
        if (b.businessId) bizByBranch.set(b.branchId, b as never);
      }
    }

    const businessIds = Array.from(new Set(Array.from(bizByBranch.values()).map((b) => b.businessId)));
    const bizInfo = businessIds.length > 0
      ? await db
          .select({ id: ownedBusinesses.id, name: ownedBusinesses.name, logoUrl: ownedBusinesses.logoUrl })
          .from(ownedBusinesses)
          .where(inArray(ownedBusinesses.id, businessIds))
      : [];
    const bizMap = new Map(bizInfo.map((b) => [b.id, b]));

    const payload = rows
      // H-PERSIST: la comanda-borrador (solo vínculo, sin productos) NO es un
      // pedido del Rabbitter — no debe pintar tarjeta de seguimiento.
      // Tampoco los pedidos ya entregados: al completarse desaparecen de la
      // barra superior y de la tarjeta del feed.
      .filter((o) => (itemsByOrder.get(o.id)?.length ?? 0) > 0)
      .filter((o) => {
        const items = itemsByOrder.get(o.id) ?? [];
        return deriveOrderStage({ order: { status: o.status }, items }) !== 'DONE';
      })
      .map((o) => {
      const items = itemsByOrder.get(o.id) ?? [];
      const stage: OrderStage = deriveOrderStage({ order: { status: o.status }, items });
      const meta = ORDER_STAGE_META[stage];
      const biz = o.branchId ? bizByBranch.get(o.branchId) : undefined;
      const info = biz ? bizMap.get(biz.businessId) : undefined;
      return {
        orderId: o.id,
        status: o.status,
        orderType: o.orderType,
        branchId: o.branchId,
        businessId: biz?.businessId ?? null,
        businessName: info?.name ?? biz?.restaurantName ?? 'Rabbitty',
        logoUrl: info?.logoUrl ?? null,
        total: Number(o.total ?? 0),
        createdAt: o.createdAt,
        stage,
        stageLabel: meta.label,
        stageStep: orderStageStepIndex(stage),
        stageCount: ORDER_FIRST_STEPS.length,
        itemsSummary: items.map((it) => `${it.quantity}× ${it.name}`),
      };
    });

    return NextResponse.json({ success: true, orders: payload });
  } catch (error) {
    console.error('[ORDERS ACTIVE ERROR]', error);
    return NextResponse.json({ success: false, error: 'No se pudo leer el seguimiento' }, { status: 500 });
  }
}
