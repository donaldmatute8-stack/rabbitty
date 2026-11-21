import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { userBlocks } from '@/db/schema';
import { getAuthenticatedUser } from '@/lib/serverAuth';

export const runtime = 'nodejs';

/**
 * ── Bloqueo persistente entre usuarios (App Store 1.2 · UGC) ───────────────
 *
 * GET  → IDs que yo bloqueé.
 * POST { userId, blocked } → bloquea/desbloquea. El envío de mensajes se
 * rechaza en `/api/chat/send` cuando cualquiera de las dos partes bloqueó.
 */

export async function GET(req: NextRequest) {
  const caller = await getAuthenticatedUser(req);
  if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const rows = await db
    .select({ blockedId: userBlocks.blockedId })
    .from(userBlocks)
    .where(eq(userBlocks.blockerId, caller.id));

  return NextResponse.json({ success: true, blockedIds: rows.map((r) => r.blockedId) });
}

export async function POST(req: NextRequest) {
  const caller = await getAuthenticatedUser(req);
  if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const userId = String(body?.userId || '').trim();
  const blocked = Boolean(body?.blocked);

  if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 });
  if (userId === caller.id) return NextResponse.json({ error: 'No puedes bloquearte a ti mismo' }, { status: 400 });

  if (blocked) {
    await db
      .insert(userBlocks)
      .values({ blockerId: caller.id, blockedId: userId })
      .onConflictDoNothing();
  } else {
    await db
      .delete(userBlocks)
      .where(and(eq(userBlocks.blockerId, caller.id), eq(userBlocks.blockedId, userId)));
  }

  return NextResponse.json({ success: true, blocked });
}
