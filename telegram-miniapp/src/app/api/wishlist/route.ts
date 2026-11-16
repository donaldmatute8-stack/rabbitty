/**
 * ── Mi lista de deseos ──────────────────────────────────────────────────────
 *
 * GET  → la lista del usuario (ítems activos, compartidos y contadores).
 * POST → ajustes de la lista: título, visibilidad y cumpleaños.
 *
 * Una lista por usuario. Los deseos caducan a 90 días (se renuevan al
 * actualizarlos). Compartir es por grupo (la "madriguera" son los grupos).
 */

import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { wishlistItems, wishlistPledges, wishlistShares, wishlists } from '@/db/schema';
import { getAuthenticatedUser } from '@/lib/serverAuth';

export const runtime = 'nodejs';

async function ensureWishlist(userId: string) {
  const [existing] = await db.select().from(wishlists).where(eq(wishlists.userId, userId)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(wishlists).values({ userId }).returning();
  return created;
}

export async function GET(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const list = await ensureWishlist(caller.id);
    const items = await db
      .select()
      .from(wishlistItems)
      .where(eq(wishlistItems.wishlistId, list.id))
      .orderBy(desc(wishlistItems.createdAt));

    const shares = await db.select().from(wishlistShares).where(eq(wishlistShares.wishlistId, list.id));

    const pledgeCounts = items.length
      ? await db
          .select({ itemId: wishlistPledges.itemId, count: sql<number>`count(*)::int` })
          .from(wishlistPledges)
          .where(and(inArray(wishlistPledges.itemId, items.map((i) => i.id)), eq(wishlistPledges.status, 'PLEDGED')))
          .groupBy(wishlistPledges.itemId)
      : [];
    const countByItem = new Map(pledgeCounts.map((p) => [p.itemId, Number(p.count)]));

    return NextResponse.json({
      success: true,
      wishlist: list,
      items: items.map((i) => ({ ...i, pledges: countByItem.get(i.id) ?? 0 })),
      shares,
    });
  } catch (err) {
    console.error('[wishlist] GET error:', err);
    return NextResponse.json({ error: 'No se pudo cargar tu lista' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const body = await req.json().catch(() => null);
    const list = await ensureWishlist(caller.id);

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body?.title === 'string') patch.title = body.title.slice(0, 60);
    if (body?.visibility === 'PRIVATE' || body?.visibility === 'CIRCLE' || body?.visibility === 'LINK') {
      patch.visibility = body.visibility;
    }
    if (body?.birthdayAt === null) patch.birthdayAt = null;
    else if (typeof body?.birthdayAt === 'string' && body.birthdayAt) {
      const date = new Date(body.birthdayAt);
      if (!Number.isNaN(date.getTime())) patch.birthdayAt = date;
    }

    const [updated] = await db.update(wishlists).set(patch).where(eq(wishlists.id, list.id)).returning();
    return NextResponse.json({ success: true, wishlist: updated });
  } catch (err) {
    console.error('[wishlist] POST error:', err);
    return NextResponse.json({ error: 'No se pudo guardar la lista' }, { status: 500 });
  }
}
