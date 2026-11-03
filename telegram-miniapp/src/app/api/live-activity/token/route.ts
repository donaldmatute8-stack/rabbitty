import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { liveActivityTokens } from '@/db/schema';
import { getAuthenticatedUser } from '@/lib/serverAuth';

export const runtime = 'nodejs';

/**
 * ── POST /api/live-activity/token ──
 * El plugin nativo emite el token de push de CADA Live Activity (no es el
 * device token). Aquí se guarda ligado al pedido para que el servidor pueda
 * refrescar la etapa aunque la app esté suspendida.
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });

    const body = await req.json().catch(() => null) as
      | { orderId?: string; token?: string; platform?: string }
      | null;
    const orderId = body?.orderId?.trim();
    const token = body?.token?.trim();
    if (!orderId || !token) {
      return NextResponse.json({ success: false, error: 'orderId y token requeridos' }, { status: 400 });
    }

    await db
      .insert(liveActivityTokens)
      .values({
        userId: caller.id,
        orderId,
        token,
        platform: body?.platform === 'android' ? 'android' : 'ios',
      })
      .onConflictDoUpdate({
        target: liveActivityTokens.token,
        set: { userId: caller.id, orderId, updatedAt: new Date() },
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[LIVE ACTIVITY TOKEN]', error);
    return NextResponse.json({ success: false, error: 'No se pudo guardar el token' }, { status: 500 });
  }
}
