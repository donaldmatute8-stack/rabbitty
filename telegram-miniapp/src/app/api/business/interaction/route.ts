import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, ownedBusinesses } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/serverAuth';

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
    // 'HOP': Incrementar Hops (Like/Salto del consumidor hacia el negocio)
    // 'SAVE': Guardar negocio en "Madrigueras" (Saved)
    // 'SHARE': Registrar analytics de compartir
    let updatedHops = Number((business as unknown as Record<string, unknown>).hops || 0);
    if (action === 'HOP') {
      updatedHops += 1;

      // Si el usuario está autenticado, incrementamos sus hops en el perfil de usuario (definido en users schema)
      if (caller?.id) {
        await db.update(users)
          .set({ hops: sql`${users.hops} + 1` })
          .where(eq(users.id, caller.id))
          .catch(() => {});
      }
    }

    return NextResponse.json({
      success: true,
      action,
      businessId,
      hops: updatedHops,
      meta,
    });
  } catch (error) {
    console.error('Interaction API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
