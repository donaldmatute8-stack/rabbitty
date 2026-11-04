import { NextResponse } from 'next/server';
import { db } from '@/db';
import { conversations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { getOwnedBusinessIds, resolveAccessForConversation, typingPatch } from '@/lib/chat';
import { isRealtimePublishConfigured, publishTyping } from '@/lib/realtime/chatOutbox';

export async function POST(req: Request) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { conversationId } = await req.json();
    if (!conversationId) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
    });
    if (!conversation) {
      return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 });
    }

    const businessIds = await getOwnedBusinessIds(caller.id);
    const access = await resolveAccessForConversation(conversation, caller.id, businessIds);
    if (!access) {
      return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
    }

    // ── Typing por realtime: transient, SIN escritura en Postgres ──
    // (plan Fase 3.5: cero writes de typing cuando realtime está activo).
    if (isRealtimePublishConfigured()) {
      await publishTyping(conversation.id, caller.id);
      return NextResponse.json({ success: true, transport: 'realtime' });
    }

    // Fallback (canary / sin Centrifugo): columnas legacy.
    await db.update(conversations).set(typingPatch(access)).where(eq(conversations.id, conversationId));

    return NextResponse.json({ success: true, transport: 'db' });
  } catch (error) {
    console.error('Chat typing error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
