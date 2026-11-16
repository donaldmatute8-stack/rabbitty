/**
 * ── Compartir la lista con un grupo (la madriguera) ─────────────────────────
 *
 * POST   { groupId } → comparte la lista y avisa a los miembros del grupo.
 * DELETE ?groupId=   → deja de compartirla con ese grupo.
 *
 * La lista solo se comparte explícitamente; el negocio nunca la ve.
 */

import { NextRequest, NextResponse } from 'next/server';
import { and, eq, isNull, ne, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  conversationMembers,
  notificationsOutbox,
  users,
  wishlistItems,
  wishlistShares,
  wishlists,
} from '@/db/schema';
import { getAuthenticatedUser } from '@/lib/serverAuth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const body = await req.json().catch(() => null);
    const groupId = typeof body?.groupId === 'string' ? body.groupId.trim() : '';
    if (!groupId) return NextResponse.json({ error: 'groupId requerido' }, { status: 400 });

    const [list] = await db.select().from(wishlists).where(eq(wishlists.userId, caller.id)).limit(1);
    if (!list) return NextResponse.json({ error: 'Primero agrega un deseo' }, { status: 400 });

    // Solo puedo compartir con grupos donde estoy
    const [member] = await db
      .select({ id: conversationMembers.id })
      .from(conversationMembers)
      .where(
        and(
          eq(conversationMembers.conversationId, groupId),
          eq(conversationMembers.userId, caller.id),
          isNull(conversationMembers.leftAt),
        ),
      )
      .limit(1);
    if (!member) return NextResponse.json({ error: 'No perteneces a ese grupo' }, { status: 403 });

    await db
      .insert(wishlistShares)
      .values({ wishlistId: list.id, groupId })
      .onConflictDoNothing();

    await db.update(wishlists).set({ visibility: 'CIRCLE', updatedAt: new Date() }).where(eq(wishlists.id, list.id));

    // Aviso a los miembros (una vez por día y grupo)
    const [countRow] = await db
      .select({ activeItems: sql<number>`count(*)::int` })
      .from(wishlistItems)
      .where(and(eq(wishlistItems.wishlistId, list.id), eq(wishlistItems.status, 'ACTIVE')));
    const activeItems = Number(countRow?.activeItems ?? 0);

    const [me] = await db
      .select({ firstName: users.firstName, username: users.username })
      .from(users)
      .where(eq(users.id, caller.id))
      .limit(1);
    const myName = me?.firstName || me?.username || 'Alguien';

    const mates = await db
      .select({ userId: conversationMembers.userId })
      .from(conversationMembers)
      .where(
        and(
          eq(conversationMembers.conversationId, groupId),
          isNull(conversationMembers.leftAt),
          ne(conversationMembers.userId, caller.id),
        ),
      )
      .limit(100);

    const day = new Date().toISOString().slice(0, 10);
    for (const mate of mates) {
      await db
        .insert(notificationsOutbox)
        .values({
          userId: mate.userId,
          type: 'WISHLIST_ADDED',
          title: `${myName} compartió su lista de deseos`,
          message: `Tiene ${activeItems} deseo${activeItems === 1 ? '' : 's'}. Entra y mira si puedes regalarle algo.`,
          route: '/profile/wishlist?tab=circle',
          data: { groupId, wishlistId: list.id },
          dedupeKey: `wishlist_shared:${list.id}:${groupId}:${day}`,
          priority: 'normal',
        })
        .onConflictDoNothing({ target: notificationsOutbox.dedupeKey });
    }

    return NextResponse.json({ success: true, sharedWith: mates.length });
  } catch (err) {
    console.error('[wishlist/share] POST error:', err);
    return NextResponse.json({ error: 'No se pudo compartir la lista' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const groupId = new URL(req.url).searchParams.get('groupId') || '';
    if (!groupId) return NextResponse.json({ error: 'groupId requerido' }, { status: 400 });

    const [list] = await db.select({ id: wishlists.id }).from(wishlists).where(eq(wishlists.userId, caller.id)).limit(1);
    if (!list) return NextResponse.json({ success: true });

    await db
      .delete(wishlistShares)
      .where(and(eq(wishlistShares.wishlistId, list.id), eq(wishlistShares.groupId, groupId)));

    const remaining = await db.select({ id: wishlistShares.id }).from(wishlistShares).where(eq(wishlistShares.wishlistId, list.id));
    if (remaining.length === 0) {
      await db.update(wishlists).set({ visibility: 'PRIVATE', updatedAt: new Date() }).where(eq(wishlists.id, list.id));
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[wishlist/share] DELETE error:', err);
    return NextResponse.json({ error: 'No se pudo dejar de compartir' }, { status: 500 });
  }
}
