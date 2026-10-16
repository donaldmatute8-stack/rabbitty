import { NextResponse } from 'next/server';
import { db } from '@/db';
import { conversations, messages } from '@/db/schema';
import { and, eq, inArray, isNull, ne, or } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { getOwnedBusinessIds } from '@/lib/chat';

export async function GET(req: Request) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const userId = caller.id;
    const businessIds = await getOwnedBusinessIds(userId);
    const myIds = [userId, ...businessIds];

    const myConversations = await db.query.conversations.findMany({
      where: or(
        inArray(conversations.participant1, myIds),
        inArray(conversations.participant2, myIds),
      ),
      columns: { id: true, participant1: true, participant2: true },
    }).catch(() => [] as { id: string; participant1: string; participant2: string }[]);

    if (myConversations.length === 0) {
      return NextResponse.json({ success: true, total: 0 });
    }

    let total = 0;
    for (const conv of myConversations) {
      const myParticipantId = myIds.includes(conv.participant1) ? conv.participant1 : conv.participant2;
      const rows = await db
        .select({ id: messages.id })
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conv.id),
            ne(messages.senderId, myParticipantId),
            isNull(messages.readAt),
          ),
        );
      total += rows.length;
    }

    return NextResponse.json({ success: true, total });
  } catch (error) {
    console.error('Chat unread error:', error);
    return NextResponse.json({ error: 'Error al contar no leídos' }, { status: 500 });
  }
}
