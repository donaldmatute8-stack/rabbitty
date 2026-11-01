import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { checkRateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';

const ADMIN_TRPC = process.env.NEXT_PUBLIC_ADMIN_API_URL || 'https://admin.rabbitty.me/api/trpc';

// tRPC MUTATION POST batch: input en el CUERPO ({"0": {...}})
async function callAdmin(procedure: string, input: unknown): Promise<any> {
  const url = `${ADMIN_TRPC}/${procedure}?batch=1`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ '0': input }),
  });
  const json = await res.json().catch(() => null);
  const first = Array.isArray(json) ? json[0] : json;
  const errMsg = first?.error?.message ?? first?.error?.json?.message;
  if (!first || first.error || errMsg) {
    throw new Error(errMsg || `Error llamando a ${procedure} (${res.status})`);
  }
  return first.result?.data;
}

/**
 * Fase 1 Rabbitty Score — proxy del rating post-pago.
 * El server (ratings.submitRating) valida dueño de la orden, estado COMPLETED/PAID
 * y payment COMPLETED. Aquí solo se reenvía la sesión del comensal.
 */
export async function POST(req: Request) {
  try {
    const caller = await getAuthenticatedUser(req).catch(() => null);
    if (!caller) return NextResponse.json({ success: false, error: 'Inicia sesión para evaluar' }, { status: 401 });

    const rate = await checkRateLimit(`rating:${caller.id}`, 10, 60);
    if (!rate.allowed) {
      return NextResponse.json({ success: false, error: `Espera ${rate.retryAfterSeconds}s` }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const orderId = String(body?.orderId || '');
    const stars = Number(body?.stars);
    if (!orderId || !Number.isInteger(stars) || stars < 1 || stars > 5) {
      return NextResponse.json({ success: false, error: 'Datos inválidos' }, { status: 400 });
    }
    const attributes = Array.isArray(body?.attributes)
      ? body.attributes.filter((a: unknown) => typeof a === 'string').slice(0, 4)
      : undefined;
    const comment = typeof body?.comment === 'string' ? body.comment.slice(0, 500) : undefined;

    const result = await callAdmin('ratings.submitRating', { orderId, stars, attributes, comment });
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[PAY_RATE_ERROR]', err?.message || err);
    return NextResponse.json({ success: false, error: String(err?.message || 'Error al enviar evaluación').slice(0, 160) }, { status: 400 });
  }
}