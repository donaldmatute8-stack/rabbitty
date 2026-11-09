import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { restaurantDb } from '@/db/restaurant';
import {
  branches,
  deliveries,
  menuItems,
  orderItems,
  orders,
  restaurants,
} from '@rabbitty/database-restaurant/schema';

export const runtime = 'nodejs';

/**
 * Seguimiento público del pedido (link que se manda por push).
 *
 * El id es un UUID no adivinable; aun así se devuelve lo mínimo necesario:
 * estado, ETA, repartidor, artículos y una dirección recortada. Nunca el
 * teléfono del cliente ni datos de pago.
 */

type Stage = 'RECEIVED' | 'PREPARING' | 'READY' | 'DELIVERED';

function stageOf(
  orderStatus: string,
  deliveryStatus: string | null | undefined,
  itemStatuses: Array<string | null | undefined>,
): Stage {
  if (deliveryStatus === 'DELIVERED' || orderStatus === 'COMPLETED') return 'DELIVERED';
  if (deliveryStatus === 'PICKED_UP') return 'READY';

  // La etapa real vive en los items (KDS); el estado de la orden solo cambia
  // al cerrar. Sin esto, un pedido en local/recoger se quedaba en "Recibido".
  const statuses = itemStatuses.filter((s): s is string => Boolean(s));
  if (statuses.length > 0) {
    if (statuses.every((s) => s === 'SERVED')) return 'DELIVERED';
    if (statuses.some((s) => s === 'READY')) return 'READY';
    if (statuses.some((s) => s === 'IN_PROGRESS' || s === 'PREPARING')) return 'PREPARING';
  }

  if (deliveryStatus === 'ASSIGNED') return 'PREPARING';
  if (orderStatus === 'PENDING' || orderStatus === 'PAID') return 'RECEIVED';
  return 'PREPARING';
}

/** Recorta la dirección: sirve para reconocerla sin exponer referencias. */
function maskAddress(value: string | null | undefined): string | null {
  if (!value) return null;
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length <= 60 ? clean : `${clean.slice(0, 60)}…`;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await ctx.params;
    if (!orderId) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });

    const [row] = await restaurantDb
      .select({
        id: orders.id,
        status: orders.status,
        orderType: orders.orderType,
        deliveryAddress: orders.deliveryAddress,
        etaMinutes: orders.etaMinutes,
        etaAt: orders.etaAt,
        prepEtaMinutes: orders.prepEtaMinutes,
        prepEtaAt: orders.prepEtaAt,
        total: orders.total,
        createdAt: orders.createdAt,
        customerName: orders.customerName,
        restaurantName: restaurants.name,
      })
      .from(orders)
      .innerJoin(branches, eq(orders.branchId, branches.id))
      .innerJoin(restaurants, eq(branches.restaurantId, restaurants.id))
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!row) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });

    const [delivery] = await restaurantDb
      .select({
        provider: deliveries.provider,
        status: deliveries.status,
        courierName: deliveries.courierName,
        courierPhone: deliveries.courierPhone,
        trackingUrl: deliveries.trackingUrl,
      })
      .from(deliveries)
      .where(eq(deliveries.orderId, orderId))
      .limit(1);

    const items = await restaurantDb
      .select({ name: menuItems.name, quantity: orderItems.quantity, status: orderItems.status })
      .from(orderItems)
      .leftJoin(menuItems, eq(orderItems.menuItemId, menuItems.id))
      .where(eq(orderItems.orderId, orderId))
      .limit(30);

    const stage = stageOf(row.status, delivery?.status, items.map((it) => it.status));
    // Con repartidor asignado, la cancelación la gestiona el local/la entrega:
    // cancelar en Rabbitty dejaría un courier despachado (y cobrado).
    const canCancel = (row.status === 'PENDING' || row.status === 'PENDING_PAYMENT') && stage === 'RECEIVED' && !delivery;

    return NextResponse.json({
      success: true,
      order: {
        canCancel,
        cancelled: row.status === 'CANCELLED',
        id: row.id,
        businessName: row.restaurantName,
        orderType: row.orderType,
        status: row.status,
        stage,
        etaMinutes: row.etaMinutes,
        etaAt: row.etaAt,
        prepEtaMinutes: row.prepEtaMinutes,
        prepEtaAt: row.prepEtaAt,
        total: Number(row.total || 0),
        createdAt: row.createdAt,
        customerFirstName: (row.customerName || '').split(' ')[0] || null,
        address: maskAddress(row.deliveryAddress),
        items,
        delivery: delivery
          ? {
              provider: delivery.provider,
              status: delivery.status,
              courierName: delivery.courierName,
              courierPhone: delivery.courierPhone,
              trackingUrl: delivery.trackingUrl,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('[TRACK GET]', error);
    return NextResponse.json({ error: 'No se pudo cargar el pedido' }, { status: 500 });
  }
}
