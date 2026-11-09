import { NextResponse } from 'next/server';
import { restaurantDb } from '@/db/restaurant';
import {
  orders,
  payments,
  orderItems,
  menuItems,
  branches,
  restaurants,
} from '@rabbitty/database-restaurant/schema';
import { and, asc, eq } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/serverAuth';

export const runtime = 'nodejs';

/**
 * ── Comprobante / estado de una cuenta ──
 * Lo usa el módulo de pago al abrirse (push de "Cuenta lista", tarjeta de
 * pedido, escaneo de QR). Si la cuenta YA está liquidada, la app muestra el
 * detalle de lo pagado en vez de volver a pedir pago.
 */
export async function GET(req: Request) {
  try {
    const caller = await getAuthenticatedUser(req).catch(() => null);
    if (!caller) return NextResponse.json({ ok: false, error: 'Inicia sesión' }, { status: 401 });

    const orderId = new URL(req.url).searchParams.get('orderId') || '';
    if (!orderId) return NextResponse.json({ ok: false, error: 'orderId requerido' }, { status: 400 });

    const [order] = await restaurantDb
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    if (!order) return NextResponse.json({ ok: false, error: 'Orden no encontrada' }, { status: 404 });

    // Solo el cliente de la orden (o su dueño si es anónima) puede ver el detalle.
    if (order.customerId && String(order.customerId) !== String(caller.id)) {
      return NextResponse.json({ ok: false, error: 'Esta cuenta no es tuya' }, { status: 403 });
    }

    const paymentRows = await restaurantDb
      .select({
        id: payments.id,
        method: payments.method,
        amount: payments.amount,
        tipAmount: payments.tipAmount,
        status: payments.status,
        verificationMethod: payments.verificationMethod,
        reference: payments.reference,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .where(and(eq(payments.orderId, orderId), eq(payments.status, 'COMPLETED')));

    const itemRows = await restaurantDb
      .select({
        id: orderItems.id,
        quantity: orderItems.quantity,
        totalPrice: orderItems.totalPrice,
        name: menuItems.name,
      })
      .from(orderItems)
      .leftJoin(menuItems, eq(menuItems.id, orderItems.menuItemId))
      .where(eq(orderItems.orderId, orderId))
      .orderBy(asc(orderItems.sortOrder));

    const [branch] = await restaurantDb
      .select({ name: branches.name, restaurantId: branches.restaurantId })
      .from(branches)
      .where(eq(branches.id, order.branchId))
      .limit(1);

    const [restaurant] = branch?.restaurantId
      ? await restaurantDb
          .select({ name: restaurants.name })
          .from(restaurants)
          .where(eq(restaurants.id, branch.restaurantId))
          .limit(1)
      : [];

    const paid = paymentRows.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const total = Number(order.total || 0);
    const settledStatuses = new Set(['COMPLETED', 'PAID']);
    const settled =
      settledStatuses.has(String(order.status)) || (total > 0 && paid + 0.005 >= total);

    return NextResponse.json({
      ok: true,
      settled,
      order: {
        id: order.id,
        status: order.status,
        total,
        tip: Number(order.tip || 0),
        bunzPaid: Number(order.bunzPaid || 0),
        createdAt: order.createdAt,
      },
      businessName: restaurant?.name || branch?.name || null,
      branchName: branch?.name || null,
      paid,
      payments: paymentRows.map((p) => ({
        id: p.id,
        method: p.method,
        verificationMethod: p.verificationMethod,
        amount: Number(p.amount || 0),
        tipAmount: Number(p.tipAmount || 0),
        reference: p.reference,
        createdAt: p.createdAt,
      })),
      items: itemRows
        .filter((i) => Number(i.totalPrice || 0) > 0)
        .map((i) => ({
          id: i.id,
          name: i.name || 'Producto',
          quantity: Number(i.quantity || 1),
          totalPrice: Number(i.totalPrice || 0),
        })),
    });
  } catch (err: unknown) {
    console.error('[PAY_RECEIPT]', err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: 'No se pudo leer la cuenta' }, { status: 500 });
  }
}
