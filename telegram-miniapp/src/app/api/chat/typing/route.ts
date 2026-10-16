import { NextResponse } from 'next/server';
import { db } from '@/db';
import { conversations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { getOwnedBusinessIds, resolveConversationAccess, typingPatch } from '@/lib/chat';

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
    const access = resolveConversationAccess(conversation, caller.id, businessIds);
    if (!access) {
      return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
    }

    await db.update(conversations).set(typingPatch(access)).where(eq(conversations.id, conversationId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Chat typing error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
