/**
 * ── Heartbeat de app en primer plano ────────────────────────────────────────
 *
 * El cliente lo llama al abrir y cada minuto mientras la app está visible.
 * El worker lo usa para no mandar el banner nativo cuando la notificación ya
 * se está mostrando in-app (evita el "doble aviso").
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { getAuthenticatedUser } from '@/lib/serverAuth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    await db.update(users).set({ lastActiveAt: new Date() }).where(eq(users.id, caller.id));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[presence/heartbeat] error:', err);
    return NextResponse.json({ error: 'No se pudo registrar actividad' }, { status: 500 });
  }
}
