import { NextRequest, NextResponse } from 'next/server';
import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/db';
import { ownedBusinesses, users, notifications } from '@/db/schema';
import { getAuthenticatedUser } from '@/lib/serverAuth';

export const runtime = 'nodejs';

/**
 * "Planeo ir" — acción sobre una oferta de proximidad.
 * Registra PLAN_VISIT en business_interactions (anti-spam: 1 por usuario/negocio/12h)
 * y notifica al dueño: quién viene, cuándo y con qué intención → puede preparar boost.
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const businessId = String(body?.businessId || '');
    if (!businessId) return NextResponse.json({ error: 'businessId requerido' }, { status: 400 });

    const [biz] = await db.select({ id: ownedBusinesses.id, name: ownedBusinesses.name, ownerId: ownedBusinesses.ownerId })
      .from(ownedBusinesses).where(eq(ownedBusinesses.id, businessId)).limit(1);
    if (!biz) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 });

    // Anti-spam: 1 planeo por usuario/negocio cada 12h
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
    const [recent] = await db.select({ id: notifications.id })
      .from(notifications)
      .where(and(
        eq(notifications.userId, biz.ownerId || ''),
        eq(notifications.type, 'SYSTEM'),
        gte(notifications.createdAt, twelveHoursAgo),
        sql`${notifications.message} LIKE ${'%' + (caller.username || caller.id) + '%'}%planea venir%`,
      ))
      .limit(1)
      .catch(() => [null] as Array<{ id: string } | null>);

    // Registrar interacción (telemetría + fuente del POS "planean venir")
    try {
      await db.execute(sql`
        INSERT INTO "business_interactions" (id, "userId", "businessId", action, channel, metadata)
        VALUES (${`pv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`}, ${caller.id}, ${businessId}, 'PLAN_VISIT', null,
          ${JSON.stringify({ at: new Date().toISOString() })}::jsonb
      `);
    } catch { /* best-effort */ }

    // Notificar al dueño (si no es él mismo)
    if (biz.ownerId && biz.ownerId !== caller.id && !recent) {
      await db.insert(notifications).values({
        id: crypto.randomUUID(),
        userId: biz.ownerId,
        title: `🚶 @${caller.username || 'Un rabbitter'} planea venir`,
        message: `Está cerca y marcó "Voy" a ${biz.name}. Prepárale una bienvenida: activa un boost % o ten su oferta lista.`,
        type: 'SYSTEM',
        route: '/pos',
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, message: `Vamos que te esperamos en ${biz.name} 🐰` });
  } catch (error) {
    console.error('[PLAN VISIT ERROR]', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
