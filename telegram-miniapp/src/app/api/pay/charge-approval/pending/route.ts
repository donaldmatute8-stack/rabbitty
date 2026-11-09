import { NextRequest, NextResponse } from 'next/server';
import { restaurantDb } from '@/db/restaurant';
import { posChargeRequests } from '@rabbitty/database-restaurant/schema';
import { and, desc, eq, gt, inArray } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/serverAuth';

export const runtime = 'nodejs';

/**
 * ── Cobros pendientes del Rabbitter ──
 * GET ?branchId=  → solicitudes PENDING/APPROVED vigentes del cliente.
 * La usa la pantalla de espera (loader) y la tarjeta de "pago pendiente".
 */
export async function GET(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req).catch(() => null);
    if (!caller) return NextResponse.json({ ok: false, error: 'Inicia sesión' }, { status: 401 });

    const branchId = new URL(req.url).searchParams.get('branchId') || '';
    const now = new Date();

    const where = branchId
      ? and(
          eq(posChargeRequests.customerId, caller.id),
          eq(posChargeRequests.branchId, branchId),
          inArray(posChargeRequests.status, ['PENDING', 'APPROVED']),
          gt(posChargeRequests.expiresAt, now),
        )
      : and(
          eq(posChargeRequests.customerId, caller.id),
          inArray(posChargeRequests.status, ['PENDING', 'APPROVED']),
          gt(posChargeRequests.expiresAt, now),
        );

    const rows = await restaurantDb
      .select()
      .from(posChargeRequests)
      .where(where)
      .orderBy(desc(posChargeRequests.createdAt))
      .limit(5);

    return NextResponse.json({
      ok: true,
      requests: rows.map((r) => ({
        id: r.id,
        status: r.status,
        method: r.method,
        amount: Number(r.amount || 0),
        tipAmount: Number(r.tipAmount || 0),
        businessName: r.businessName,
        branchId: r.branchId,
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
      })),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[CHARGE_PENDING]', err);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}
