import { NextResponse } from 'next/server';
import { and, desc, eq, inArray, isNotNull, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { bunzyBroadcasts, bunzyDeliveries } from '@/db/schema';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { getOwnedBusinessIds } from '@/lib/chat';

export const runtime = 'nodejs';

/**
 * Bunzy Connect · Comunicados oficiales del destinatario.
 *
 * GET  → comunicados (activos y archivados) con el estado de esta persona.
 * POST → "Entendido": el comunicado pasa al archivo para ese destinatario.
 *
 * El estado no se deduce de un pin del chat: vive en `bunzyDeliveries`
 * (`readAt` = abierto, `archivedAt` = entendido). Solo el servicio oficial
 * crea estos mensajes; desde la app solo se pueden leer y archivar.
 */

/** Filtro de destinatario: usuario directo o negocio propio. */
async function recipientScope(userId: string): Promise<SQL | undefined> {
  const businessIds = await getOwnedBusinessIds(userId);
  const scopes: Array<SQL | undefined> = [
    and(eq(bunzyDeliveries.recipientType, 'USER'), eq(bunzyDeliveries.recipientId, userId)),
  ];
  if (businessIds.length > 0) {
    scopes.push(
      and(
        eq(bunzyDeliveries.recipientType, 'BUSINESS'),
        inArray(bunzyDeliveries.recipientId, businessIds),
      ),
    );
  }
  return or(...scopes);
}

export async function GET(req: Request) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const scope = await recipientScope(caller.id);
    if (!scope) return NextResponse.json({ success: true, items: [], unread: 0 });

    const { searchParams } = new URL(req.url);
    const onlyArchived = searchParams.get('archived') === '1';

    const rows = await db
      .select({
        deliveryId: bunzyDeliveries.id,
        broadcastId: bunzyBroadcasts.id,
        category: bunzyBroadcasts.category,
        title: bunzyBroadcasts.title,
        body: bunzyBroadcasts.body,
        ctaLabel: bunzyBroadcasts.ctaLabel,
        ctaUrl: bunzyBroadcasts.ctaUrl,
        createdAt: bunzyBroadcasts.createdAt,
        readAt: bunzyDeliveries.readAt,
        archivedAt: bunzyDeliveries.archivedAt,
        deliveryStatus: bunzyDeliveries.status,
      })
      .from(bunzyDeliveries)
      .innerJoin(bunzyBroadcasts, eq(bunzyDeliveries.broadcastId, bunzyBroadcasts.id))
      .where(onlyArchived ? and(scope, isNotNull(bunzyDeliveries.archivedAt)) : scope)
      .orderBy(desc(bunzyBroadcasts.createdAt))
      .limit(100);

    const unread = rows.filter((r) => !r.readAt && !r.archivedAt).length;
    return NextResponse.json({ success: true, items: rows, unread });
  } catch (error) {
    console.error('[BUNZY COMUNICADOS GET]', error);
    return NextResponse.json({ error: 'No se pudieron cargar los comunicados' }, { status: 500 });
  }
}

const BodySchema = z.object({ deliveryId: z.string().min(1) });

export async function POST(req: Request) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'deliveryId requerido' }, { status: 400 });
    }

    const scope = await recipientScope(caller.id);
    if (!scope) return NextResponse.json({ error: 'Comunicado no encontrado' }, { status: 404 });

    const now = new Date();
    const [row] = await db
      .update(bunzyDeliveries)
      .set({
        archivedAt: now,
        // Si nunca se abrió, archivarlo también cuenta como lectura.
        readAt: sql`COALESCE(${bunzyDeliveries.readAt}, ${now})`,
        status: 'READ',
        updatedAt: now,
      })
      .where(and(eq(bunzyDeliveries.id, parsed.data.deliveryId), scope))
      .returning({ id: bunzyDeliveries.id, archivedAt: bunzyDeliveries.archivedAt });

    if (!row) return NextResponse.json({ error: 'Comunicado no encontrado' }, { status: 404 });

    return NextResponse.json({ success: true, deliveryId: row.id, archivedAt: row.archivedAt });
  } catch (error) {
    console.error('[BUNZY COMUNICADOS POST]', error);
    return NextResponse.json({ error: 'No se pudo archivar el comunicado' }, { status: 500 });
  }
}
