/**
 * ── Deseos (ítems) ──────────────────────────────────────────────────────────
 *
 * POST   → agrega un deseo (producto de un negocio o libre con monto).
 * DELETE → lo quita de mi lista (?id=).
 *
 * Caducidad: 90 días. Al volver a guardarlo, se renueva.
 */

import { NextRequest, NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { wishlistItems, wishlists } from '@/db/schema';
import { getAuthenticatedUser } from '@/lib/serverAuth';

export const runtime = 'nodejs';

const EXPIRY_DAYS = 90;
const MAX_ITEMS = 20;

async function ensureWishlist(userId: string) {
  const [existing] = await db.select({ id: wishlists.id }).from(wishlists).where(eq(wishlists.userId, userId)).limit(1);
  if (existing) return existing.id;
  const [created] = await db.insert(wishlists).values({ userId }).returning({ id: wishlists.id });
  return created.id;
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const body = await req.json().catch(() => null);
    const kind = body?.kind === 'CUSTOM' ? 'CUSTOM' : body?.kind === 'PRODUCT' ? 'PRODUCT' : null;
    const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 120) : '';
    if (!kind || !title) {
      return NextResponse.json({ error: 'kind y title son requeridos' }, { status: 400 });
    }

    const wishlistId = await ensureWishlist(caller.id);

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(wishlistItems)
      .where(and(eq(wishlistItems.wishlistId, wishlistId), eq(wishlistItems.status, 'ACTIVE')));
    if (Number(countRow?.count ?? 0) >= MAX_ITEMS) {
      return NextResponse.json({ error: `Máximo ${MAX_ITEMS} deseos activos` }, { status: 400 });
    }

    const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 86_400_000);

    const [created] = await db
      .insert(wishlistItems)
      .values({
        wishlistId,
        kind,
        businessId: typeof body?.businessId === 'string' && body.businessId ? body.businessId : null,
        menuItemId: typeof body?.menuItemId === 'string' && body.menuItemId ? body.menuItemId : null,
        title,
        imageUrl: typeof body?.imageUrl === 'string' && body.imageUrl ? body.imageUrl : null,
        priceSnapshot: typeof body?.priceSnapshot === 'number' && Number.isFinite(body.priceSnapshot) ? body.priceSnapshot : null,
        note: typeof body?.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 200) : null,
        expiresAt,
      })
      .returning();

    return NextResponse.json({ success: true, item: created });
  } catch (err) {
    console.error('[wishlist/items] POST error:', err);
    return NextResponse.json({ error: 'No se pudo agregar el deseo' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const id = new URL(req.url).searchParams.get('id') || '';
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

    const [list] = await db.select({ id: wishlists.id }).from(wishlists).where(eq(wishlists.userId, caller.id)).limit(1);
    if (!list) return NextResponse.json({ success: true });

    await db
      .delete(wishlistItems)
      .where(and(eq(wishlistItems.id, id), eq(wishlistItems.wishlistId, list.id)));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[wishlist/items] DELETE error:', err);
    return NextResponse.json({ error: 'No se pudo quitar el deseo' }, { status: 500 });
  }
}
