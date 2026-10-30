import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { ownedBusinesses } from '@/db/schema';
import { getAuthenticatedUser } from '@/lib/serverAuth';

export const runtime = 'nodejs';

/**
 * Confirmación GPS de presencia ("Sí, estoy en {comercio}").
 * Abre (o refresca) la presence-session y emite CHECKIN_SCAN para el POS/Kiosko —
 * equivalente al check-in por escaneo, pero sin QR.
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const businessId = String(body?.businessId || '');
    if (!businessId) return NextResponse.json({ error: 'businessId requerido' }, { status: 400 });

    const [biz] = await db.select({ id: ownedBusinesses.id, name: ownedBusinesses.name, ownerId: ownedBusinesses.ownerId })
      .from(ownedBusinesses).where(sql`id = ${businessId}`).limit(1);
    if (!biz) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 });

    const now = new Date();
    // Abrir o refrescar sesión abierta
    const [open] = await db.execute(
      sql`SELECT id FROM "presenceSessions" WHERE "userId" = ${caller.id} AND "businessId" = ${biz.id} AND "endedAt" IS NULL LIMIT 1`
    ).then((r: unknown) => ((r as { rows?: Array<{ id: string }> }).rows || (r as unknown as Array<{ id: string }>)));
    if (open) {
      await db.execute(sql`UPDATE "presenceSessions" SET "lastPingAt" = now(), "updatedAt" = now() WHERE id = ${open.id}`);
    } else {
      // Cerrar sesiones en otros negocios (se movió)
      await db.execute(sql`UPDATE "presenceSessions" SET "endedAt" = now(), "updatedAt" = now() WHERE "userId" = ${caller.id} AND "endedAt" IS NULL`);
      await db.execute(sql`INSERT INTO "presenceSessions" ("id", "userId", "businessId", "source", "startedAt", "lastPingAt")
        VALUES (gen_random_uuid()::text, ${caller.id}, ${biz.id}, 'gps', now(), now())`);
    }

    // Señal para el feed del POS/Kiosko
    try {
      await db.execute(sql`INSERT INTO "business_interactions" (id, "userId", "businessId", action, channel, metadata)
        VALUES (${`ck_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`}, ${caller.id}, ${biz.id}, 'CHECKIN_SCAN', null,
          ${JSON.stringify({ kind: 'gps_confirm', at: now.toISOString() })}::jsonb)`);
    } catch { /* best-effort */ }

    // Aviso al dueño (anti-spam: solo si no hay aviso del mismo usuario en 12h)
    if (biz.ownerId && biz.ownerId !== caller.id) {
      try {
        const [recent] = await db.execute(
          sql`SELECT id FROM "notifications" WHERE "userId" = ${biz.ownerId} AND type = 'SYSTEM' AND "createdAt" >= now() - interval '12 hours'
              AND message ILIKE ${'%' + (caller.username || caller.id) + '%'} LIMIT 1`
        ).then((r: unknown) => ((r as { rows?: Array<{ id: string }> }).rows || (r as unknown as Array<{ id: string }>)));
        if (!recent) {
          await db.execute(sql`INSERT INTO "notifications" ("id", "userId", "title", "message", "type", "route")
            VALUES (gen_random_uuid()::text, ${biz.ownerId}, '📍 Un rabbitter confirmó presencia',
            ${`@${caller.username || 'rabbitter'} confirmó por GPS que está en ${biz.name}. Ya aparece en tu POS.`}, 'SYSTEM', '/pos')`);
        }
      } catch { /* best-effort */ }
    }

    return NextResponse.json({ success: true, businessName: biz.name });
  } catch (error) {
    console.error('[CONFIRM PRESENCE ERROR]', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
