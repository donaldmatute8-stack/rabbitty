import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { conversations } from '@/db/schema';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { getOwnedBusinessIds, resolveConversationAccess } from '@/lib/chat';
import {
  conversationChannel,
  createConnectionToken,
  createSubscriptionToken,
  getRealtimeConfig,
  isPocChannelAllowed,
} from '@/lib/realtime/centrifugo';

export const runtime = 'nodejs';

/**
 * ── POST /api/realtime/centrifugo ──
 * Emite el token de CONEXIÓN y, si aplica, el de SUSCRIPCIÓN a UN canal.
 *
 * Regla: el token de suscripción solo se firma después de verificar que el
 * usuario pertenece a esa conversación. El cliente nunca puede publicar
 * (verificado en la PoC: publish devuelve 103).
 *
 * Body: { conversationId } | { channel } (este último solo con REALTIME_POC_ENABLED=1)
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
    }

    const cfg = getRealtimeConfig();
    if (!cfg.enabled) {
      // Sin transporte realtime: el cliente sigue con polling (degradación limpia).
      return NextResponse.json({ success: false, enabled: false, reason: 'REALTIME_NOT_CONFIGURED' });
    }

    const body = (await req.json().catch(() => null)) as
      | { conversationId?: string; channel?: string }
      | null;

    const token = createConnectionToken(caller.id);
    if (!token) {
      return NextResponse.json({ success: false, enabled: false, reason: 'TOKEN_SIGNING_FAILED' }, { status: 503 });
    }

    let channel: string | null = null;
    let subscriptionToken: string | null = null;

    // 1) Canal de demo de la PoC (gateado por env; jamás en producción).
    if (body?.channel && isPocChannelAllowed(body.channel)) {
      channel = body.channel;
      subscriptionToken = createSubscriptionToken(caller.id, channel);
    }

    // 2) Canal real de conversación: exige pertenencia verificada.
    if (!channel && body?.conversationId) {
      const [conv] = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, body.conversationId))
        .limit(1);
      if (!conv) {
        return NextResponse.json({ success: false, error: 'Conversación no encontrada' }, { status: 404 });
      }
      const businessIds = await getOwnedBusinessIds(caller.id);
      const access = resolveConversationAccess(conv, caller.id, businessIds);
      if (!access) {
        return NextResponse.json({ success: false, error: 'Sin acceso a esta conversación' }, { status: 403 });
      }
      channel = conversationChannel(conv.id);
      subscriptionToken = createSubscriptionToken(caller.id, channel);
    }

    return NextResponse.json({
      success: true,
      enabled: true,
      wsUrl: cfg.wsUrl,
      token,
      channel,
      subscriptionToken,
      expiresInSeconds: 600,
    });
  } catch (error) {
    console.error('[REALTIME CENTRIFUGO TOKEN]', error);
    return NextResponse.json({ success: false, error: 'No se pudo emitir el token' }, { status: 500 });
  }
}
