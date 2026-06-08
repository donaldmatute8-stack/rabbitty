import { NextResponse } from 'next/server';
import { db } from '@/db';
import { conversations, messages } from '@/db/schema';
import { and, eq, or, asc } from 'drizzle-orm';
import { users, ownedBusinesses } from '@/db/schema';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const targetId = searchParams.get('targetId');

    if (!userId || !targetId) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    let targetName = 'Usuario';
    let targetAvatar = null;

    if (targetId === 'bot') {
      targetName = 'Rabbit Bot';
    } else {
      const business = await db.query.ownedBusinesses.findFirst({
        where: eq(ownedBusinesses.id, targetId)
      });
      if (business) {
        targetName = business.name;
        targetAvatar = business.logoUrl;
      } else {
        const otherUser = await db.query.users.findFirst({
          where: eq(users.id, targetId)
        });
        if (otherUser) {
          targetName = otherUser.firstName || 'Usuario';
          targetAvatar = `https://api.dicebear.com/7.x/notionists/svg?seed=${targetName}&backgroundColor=E91E63`;
        }
      }
    }

    // Find the conversation between these two
    let conversation = await db.query.conversations.findFirst({
      where: or(
        and(eq(conversations.participant1, userId), eq(conversations.participant2, targetId)),
        and(eq(conversations.participant1, targetId), eq(conversations.participant2, userId))
      ),
      with: {
        messages: {
          orderBy: [asc(messages.createdAt)],
        },
      },
    });

    if (!conversation) {
      // Create empty conversation if it doesn't exist yet
      const [newConversation] = await db.insert(conversations).values({
        participant1: userId,
        participant2: targetId,
      }).returning();
      
      let initialMessages: any[] = [];
      
      // If target is bot, optionally add an initial greeting
      if (targetId === 'bot') {
        const [greeting] = await db.insert(messages).values({
          conversationId: newConversation.id,
          senderId: 'bot',
          content: '¡Hola! Soy Rabbit Bot 🐰. ¿En qué te puedo ayudar hoy?'
        }).returning();
        initialMessages = [greeting];
      }

      return NextResponse.json({ success: true, conversationId: newConversation.id, messages: initialMessages, targetName, targetAvatar });
    }

    return NextResponse.json({ success: true, conversationId: conversation.id, messages: conversation.messages, targetName, targetAvatar });
  } catch (error) {
    console.error('Chat history error:', error);
    return NextResponse.json({ error: 'Error al obtener historial' }, { status: 500 });
  }
}
