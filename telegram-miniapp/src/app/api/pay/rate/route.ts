import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { checkRateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';

// ── Fase 1 Rabbitty Score — proxy del rating post-pago (canal nativo/miniapp) ──
// `ratings.submitRating` (tRPC admin) es protectedProcedure: vive de la sesión
// del admin y el comensal del canal nativo no la tiene (por eso el form
// "cargaba y no pasaba" — el pago sí liquidaba por payments.*, que tiene su
// propio scoping público). El canal correcto es el INTERNO del admin
// (/api/internal/rating) protegido por secret compartido, donde el userId del
// comensal ya fue autenticado AQUÍ (sesión miniapp) y se re-valida allá.
const INTERNAL_RATING_URL =
  process.env.INTERNAL_RATING_URL || 'https://admin.rabbitty.me/api/internal/rating';

async function callInternalRating(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const secret = process.env.RATING_INTERNAL_SECRET;
  if (!secret) {
    throw new Error('Servidor sin RATING_INTERNAL_SECRET configurado');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(INTERNAL_RATING_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-rating-secret': secret,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error((json as any)?.error || `HTTP ${res.status} del servidor de evaluaciones`);
    }
    return (json as Record<string, unknown>) ?? {};
  } finally {
    clearTimeout(timer);
  }
}

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

    const result = await callInternalRating({ userId: caller.id, orderId, stars, attributes, comment });
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    const msg = String(err?.message || 'Error al enviar evaluación').slice(0, 160);
    console.error('[PAY_RATE_ERROR]', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
