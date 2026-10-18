import { NextResponse } from 'next/server';
import { db } from '@/db';
import { messages, conversations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { getOwnedBusinessIds, resolveConversationAccess, resolveTelegramRecipient } from '@/lib/chat';
import { generateBunzyAssist } from '@/lib/bunzy';

export async function POST(req: Request) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = (await req.json()) as {
      conversationId?: string;
      mode?: 'draft' | 'summarize';
      intent?: string;
    };

    if (!body.conversationId) {
      return NextResponse.json({ error: 'Falta conversationId' }, { status: 400 });
    }

    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.id, body.conversationId),
    });
    if (!conversation) {
      return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 });
    }

    const businessIds = await getOwnedBusinessIds(caller.id);
    const access = resolveConversationAccess(conversation, caller.id, businessIds);
    if (!access) {
      return NextResponse.json({ error: 'Sin acceso a esta conversación' }, { status: 403 });
    }

    const rows = await db.query.messages
      .findMany({
        where: eq(messages.conversationId, conversation.id),
        orderBy: (messages, { asc }) => [asc(messages.createdAt)],
        limit: 20,
      })
      .catch(() => []);

    const other = await resolveTelegramRecipient(access.otherParticipantId).catch(() => null);

    const text = await generateBunzyAssist({
      mode: body.mode === 'summarize' ? 'summarize' : 'draft',
      intent: body.intent,
      otherName: other?.displayName,
      messages: rows
        .filter((m) => m.type !== 'AUTO_REPLY')
        .map((m) => ({ fromMe: m.senderId === access.myParticipantId, content: m.content })),
    });

    return NextResponse.json({ success: true, text });
  } catch (error) {
    console.error('Bunzy assist error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
