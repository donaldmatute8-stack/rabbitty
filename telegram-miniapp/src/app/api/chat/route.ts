import { NextResponse } from 'next/server';
import { db } from '@/db';
import { conversations, messages, users, ownedBusinesses } from '@/db/schema';
import { eq, or, desc } from 'drizzle-orm';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    // Get all conversations where the user is a participant
    const userConversations = await db.query.conversations.findMany({
      where: or(
        eq(conversations.participant1, userId),
        eq(conversations.participant2, userId)
      ),
      with: {
        messages: {
          orderBy: [desc(messages.createdAt)],
          limit: 1,
        },
      },
      orderBy: [desc(conversations.updatedAt)],
    });

    // Enriquecer las conversaciones con los datos del otro participante
    const enrichedConversations = await Promise.all(userConversations.map(async (conv) => {
      const otherId = conv.participant1 === userId ? conv.participant2 : conv.participant1;
      
      let otherName = 'Usuario';
      let otherAvatar = null;
      let isBot = false;

      if (otherId === 'bot') {
        otherName = 'Rabbit Bot';
        isBot = true;
      } else {
        // Podría ser un usuario o un negocio
        // Primero intentamos buscarlo como negocio
        const business = await db.query.ownedBusinesses.findFirst({
          where: eq(ownedBusinesses.id, otherId)
        });

        if (business) {
          otherName = business.name;
          otherAvatar = business.logoUrl;
        } else {
          // Si no es negocio, es usuario
          const otherUser = await db.query.users.findFirst({
            where: eq(users.id, otherId)
          });
          if (otherUser) {
            otherName = otherUser.firstName || 'Usuario';
            otherAvatar = `https://api.dicebear.com/7.x/notionists/svg?seed=${otherName}&backgroundColor=E91E63`;
          }
        }
      }

      return {
        id: conv.id,
        targetId: otherId,
        targetName: otherName,
        targetAvatar: otherAvatar,
        isBot,
        lastMessage: conv.messages[0]?.content || '',
        lastMessageTime: conv.messages[0]?.createdAt || conv.updatedAt,
      };
    }));

    return NextResponse.json({ success: true, conversations: enrichedConversations });
  } catch (error) {
    console.error('Chat inbox error:', error);
    return NextResponse.json({ error: 'Error al obtener conversaciones' }, { status: 500 });
  }
}
