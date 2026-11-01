import { NextResponse } from 'next/server';
import { restaurantDb } from '@/db/restaurant';
import { orders } from '@rabbitty/database-restaurant/schema';
import { eq } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { checkRateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';

const ADMIN_TRPC = process.env.NEXT_PUBLIC_ADMIN_API_URL || 'https://admin.rabbitty.me/api/trpc';

// tRPC HTTP batch — MUTATIONS: input en el CUERPO {"0": {...}} (URL solo batch=1).
// Para QUERIES: input en la URL y método GET (tRPC no acepta queries por POST).
// Respuesta [{ result: { data } }] o [{ error: { json: { message } } }]
async function callAdmin(procedure: string, input: unknown, opts?: { query?: boolean }): Promise<any> {
  const batchInput = encodeURIComponent(JSON.stringify({ '0': input ?? {} }));
  const url = `${ADMIN_TRPC}/${procedure}?batch=1${opts?.query ? `&input=${batchInput}` : ''}`;
  const res = await fetch(url, opts?.query
    ? { method: 'GET' }
    : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ '0': input }) });
  const json = await res.json().catch(() => null);
  const first = Array.isArray(json) ? json[0] : json;
  const errMsg = first?.error?.message ?? first?.error?.json?.message;
  if (!first || first.error || errMsg) {
    throw new Error(errMsg || `Error llamando a ${procedure} (${res.status})`);
  }
  return first.result?.data;
}

/**
 * GET ?orderId= → total base de la cuenta (para la pantalla de propina del
 * pago in-app; el total real/neto lo calcula siempre el motor del admin).
 */
export async function GET(req: Request) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ success: false, error: 'Inicia sesión para pagar' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const orderId = String(searchParams.get('orderId') || '');
    if (!orderId) return NextResponse.json({ success: false, error: 'orderId requerido' }, { status: 400 });

    const [order] = await restaurantDb.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return NextResponse.json({ success: false, error: 'Orden no encontrada' }, { status: 404 });

    return NextResponse.json({
      success: true,
      total: Number(order.total || 0),
      status: order.status,
      customerName: order.customerName || null,
    });
  } catch (err: any) {
    console.error('[PAY_TOTAL_ERROR]', err?.message || err);
    return NextResponse.json({ success: false, error: 'Error al leer la orden' }, { status: 500 });
  }
}

/**
 * Fase D — Setup del pago IN-APP (sin salir de la miniapp).
 * Proxy server-to-server contra el motor de cobro del admin (tRPC payments.*),
 * todos publicLimitedProcedure sin CORS — el navegador de Telegram nunca habla
 * con otro origen.
 * Crea/recupera el PaymentIntent (motor central, idempotente por attempt) y
 * devuelve el clientSecret + publishableKey para <PaymentElement> in-app.
 */
export async function POST(req: Request) {
  try {
    const caller = await getAuthenticatedUser(req).catch(() => null);
    if (!caller) {
      return NextResponse.json({ success: false, error: 'Inicia sesión para pagar' }, { status: 401 });
    }
    const rate = await checkRateLimit(`pay_setup:${caller.id}`, 12, 60);
    if (!rate.allowed) {
      return NextResponse.json({ success: false, error: `Espera ${rate.retryAfterSeconds}s` }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const orderId = String(body?.orderId || '');
    const tipPercent = [0, 10, 15, 20].includes(Number(body?.tipPercent)) ? Number(body.tipPercent) : 0;
    if (!orderId) {
      return NextResponse.json({ success: false, error: 'orderId requerido' }, { status: 400 });
    }

    // La orden debe existir en el restaurant DB (y pendiente de pago)
    const [order] = await restaurantDb.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return NextResponse.json({ success: false, error: 'Orden no encontrada' }, { status: 404 });
    if (order.status === 'COMPLETED' || order.status === 'VOID' || order.status === 'PAID') {
      return NextResponse.json({ success: false, error: 'Esta cuenta ya fue pagada' }, { status: 409 });
    }

    // Propina: % del total base (sin propina previa)
    const tipAmount = Math.round(Number(order.total || 0) * tipPercent) / 100;

    // 1. PaymentIntent (motor central del admin; idempotente por attempt:1)
    const intent = await callAdmin('payments.createPaymentIntent', {
      orderId,
      tipAmount,
      provider: 'STRIPE',
    });

    // 2. Clave pública para Elements (endpoint público nuevo del admin)
        const pk = await callAdmin('payments.getPublishableKey', {}, { query: true });

    // 3. clientSecret de Stripe Connect
    const secret = await callAdmin('payments.createStripePaymentSecret', { intentId: intent.intentId });

    return NextResponse.json({
      success: true,
      intentId: intent.intentId,
      clientSecret: secret.clientSecret,
      publishableKey: pk?.publishableKey,
      amountTotal: Math.round((Number(intent.netFiatCents || 0) + tipAmount * 100)) / 100,
      tipAmount,
    });
  } catch (err: any) {
    console.error('[PAY_SETUP_ERROR]', err?.message || err);
    return NextResponse.json({ success: false, error: err?.message?.slice(0, 160) || 'No se pudo preparar el pago' }, { status: 500 });
  }
}