import { NextRequest, NextResponse } from 'next/server';
import { restaurantDb } from '@/db/restaurant';
import { posChargeRequests } from '@rabbitty/database-restaurant/schema';
import { and, eq } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/serverAuth';

export const runtime = 'nodejs';

/**
 * ── Confirmación de cobro del Rabbitter ──
 * GET  ?requestId=  → detalle de la solicitud (solo el cliente dueño).
 * POST { requestId, decision: 'approve' | 'reject' } → autoriza/rechaza.
 *
 * No ejecuta el cargo: el POS es quien cobra al recibir APPROVED.
 */
export async function GET(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req).catch(() => null);
    if (!caller) return NextResponse.json({ ok: false, error: 'Inicia sesión' }, { status: 401 });

    const requestId = new URL(req.url).searchParams.get('requestId') || '';
    if (!requestId) return NextResponse.json({ ok: false, error: 'requestId requerido' }, { status: 400 });

    const [request] = await restaurantDb
      .select()
      .from(posChargeRequests)
      .where(and(eq(posChargeRequests.id, requestId), eq(posChargeRequests.customerId, caller.id)))
      .limit(1);
    if (!request) return NextResponse.json({ ok: false, error: 'Solicitud no encontrada' }, { status: 404 });

    let status = request.status;
    if (status === 'PENDING' && new Date(request.expiresAt) < new Date()) {
      await restaurantDb
        .update(posChargeRequests)
        .set({ status: 'EXPIRED', updatedAt: new Date() })
        .where(eq(posChargeRequests.id, request.id));
      status = 'EXPIRED';
    }

    return NextResponse.json({
      ok: true,
      request: {
        id: request.id,
        status,
        method: request.method,
        amount: Number(request.amount || 0),
        tipAmount: Number(request.tipAmount || 0),
        items: request.items ?? [],
        businessName: request.businessName,
        createdAt: request.createdAt,
        expiresAt: request.expiresAt,
        respondedAt: request.respondedAt,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[CHARGE_APPROVAL_GET]', err);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req).catch(() => null);
    if (!caller) return NextResponse.json({ ok: false, error: 'Inicia sesión' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const requestId = String(body?.requestId || '');
    const decision = String(body?.decision || '');
    if (!requestId || !['approve', 'reject'].includes(decision)) {
      return NextResponse.json({ ok: false, error: 'Solicitud inválida' }, { status: 400 });
    }

    const [request] = await restaurantDb
      .select()
      .from(posChargeRequests)
      .where(and(eq(posChargeRequests.id, requestId), eq(posChargeRequests.customerId, caller.id)))
      .limit(1);
    if (!request) return NextResponse.json({ ok: false, error: 'Solicitud no encontrada' }, { status: 404 });

    if (request.status !== 'PENDING') {
      return NextResponse.json({ ok: true, status: request.status });
    }
    if (new Date(request.expiresAt) < new Date()) {
      await restaurantDb
        .update(posChargeRequests)
        .set({ status: 'EXPIRED', updatedAt: new Date() })
        .where(eq(posChargeRequests.id, request.id));
      return NextResponse.json({ ok: true, status: 'EXPIRED' });
    }

    const status = decision === 'approve' ? 'APPROVED' : 'REJECTED';
    await restaurantDb
      .update(posChargeRequests)
      .set({ status, respondedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(posChargeRequests.id, request.id), eq(posChargeRequests.status, 'PENDING')));

    return NextResponse.json({ ok: true, status });
  } catch (err) {
    console.error('[CHARGE_APPROVAL_POST]', err);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}
