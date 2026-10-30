import { NextRequest, NextResponse } from 'next/server';
import { and, eq, lt } from 'drizzle-orm';
import { db } from '@/db';
import { reconciliationRequests, ownedBusinesses, users, notifications } from '@/db/schema';

export const runtime = 'nodejs';

/**
 * Cron de Conciliaciones: SOLO escala — nunca resuelve ni autoriza.
 * PENDING_AFFILIATE sin respuesta del negocio tras 48h → PENDING_GOD (con marca de auto-escalado).
 * Idempotente, basado en timestamps del servidor.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get('x-cron-secret') || req.headers.get('authorization')?.replace('Bearer ', '');
  if (secret && provided !== secret) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
  }

  try {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const stale = await db.update(reconciliationRequests)
      .set({
        status: 'PENDING_GOD',
        affiliateNote: '⏱️ Escalada automáticamente: el negocio no respondió en 48h',
        updatedAt: new Date(),
      })
      .where(and(
        eq(reconciliationRequests.status, 'PENDING_AFFILIATE'),
        lt(reconciliationRequests.createdAt, cutoff),
      ))
      .returning({ id: reconciliationRequests.id, businessId: reconciliationRequests.businessId, claimedBunz: reconciliationRequests.claimedBunz, userId: reconciliationRequests.userId });

    // Notificar a god sobre las escaladas
    if (stale.length > 0) {
      const godRows = await db.select({ id: users.id }).from(users).where(eq(users.role, 'ADMIN'));
      const bizIds = [...new Set(stale.map((s) => s.businessId))];
      const bizRows = bizIds.length ? await db.select({ id: ownedBusinesses.id, name: ownedBusinesses.name }).from(ownedBusinesses) : [];
      for (const g of godRows) {
        for (const s of stale) {
          const biz = bizRows.find((b) => b.id === s.businessId);
          await db.insert(notifications).values({
            id: crypto.randomUUID(),
            userId: g.id,
            title: '⚖️ Conciliación escalada (48h sin respuesta)',
            message: `${biz?.name || 'Negocio'} no respondió — reclamo de ${s.claimedBunz} Bunz espera tu autorización`,
            type: 'SYSTEM',
          });
        }
      }
    }

    return NextResponse.json({ success: true, escalated: stale.length });
  } catch (error) {
    console.error('[CRON RECONCILIATION ERROR]', error);
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
  }
}
