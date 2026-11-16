/**
 * ── La madriguera: deseos que mis grupos pueden ver ─────────────────────────
 *
 * GET → deseos activos de listas compartidas con alguno de mis grupos.
 * Solo listas compartidas explícitamente y con visibilidad CIRCLE.
 * El negocio nunca ve esta información.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { getAuthenticatedUser } from '@/lib/serverAuth';

export const runtime = 'nodejs';

interface CircleRow {
  id: string;
  title: string;
  imageUrl: string | null;
  priceSnapshot: number | null;
  note: string | null;
  kind: string;
  businessId: string | null;
  ownerId: string;
  ownerName: string | null;
  groupId: string;
  pledges: number;
  iPledged: boolean;
}

export async function GET(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const result = await db.execute(sql`
      SELECT wi."id", wi."title", wi."imageUrl", wi."priceSnapshot", wi."note", wi."kind", wi."businessId",
             w."userId" AS "ownerId",
             COALESCE(u."firstName", u."username", 'Rabbitter') AS "ownerName",
             s."groupId" AS "groupId",
             (SELECT count(*)::int FROM "wishlist_pledges" p WHERE p."itemId" = wi."id" AND p."status" = 'PLEDGED') AS "pledges",
             EXISTS (
               SELECT 1 FROM "wishlist_pledges" p2
               WHERE p2."itemId" = wi."id" AND p2."giverId" = ${caller.id} AND p2."status" = 'PLEDGED'
             ) AS "iPledged"
      FROM "wishlist_items" wi
      JOIN "wishlists" w ON w."id" = wi."wishlistId"
      JOIN "wishlist_shares" s ON s."wishlistId" = w."id"
      JOIN "conversation_members" cm
        ON cm."conversationId" = s."groupId" AND cm."userId" = ${caller.id} AND cm."leftAt" IS NULL
      JOIN "users" u ON u."id" = w."userId"
      WHERE wi."status" = 'ACTIVE'
        AND w."isActive" = true
        AND w."userId" <> ${caller.id}
      ORDER BY wi."createdAt" DESC
      LIMIT 100
    `);

    const rows = ((result as unknown as { rows?: CircleRow[] }).rows ?? (result as unknown as CircleRow[])) || [];
    return NextResponse.json({ success: true, items: rows });
  } catch (err) {
    console.error('[wishlist/circle] error:', err);
    return NextResponse.json({ error: 'No se pudo cargar la madriguera' }, { status: 500 });
  }
}
