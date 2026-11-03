import { NextRequest, NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { ownedBusinesses, ledgerEntries } from '@/db/schema';
import { getAuthenticatedUser } from '@/lib/serverAuth';

export const runtime = 'nodejs';

/**
 * Estado de presencia del usuario en un negocio — fuente de verdad: DB.
 *
 * `active` = sesión de permanencia ABIERTA (presenceSessions.endedAt IS NULL)
 *            o check-in de HOY en el ledger (America/Mexico_City).
 *
 * Consumidores: botón "Estoy aquí" de /affiliate/[id] (hidratación al montar)
 * y cualquier superficie que deba reflejar el check-in real. Antes cada
 * superficie guardaba el estado en useState(false) local y "se perdía" entre
 * pantallas — este endpoint es el único lugar autoritativo.
 */
export async function GET(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });

    const businessId = String(req.nextUrl.searchParams.get('businessId') || '');
    if (!businessId) return NextResponse.json({ success: false, error: 'businessId requerido' }, { status: 400 });

    // El id de ruta puede ser id o slug (mismo contrato que confirm-presence)
    const [biz] = await db
      .select({ id: ownedBusinesses.id, name: ownedBusinesses.name })
      .from(ownedBusinesses)
      .where(sql`id = ${businessId} OR slug = ${businessId}`)
      .limit(1);
    if (!biz) return NextResponse.json({ success: false, error: 'Negocio no encontrado' }, { status: 404 });

    // 1. ¿Sesión de permanencia abierta en este negocio?
    const open = await db.execute(
      sql`SELECT "startedAt" FROM "presenceSessions"
          WHERE "userId" = ${caller.id} AND "businessId" = ${biz.id} AND "endedAt" IS NULL
          ORDER BY "startedAt" DESC LIMIT 1`
    ).then((r: unknown) => {
      const rows = (r as { rows?: Array<{ startedAt: string }> }).rows || (r as unknown as Array<{ startedAt: string }>);
      return rows[0] ?? null;
    });

    // 2. ¿Check-in de HOY (ledger, día CDMX igual que el registro)?
    const cdmxDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
    const [todayRow] = await db
      .select({ n: sql<number>`COUNT(*)` })
      .from(ledgerEntries)
      .where(and(
        eq(ledgerEntries.payeeSubjectId, `usr_${caller.id}`),
        eq(ledgerEntries.payerSubjectId, biz.id),
        eq(ledgerEntries.type, 'EARN'),
        eq(ledgerEntries.idempotencyKey, `checkin_${biz.id}_${caller.id}_${cdmxDate}`),
      ));

    const checkedInToday = Number(todayRow?.n ?? 0) > 0;

    return NextResponse.json({
      success: true,
      active: Boolean(open) || checkedInToday,
      openSession: Boolean(open),
      since: open?.startedAt ?? null,
      checkedInToday,
      businessId: biz.id,
      businessName: biz.name,
    });
  } catch (error) {
    console.error('[PRESENCE GET ERROR]', error);
    return NextResponse.json({ success: false, error: 'No se pudo leer la presencia' }, { status: 500 });
  }
}
