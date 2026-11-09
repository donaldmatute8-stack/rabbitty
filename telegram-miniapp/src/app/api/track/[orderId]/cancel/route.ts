import { NextResponse } from 'next/server';
import { and, eq, inArray, ne, or, sql } from 'drizzle-orm';
import { restaurantDb } from '@/db/restaurant';
import { deliveries, orderItems, orders, payments, paymentIntents } from '@rabbitty/database-restaurant/schema';
import { db } from '@/db';
import { ownedBusinesses } from '@/db/schema';
import { getAuthenticatedUser } from '@/lib/serverAuth';

export const runtime = 'nodejs';

/**
 * Cancelación del pedido por parte del cliente.
 *
 * Solo se permite mientras el local no haya empezado a prepararlo:
 *  - la orden sigue en PENDING (no pagada con tarjeta/Bunz),
 *  - los items siguen PENDING,
 *  - la entrega no fue recogida.
 * Si ya está en preparación, el cliente debe hablar con el local.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ orderId: string }> },
) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { orderId } = await ctx.params;
    if (!orderId) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });

    const [order] = await restaurantDb
      .select({
        id: orders.id,
        status: orders.status,
        customerId: orders.customerId,
        branchId: orders.branchId,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    if (order.customerId !== caller.id) {
      return NextResponse.json({ error: 'Este pedido no es tuyo' }, { status: 403 });
    }
    // Se puede cancelar mientras no haya pago ni preparación: PENDING o
    // PENDING_PAYMENT (pedido de la app aún sin pagar).
    const cancellable = order.status === 'PENDING' || order.status === 'PENDING_PAYMENT';
    if (!cancellable) {
      return NextResponse.json(
        { error: 'El pedido ya fue pagado o está en preparación; habla con el local para cancelarlo.' },
        { status: 409 },
      );
    }

    const [paid] = await restaurantDb
      .select({ total: sql<number>`COALESCE(SUM(${payments.amount}), 0)` })
      .from(payments)
      .where(and(eq(payments.orderId, orderId), eq(payments.status, 'COMPLETED')));
    if (Number(paid?.total ?? 0) > 0) {
      return NextResponse.json(
        { error: 'El pedido ya tiene un pago registrado; habla con el local para cancelarlo.' },
        { status: 409 },
      );
    }

    const [busy] = await restaurantDb
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(
        and(
          eq(orderItems.orderId, orderId),
          or(
            ne(orderItems.status, 'PENDING'),
            inArray(orderItems.status, ['IN_PROGRESS', 'READY', 'SERVED']),
          ),
        ),
      )
      .limit(1);
    if (busy) {
      return NextResponse.json(
        { error: 'El local ya está preparando tu pedido. No se puede cancelar desde aquí.' },
        { status: 409 },
      );
    }

    const [delivery] = await restaurantDb
      .select({ id: deliveries.id, status: deliveries.status })
      .from(deliveries)
      .where(eq(deliveries.orderId, orderId))
      .limit(1);
    if (delivery) {
      return NextResponse.json(
        {
          error:
            delivery.status === 'PICKED_UP'
              ? 'El repartidor ya recogió tu pedido; no se puede cancelar.'
              : 'Tu pedido ya tiene repartidor asignado. Habla con el local para cancelarlo.',
        },
        { status: 409 },
      );
    }

    const now = new Date();
    // Anular intents vigentes para que el link de pago no cobre después.
    await restaurantDb
      .update(paymentIntents)
      .set({ status: 'CANCELLED', updatedAt: now })
      .where(and(eq(paymentIntents.orderId, orderId), eq(paymentIntents.status, 'PENDING_PAYMENT')));

    await restaurantDb
      .update(orders)
      .set({ status: 'CANCELLED', voidReason: 'CANCELLED_BY_CUSTOMER', updatedAt: now })
      .where(eq(orders.id, orderId));

    // Aviso al negocio (best-effort): que sepa que la comanda se cayó.
    try {
      const { restaurants } = await import('@rabbitty/database-restaurant/schema');
      const { branches } = await import('@rabbitty/database-restaurant/schema');
      const [row] = await restaurantDb
        .select({ businessId: restaurants.businessId })
        .from(branches)
        .innerJoin(restaurants, eq(branches.restaurantId, restaurants.id))
        .where(eq(branches.id, order.branchId))
        .limit(1);
      if (row?.businessId) {
        const [biz] = await db
          .select({ ownerId: ownedBusinesses.ownerId })
          .from(ownedBusinesses)
          .where(eq(ownedBusinesses.id, row.businessId))
          .limit(1);
        if (biz?.ownerId) {
          const { sendEcosystemNotification } = await import('@/lib/push/notify');
          await sendEcosystemNotification({
            userId: biz.ownerId,
            title: '❌ Pedido cancelado por el cliente',
            message: 'El Rabbitter canceló su pedido antes de que empezara la preparación.',
            type: 'SYSTEM',
            route: '/pos',
            threadId: 'order_cancelled',
          });
        }
      }
    } catch {
      /* el aviso no debe romper la cancelación */
    }

    return NextResponse.json({ success: true, orderId, status: 'CANCELLED' });
  } catch (error) {
    console.error('[TRACK CANCEL]', error);
    return NextResponse.json({ error: 'No se pudo cancelar el pedido' }, { status: 500 });
  }
}
