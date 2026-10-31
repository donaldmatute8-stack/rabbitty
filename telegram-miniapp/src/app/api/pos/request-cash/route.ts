import { NextResponse } from 'next/server';
import { restaurantDb } from '@/db/restaurant';
import { orders } from '@rabbitty/database-restaurant/schema';
import { eq, and } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { checkRateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';

/**
 * Fase C — "Pedir la cuenta" desde la mesa (app del Rabbitter).
 * Mismo estado que la vía web (payments.requestCashPayment → CASH_PAYMENT_REQUESTED):
 * el POS/Kiosko lo muestra como "💵 Solicitó efectivo" en Tabs y el cajero cobra
 * en gaveta. Requiere sesión + que la orden pertenezca a la mesa reclamada.
 */
export async function POST(req: Request) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ success: false, error: 'Inicia sesión para pedir tu cuenta' }, { status: 401 });
    }

    const rate = await checkRateLimit(`request_cash:${caller.id}`, 6, 60);
    if (!rate.allowed) {
      return NextResponse.json({ success: false, error: `Espera ${rate.retryAfterSeconds}s` }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const orderId = String(body?.orderId || '');
    if (!orderId) return NextResponse.json({ success: false, error: 'orderId requerido' }, { status: 400 });

    const [order] = await restaurantDb.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return NextResponse.json({ success: false, error: 'Orden no encontrada' }, { status: 404 });

    // Autorización: la orden debe ser de una mesa reclamada por ESTE comensal
    // (o no tener dueño aún y él tener la sesión de la mesa abierta).
    const { tableSessions } = await import('@rabbitty/database-restaurant/schema');
    const [session] = await restaurantDb
      .select()
      .from(tableSessions)
      .where(and(eq(tableSessions.tableId, order.tableId || ''), eq(tableSessions.status, 'OPEN')))
      .limit(1);
    const ownsViaSession = session?.customerId === caller.id;
    const ownsViaOrder = order.customerId === caller.id;
    if (!ownsViaSession && !ownsViaOrder) {
      return NextResponse.json({ success: false, error: 'Esta cuenta pertenece a otro comensal' }, { status: 403 });
    }

    if (order.status === 'COMPLETED' || order.status === 'CASH_PAYMENT_REQUESTED') {
      return NextResponse.json({ success: true, status: order.status, already: true });
    }

    await restaurantDb
      .update(orders)
      .set({ status: 'CASH_PAYMENT_REQUESTED', updatedAt: new Date() })
      .where(eq(orders.id, orderId));

    return NextResponse.json({ success: true, status: 'CASH_PAYMENT_REQUESTED', total: Number(order.total || 0) });
  } catch (err: any) {
    console.error('[REQUEST_CASH_ERROR]', err);
    return NextResponse.json({ success: false, error: 'No se pudo pedir la cuenta' }, { status: 500 });
  }
}