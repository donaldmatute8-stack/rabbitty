/**
 * ── Preferencias de consumo del Rabbitter ───────────────────────────────────
 *
 * GET  → favoritos inferidos (por negocio) + categorías globales.
 * POST → marcar un favorito explícito (manda sobre lo inferido).
 *
 * Solo devuelve las preferencias del propio usuario autenticado.
 */

import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { userPreferences } from '@/db/schema';
import { getAuthenticatedUser } from '@/lib/serverAuth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const rows = await db
      .select({
        id: userPreferences.id,
        businessId: userPreferences.businessId,
        kind: userPreferences.kind,
        refId: userPreferences.refId,
        label: userPreferences.label,
        score: userPreferences.score,
        signalCount: userPreferences.signalCount,
        lastSeenAt: userPreferences.lastSeenAt,
        explicit: userPreferences.explicit,
      })
      .from(userPreferences)
      .where(eq(userPreferences.userId, caller.id))
      .orderBy(desc(userPreferences.score))
      .limit(200);

    const byBusiness: Record<string, { products: typeof rows; categories: typeof rows }> = {};
    const global: typeof rows = [];

    for (const row of rows) {
      if (!row.businessId) {
        global.push(row);
        continue;
      }
      const bucket = byBusiness[row.businessId] ?? { products: [], categories: [] };
      if (row.kind === 'PRODUCT') bucket.products.push(row);
      else bucket.categories.push(row);
      byBusiness[row.businessId] = bucket;
    }

    return NextResponse.json({ success: true, global, byBusiness });
  } catch (err) {
    console.error('[preferences] list error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const body = await req.json().catch(() => null);
    const kind = body?.kind === 'CATEGORY' ? 'CATEGORY' : body?.kind === 'PRODUCT' ? 'PRODUCT' : null;
    const refId = typeof body?.refId === 'string' ? body.refId.trim() : '';
    const label = typeof body?.label === 'string' ? body.label.trim() : '';
    const businessId = typeof body?.businessId === 'string' && body.businessId ? body.businessId : null;

    if (!kind || !refId || !label) {
      return NextResponse.json({ error: 'kind, refId y label son requeridos' }, { status: 400 });
    }

    // Un favorito por tipo y ámbito: al marcar uno, el anterior deja de serlo.
    await db
      .update(userPreferences)
      .set({ explicit: false, updatedAt: new Date() })
      .where(
        and(
          eq(userPreferences.userId, caller.id),
          eq(userPreferences.kind, kind),
          businessId ? eq(userPreferences.businessId, businessId) : isNull(userPreferences.businessId),
          eq(userPreferences.explicit, true),
        ),
      );

    const where = and(
      eq(userPreferences.userId, caller.id),
      eq(userPreferences.kind, kind),
      eq(userPreferences.refId, refId),
      businessId ? eq(userPreferences.businessId, businessId) : isNull(userPreferences.businessId),
    );

    const [existing] = await db
      .select({ id: userPreferences.id })
      .from(userPreferences)
      .where(where)
      .limit(1);

    if (existing) {
      await db
        .update(userPreferences)
        .set({
          label,
          score: 1,
          explicit: true,
          source: 'EXPLICIT',
          signalCount: 1,
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userPreferences.id, existing.id));
    } else {
      await db.insert(userPreferences).values({
        userId: caller.id,
        businessId,
        kind,
        refId,
        label,
        score: 1,
        signalCount: 1,
        lastSeenAt: new Date(),
        source: 'EXPLICIT',
        explicit: true,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[preferences] save error:', err);
    return NextResponse.json({ error: 'No se pudo guardar la preferencia' }, { status: 500 });
  }
}
