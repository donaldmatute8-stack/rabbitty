/**
 * ── "Me apunto a regalar" ───────────────────────────────────────────────────
 *
 * POST   { itemId, message? } → el giver se compromete (sin pago todavía).
 * DELETE ?itemId=             → cancela su apunte.
 *
 * Fase 1 del regalo: compromiso social. El pago (vale prepagado) llega en la
 * siguiente fase, reutilizando el motor de canje de membresías.
 */

import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/db';
import {
  conversationMembers,
  notificationsOutbox,
  users,
  wishlistItems,
  wishlistPledges,
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
    const itemId = typeof body?.itemId === 'string' ? body.itemId.trim() : '';
    const message = typeof body?.message === 'string' ? body.message.trim().slice(0, 160) : '';
    if (!itemId) return NextResponse.json({ error: 'itemId requerido' }, { status: 400 });

    const [row] = await db
      .select({
        item: wishlistItems,
        list: wishlists,
      })
      .from(wishlistItems)
      .innerJoin(wishlists, eq(wishlists.id, wishlistItems.wishlistId))
      .where(eq(wishlistItems.id, itemId))
      .limit(1);

    if (!row) return NextResponse.json({ error: 'Deseo no encontrado' }, { status: 404 });
    if (row.list.userId === caller.id) {
      return NextResponse.json({ error: 'No puedes regalarte a ti mismo' }, { status: 400 });
    }

    // Debe estar compartido con un grupo al que pertenezco
    const shares = await db
      .select({ groupId: wishlistShares.groupId })
      .from(wishlistShares)
      .where(eq(wishlistShares.wishlistId, row.list.id));

    const groupIds = shares.map((s) => s.groupId);
    let allowed = false;
    if (groupIds.length > 0) {
      const [member] = await db
        .select({ id: conversationMembers.id })
        .from(conversationMembers)
        .where(
          and(
            inArray(conversationMembers.conversationId, groupIds),
            eq(conversationMembers.userId, caller.id),
            isNull(conversationMembers.leftAt),
          ),
        )
        .limit(1);
      allowed = Boolean(member);
    }
    if (!allowed) {
      return NextResponse.json({ error: 'Ese deseo no está compartido contigo' }, { status: 403 });
    }

    await db
      .insert(wishlistPledges)
      .values({ itemId, giverId: caller.id, message: message || null })
      .onConflictDoUpdate({
        target: [wishlistPledges.itemId, wishlistPledges.giverId],
        set: { status: 'PLEDGED', message: message || null, updatedAt: new Date() },
      });

    const [me] = await db
      .select({ firstName: users.firstName, username: users.username })
      .from(users)
      .where(eq(users.id, caller.id))
      .limit(1);
    const myName = me?.firstName || me?.username || 'Alguien de tu madriguera';

    await db
      .insert(notificationsOutbox)
      .values({
        userId: row.list.userId,
        type: 'WISHLIST_PLEDGED',
        title: `${myName} quiere regalarte algo`,
        message: message
          ? `Se apuntó a "${row.item.title}": “${message}”`
          : `Se apuntó a regalarte "${row.item.title}".`,
        route: '/profile/wishlist',
        data: { itemId, giverId: caller.id },
        dedupeKey: `wishlist_pledge:${itemId}:${caller.id}`,
        priority: 'normal',
      })
      .onConflictDoNothing({ target: notificationsOutbox.dedupeKey });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[wishlist/pledge] POST error:', err);
    return NextResponse.json({ error: 'No se pudo registrar tu apunte' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const itemId = new URL(req.url).searchParams.get('itemId') || '';
    if (!itemId) return NextResponse.json({ error: 'itemId requerido' }, { status: 400 });

    await db
      .update(wishlistPledges)
      .set({ status: 'CANCELLED', updatedAt: new Date() })
      .where(and(eq(wishlistPledges.itemId, itemId), eq(wishlistPledges.giverId, caller.id)));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[wishlist/pledge] DELETE error:', err);
    return NextResponse.json({ error: 'No se pudo cancelar tu apunte' }, { status: 500 });
  }
}
