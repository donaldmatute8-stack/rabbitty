import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, ownedBusinesses } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { sendEcosystemNotification } from '@/lib/push/notify';

export async function POST(req: Request) {
  try {
    const caller = await getAuthenticatedUser(req);
    const body = await req.json();
    const { businessId, action, meta } = body;

    if (!businessId || !action) {
      return NextResponse.json({ error: 'businessId y action son requeridos' }, { status: 400 });
    }

    const business = await db.query.ownedBusinesses.findFirst({
      where: eq(ownedBusinesses.id, businessId),
    });

    if (!business) {
      return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 });
    }

    // Acciones soportadas:
    // 'HOP': Incrementar Hops (Like/Salto de comunidad hacia el negocio)
    // 'SAVE': Guardar negocio en "Madrigueras" (Saved)
    // 'SHARE': Registrar analytics de compartir (WhatsApp, Telegram, etc.)
    let updatedHops = Number((business as unknown as Record<string, unknown>).hops || 0);
    let updatedSaved = Number((business as unknown as Record<string, unknown>).savedCount || 0);
    let updatedShared = Number((business as unknown as Record<string, unknown>).sharedCount || 0);

    if (action === 'HOP') {
      updatedHops += 1;
      await db.update(ownedBusinesses)
        .set({ hops: sql`${ownedBusinesses.hops} + 1` })
        .where(eq(ownedBusinesses.id, businessId))
        .catch(() => {});

      // Incrementar hops en el perfil del usuario activo
      if (caller?.id) {
        await db.update(users)
          .set({ hops: sql`${users.hops} + 1` })
          .where(eq(users.id, caller.id))
          .catch(() => {});
      }

      // Notificar al dueño del negocio sobre el nuevo Hop
      if (business.ownerId && business.ownerId !== caller?.id) {
        await sendEcosystemNotification({
          userId: business.ownerId,
          title: `🔥 ¡Nuevo Hop en ${business.name}!`,
          message: `${caller?.username ? `@${caller.username}` : 'Un usuario'} le dio Hop a tu negocio. ¡Tu popularidad sube en el mapa!`,
          type: 'HOPS',
          route: '/business',
          pushData: { businessId: business.id, action: 'HOP' },
          threadId: 'business_hops',
        });
      }
    } else if (action === 'SAVE') {
      const isSaved = meta?.saved ?? true;
      updatedSaved = isSaved ? updatedSaved + 1 : Math.max(0, updatedSaved - 1);
      await db.update(ownedBusinesses)
        .set({ 
          savedCount: isSaved 
            ? sql`${ownedBusinesses.savedCount} + 1` 
            : sql`GREATEST(0, ${ownedBusinesses.savedCount} - 1)` 
        })
        .where(eq(ownedBusinesses.id, businessId))
        .catch(() => {});

      // Notificar al dueño del negocio cuando lo guardan en Madriguera
      if (isSaved && business.ownerId && business.ownerId !== caller?.id) {
        await sendEcosystemNotification({
          userId: business.ownerId,
          title: `🐰 ¡Guardado en Madriguera!`,
          message: `Un explorador guardó ${business.name} en sus Madrigueras favoritas.`,
          type: 'MADRIGUERA',
          route: '/business',
          pushData: { businessId: business.id, action: 'SAVE' },
          threadId: 'business_saves',
        });
      }
    } else if (action === 'SHARE') {
      updatedShared += 1;
      await db.update(ownedBusinesses)
        .set({ sharedCount: sql`${ownedBusinesses.sharedCount} + 1` })
        .where(eq(ownedBusinesses.id, businessId))
        .catch(() => {});
    }

    // Registrar evento de telemetría en tabla business_interactions
    try {
      const interactionId = `bi_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const channel = typeof meta === 'object' && meta !== null && 'channel' in meta ? String((meta as Record<string, unknown>).channel) : null;
      await db.execute(sql`
        INSERT INTO "business_interactions" (id, "userId", "businessId", "action", "channel", "metadata")
        VALUES (
          ${interactionId},
          ${caller?.id || null},
          ${businessId},
          ${action},
          ${channel},
          ${meta ? JSON.stringify(meta) : null}::jsonb
        )
      `);
    } catch (e) {
      console.warn('Could not record business_interactions telemetry:', e);
    }

    return NextResponse.json({
      success: true,
      action,
      businessId,
      hops: updatedHops,
      savedCount: updatedSaved,
      sharedCount: updatedShared,
      meta,
    });
  } catch (error) {
    console.error('Interaction API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
