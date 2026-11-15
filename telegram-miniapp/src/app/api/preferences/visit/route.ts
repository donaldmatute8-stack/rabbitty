/**
 * ── Visita a un negocio = conversión del aviso ──────────────────────────────
 *
 * Cuando el Rabbitter abre la ficha del negocio, marcamos el aviso más reciente
 * de ese negocio (últimos 7 días) como abierto y convertido. Es la métrica que
 * dice si "ya te alcanza" sirve: ¿fue después del aviso?
 */

import { NextRequest, NextResponse } from 'next/server';
import { and, eq, gte, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { preferenceNudges } from '@/db/schema';
import { getAuthenticatedUser } from '@/lib/serverAuth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const body = await req.json().catch(() => null);
    const businessId = typeof body?.businessId === 'string' ? body.businessId.trim() : '';
    if (!businessId) return NextResponse.json({ error: 'businessId requerido' }, { status: 400 });

    const since = new Date(Date.now() - 7 * 86_400_000);

    const updated = await db
      .update(preferenceNudges)
      .set({
        openedAt: sql`COALESCE(${preferenceNudges.openedAt}, now())`,
        convertedAt: sql`COALESCE(${preferenceNudges.convertedAt}, now())`,
      })
      .where(
        and(
          eq(preferenceNudges.userId, caller.id),
          eq(preferenceNudges.businessId, businessId),
          gte(preferenceNudges.sentAt, since),
          isNull(preferenceNudges.convertedAt),
        ),
      )
      .returning({ id: preferenceNudges.id });

    return NextResponse.json({ success: true, marked: updated.length });
  } catch (err) {
    console.error('[preferences/visit] error:', err);
    return NextResponse.json({ error: 'No se pudo registrar la visita' }, { status: 500 });
  }
}
