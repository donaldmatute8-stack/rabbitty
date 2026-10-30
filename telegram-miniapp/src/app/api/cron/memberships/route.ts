import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { membershipSubscriptions, notifications } from '@/db/schema';
import { and, eq, lt, gte, sql } from 'drizzle-orm';
import { sendEcosystemNotification } from '@/lib/push/notify';

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
        eq(membershipSubscriptions.noExpiration, false),
        lt(membershipSubscriptions.currentPeriodEnd, now),
      ))
      .returning({ id: membershipSubscriptions.id, userId: membershipSubscriptions.userId });

    // Conteo para el reporte
    // Notificar a los expirados de esta pasada
    for (const sub of expired) {
      if (sub.userId) {
        await sendEcosystemNotification({
          userId: sub.userId,
          title: '⚠️ Tu membresía expiró',
          message: 'El periodo pagado terminó. Renuévate desde el perfil del negocio para seguir con tus beneficios.',
          type: 'REWARD',
          route: '/memberships',
        }).catch(() => {});
      }
    }

    // Warning T-3: vencen en ≤3 días (solo una vez por ciclo — marcador en notifications)
    const warningWindow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const expiringSoon = await db.select({ userId: membershipSubscriptions.userId, planVersionId: membershipSubscriptions.planVersionId, currentPeriodEnd: membershipSubscriptions.currentPeriodEnd })
      .from(membershipSubscriptions)
      .where(and(
        eq(membershipSubscriptions.status, 'ACTIVE'),
        eq(membershipSubscriptions.noExpiration, false),
        gte(membershipSubscriptions.currentPeriodEnd, new Date()),
        lt(membershipSubscriptions.currentPeriodEnd, warningWindow),
      ));
    for (const sub of expiringSoon) {
      // Anti-duplicado: solo 1 warning por usuario con esa fecha de fin
      const [alreadyWarned] = await db.select({ id: notifications.id })
        .from(notifications)
        .where(and(
          eq(notifications.userId, sub.userId),
          sql`${notifications.message} LIKE ${'%' + (sub.currentPeriodEnd?.toISOString().slice(0, 10) || '') + '%'}`,
          eq(notifications.title, '⏰ Tu membresía expira pronto'),
        ))
        .limit(1);
      if (!alreadyWarned) {
        const daysLeft = Math.max(1, Math.ceil(((sub.currentPeriodEnd?.getTime() ?? 0) - Date.now()) / 86400000));
        await sendEcosystemNotification({
          userId: sub.userId,
          title: '⏰ Tu membresía expira pronto',
          message: `Vence en ${daysLeft} día${daysLeft > 1 ? 's' : ''} (${sub.currentPeriodEnd?.toLocaleDateString('es-MX')}). Renuévate desde el perfil del negocio.`,
          type: 'SYSTEM',
          route: '/memberships',
        }).catch(() => {});
      }
    }

    const [counts] = await db
      .select({
        active: sql<number>`count(*) FILTER (WHERE status = 'ACTIVE')::int`,
        expired: sql<number>`count(*) FILTER (WHERE status = 'EXPIRED')::int`,
      })
      .from(membershipSubscriptions);

    return NextResponse.json({
      success: true,
      expiredNow: expired.length,
      warnedSoon: expiringSoon.length,
      activeTotal: counts?.active ?? 0,
      expiredTotal: counts?.expired ?? 0,
    });
  } catch (error) {
    console.error('[CRON MEMBERSHIPS ERROR]', error);
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
  }
}
