import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { checkRateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';

const ADMIN_TRPC = process.env.NEXT_PUBLIC_ADMIN_API_URL || 'https://admin.rabbitty.me/api/trpc';

// tRPC mutation POST batch (input via URL) — igual que /api/pay/setup
async function callAdmin(procedure: string, input: unknown): Promise<any> {
  const inputStr = encodeURIComponent(JSON.stringify({ '0': input }));
  const url = `${ADMIN_TRPC}/${procedure}?batch=1&input=${inputStr}`;
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  const json = await res.json().catch(() => null);
  const first = Array.isArray(json) ? json[0] : json;
  if (!first || first.error) {
    throw new Error(first?.error?.message || `Error llamando a ${procedure} (${res.status})`);
  }
  return first.result?.data;
}

/**
 * Fase D — reconciliación del pago in-app contra el admin.
 * Proxy a payments.verifyStripePaymentIntent (idempotente, validado contra
 * Stripe: monto/moneda/metadata) → liquida la orden y mintea el cashback.
 */
export async function POST(req: Request) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ success: false, error: 'Inicia sesión para pagar' }, { status: 401 });
    }
    const rate = await checkRateLimit(`pay_verify:${caller.id}`, 20, 60);
    if (!rate.allowed) {
      return NextResponse.json({ success: false, error: `Espera ${rate.retryAfterSeconds}s` }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const intentId = String(body?.intentId || '');
    if (!intentId) return NextResponse.json({ success: false, error: 'intentId requerido' }, { status: 400 });

    const result = await callAdmin('payments.verifyStripePaymentIntent', { intentId });
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[PAY_VERIFY_ERROR]', err?.message || err);
    return NextResponse.json({ success: false, error: err?.message?.slice(0, 160) || 'Error al verificar el pago' }, { status: 500 });
  }
}