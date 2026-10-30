import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { membershipSubscriptions } from '@/db/schema';
import { and, eq, lt, sql } from 'drizzle-orm';

export const runtime = 'nodejs';

/**
 * Cron de Membresías: marca EXPIRED las suscripciones vencidas.
 * - `cancelAtPeriodEnd = true` → EXPIRED (renuncia efectiva al fin del periodo)
 * - ACTIVE + periodEnd < now → EXPIRED (sin renovación automática hasta Stripe, Fase 15.2)
 * Protegido por CRON_SECRET (header) o interno de Railway.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get('x-cron-secret') || req.headers.get('authorization')?.replace('Bearer ', '');
  if (secret && provided !== secret) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
  }

  try {
    const now = new Date();
    // Expirar vencidas (una sola pasada con UPDATE condicional — idempotente)
    const expired = await db.update(membershipSubscriptions)
      .set({ status: 'EXPIRED', updatedAt: now })
      .where(and(
        eq(membershipSubscriptions.status, 'ACTIVE'),
        lt(membershipSubscriptions.currentPeriodEnd, now),
      ))
      .returning({ id: membershipSubscriptions.id });

    // Conteo para el reporte
    const [counts] = await db
      .select({
        active: sql<number>`count(*) FILTER (WHERE status = 'ACTIVE')::int`,
        expired: sql<number>`count(*) FILTER (WHERE status = 'EXPIRED')::int`,
      })
      .from(membershipSubscriptions);

    return NextResponse.json({
      success: true,
      expiredNow: expired.length,
      activeTotal: counts?.active ?? 0,
      expiredTotal: counts?.expired ?? 0,
    });
  } catch (error) {
    console.error('[CRON MEMBERSHIPS ERROR]', error);
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
  }
}
