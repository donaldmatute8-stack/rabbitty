import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { checkRateLimit } from '@/lib/rateLimit';
import { callInternalPay } from '@/lib/internalPay';

export const runtime = 'nodejs';

/**
 * ── Mercado Pago en la app (Checkout Pro) ──
 * GET   ?orderId → disponibilidad para esa sucursal (sin credenciales).
 * POST  { orderId, tipAmount? } → crea/reutiliza link de pago (initPoint).
 * PATCH { orderId } → "Ya pagué": verifica en MP y liquida si fue aprobado.
 */
export async function GET(req: Request) {
  try {
    const caller = await getAuthenticatedUser(req).catch(() => null);
    if (!caller) return NextResponse.json({ ok: false, error: 'Inicia sesión para pagar' }, { status: 401 });

    const orderId = new URL(req.url).searchParams.get('orderId') || '';
    if (!orderId) return NextResponse.json({ ok: false, error: 'orderId requerido' }, { status: 400 });

    const data = await callInternalPay({ action: 'mp-availability', orderId, userId: caller.id });
    return NextResponse.json({ ok: Boolean(data.ok), available: Boolean(data.available), mode: data.mode ?? 'live' });
  } catch (err: any) {
    console.error('[PAY_MP_GET]', err?.message || err);
    return NextResponse.json({ ok: false, available: false, error: 'No se pudo consultar Mercado Pago' }, { status: 200 });
  }
}

export async function POST(req: Request) {
  try {
    const caller = await getAuthenticatedUser(req).catch(() => null);
    if (!caller) return NextResponse.json({ ok: false, error: 'Inicia sesión para pagar' }, { status: 401 });

    const rate = await checkRateLimit(`pay_mp:${caller.id}`, 10, 60);
    if (!rate.allowed) {
      return NextResponse.json({ ok: false, error: `Espera ${rate.retryAfterSeconds}s` }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const orderId = String(body?.orderId || '');
    const tipAmount = Math.max(0, Number(body?.tipAmount || 0));
    if (!orderId) return NextResponse.json({ ok: false, error: 'orderId requerido' }, { status: 400 });

    const data = await callInternalPay({ action: 'mp-checkout', orderId, userId: caller.id, tipAmount });
    if (!data.ok) {
      const notReady = String(data.error || '').includes('MERCADO_PAGO_NOT_READY');
      return NextResponse.json(
        {
          ok: false,
          code: notReady ? 'TENANT_MERCADO_PAGO_NOT_READY' : 'MP_CHECKOUT_FAILED',
          error: notReady
            ? 'Este negocio aún no tiene Mercado Pago activo. Puedes pagar con Bunz, tarjeta o en caja.'
            : String(data.error || 'No se pudo crear el pago con Mercado Pago.'),
        },
        { status: notReady ? 409 : 500 }
      );
    }
    return NextResponse.json({ ok: true, ...data });
  } catch (err: any) {
    console.error('[PAY_MP_POST]', err?.message || err);
    return NextResponse.json(
      { ok: false, code: 'MP_CHECKOUT_FAILED', error: 'No se pudo crear el pago con Mercado Pago. Intenta de nuevo.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const caller = await getAuthenticatedUser(req).catch(() => null);
    if (!caller) return NextResponse.json({ ok: false, error: 'Inicia sesión para pagar' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const orderId = String(body?.orderId || '');
    if (!orderId) return NextResponse.json({ ok: false, error: 'orderId requerido' }, { status: 400 });

    const data = await callInternalPay({ action: 'mp-verify', orderId, userId: caller.id });
    return NextResponse.json({ ok: Boolean(data.ok), ...data });
  } catch (err: any) {
    console.error('[PAY_MP_VERIFY]', err?.message || err);
    return NextResponse.json({ ok: false, settled: false, error: 'No se pudo verificar el pago' }, { status: 200 });
  }
}
