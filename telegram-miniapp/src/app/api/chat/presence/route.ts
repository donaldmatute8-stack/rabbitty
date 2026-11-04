import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { conversations } from '@/db/schema';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { getOwnedBusinessIds, resolveAccessForConversation } from '@/lib/chat';
import { closeConnection, getPresenceForUsers, touchConnection } from '@/lib/realtime/presence';

export const runtime = 'nodejs';

/**
 * ── POST /api/chat/presence ── heartbeat de la sesión + presencia del otro.
 *
 * "En línea" = tiene la app conectada (NO GPS, NO estar en el local). La
 * presencia es agregada por sesiones: iPhone + iPad mantienen online al usuario
 * aunque uno se caiga; el TTL cubre la desconexión abrupta.
 *
 * Body: { conversationId, sessionId, platform? }
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as
      | { conversationId?: string; sessionId?: string; platform?: string }
      | null;

    const conversationId = body?.conversationId?.trim();
    const sessionId = body?.sessionId?.trim();
    if (!conversationId || !sessionId) {
      return NextResponse.json({ success: false, error: 'conversationId y sessionId requeridos' }, { status: 400 });
    }

    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);
    if (!conversation) {
      return NextResponse.json({ success: false, error: 'Conversación no encontrada' }, { status: 404 });
    }

    const businessIds = await getOwnedBusinessIds(caller.id);
    const access = await resolveAccessForConversation(conversation, caller.id, businessIds);
    if (!access) {
      return NextResponse.json({ success: false, error: 'Sin acceso' }, { status: 403 });
    }

    await touchConnection(caller.id, sessionId, body?.platform ?? null);

    const peerId = access.otherParticipantId;
    const presence = await getPresenceForUsers([peerId]);
    const peer = presence.get(peerId) ?? { online: false, lastSeenAt: null };

    return NextResponse.json({
      success: true,
      peer: {
        userId: peerId,
        online: peer.online,
        lastSeenAt: peer.lastSeenAt,
      },
    });
  } catch (error) {
    console.error('[CHAT PRESENCE POST]', error);
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
  }
}

/**
 * ── DELETE /api/chat/presence ── cierre limpio de la sesión.
 * Body: { sessionId }
 */
export async function DELETE(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
    }
    const body = (await req.json().catch(() => null)) as { sessionId?: string } | null;
    const sessionId = body?.sessionId?.trim();
    if (!sessionId) {
      return NextResponse.json({ success: false, error: 'sessionId requerido' }, { status: 400 });
    }
    await closeConnection(caller.id, sessionId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[CHAT PRESENCE DELETE]', error);
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
  }
}
