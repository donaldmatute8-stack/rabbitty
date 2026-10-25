import { NextResponse } from 'next/server';
import { db } from '@/db';
import { conversations, messages, users, ownedBusinesses } from '@/db/schema';
import { eq, or, desc, and, inArray, isNull, notInArray } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/serverAuth';

export async function GET(req: Request) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const userId = caller.id;

    const myBusinesses = await db.query.ownedBusinesses
      .findMany({ where: eq(ownedBusinesses.ownerId, userId) })
      .catch(() => [] as { id: string; name: string }[]);

    const myBusinessIds = myBusinesses.map((b) => b.id);

    const userConversations = await db.query.conversations.findMany({
      where: or(
        eq(conversations.participant1, userId),
        eq(conversations.participant2, userId),
        ...(myBusinessIds.length > 0
          ? [or(...myBusinessIds.map((bId) => or(eq(conversations.participant1, bId), eq(conversations.participant2, bId))))]
          : []),
      ),
      with: {
        messages: {
          orderBy: [desc(messages.createdAt)],
          limit: 1,
        },
      },
      orderBy: [desc(conversations.lastMessageAt)],
    });

    const conversationIds = userConversations.map((c) => c.id);

    const unreadRows = conversationIds.length
      ? await db
          .select({ conversationId: messages.conversationId, senderId: messages.senderId })
          .from(messages)
          .where(
            and(
              inArray(messages.conversationId, conversationIds),
              isNull(messages.readAt),
              notInArray(messages.senderId, [caller.id, ...myBusinessIds]),
            ),
          )
          .catch(() => [] as { conversationId: string; senderId: string }[])
      : [];

    const unreadByConversation = new Map<string, number>();
    for (const row of unreadRows) {
      unreadByConversation.set(row.conversationId, (unreadByConversation.get(row.conversationId) || 0) + 1);
    }

    const enrichedConversations = await Promise.all(
      userConversations.map(async (conv) => {
        const isBusinessContext =
          myBusinessIds.includes(conv.participant1) || myBusinessIds.includes(conv.participant2);

        let otherId = conv.participant1 === caller.id ? conv.participant2 : conv.participant1;
        let myActingBusinessName: string | null = null;

        if (isBusinessContext) {
          if (myBusinessIds.includes(conv.participant1)) {
            otherId = conv.participant2;
            myActingBusinessName = myBusinesses.find((b) => b.id === conv.participant1)?.name || 'Mi Negocio';
          } else {
            otherId = conv.participant1;
            myActingBusinessName = myBusinesses.find((b) => b.id === conv.participant2)?.name || 'Mi Negocio';
          }
        }

        let otherName = 'Usuario';
        let otherAvatar: string | null = null;
        let isBot = false;

        if (otherId === 'bot') {
          otherName = 'Bunzy 🐰';
          isBot = true;
        } else {
          const business = await db.query.ownedBusinesses.findFirst({
            where: or(eq(ownedBusinesses.id, otherId), eq(ownedBusinesses.slug, otherId)),
          });
          if (business) {
            otherName = business.name;
            otherAvatar =
              business.logoUrl ||
              `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(business.name)}&backgroundColor=E91E63`;
          } else {
            const otherUser = await db.query.users.findFirst({ where: eq(users.id, otherId) });
            if (otherUser) {
              otherName = `${otherUser.firstName || 'Explorador'} ${otherUser.lastName || ''}`.trim();
              const seed = otherUser.username || otherUser.firstName || otherUser.id;
              const bg = otherUser.role === 'AFFILIATE' ? 'FF8A00' : 'E91E63';
              otherAvatar = `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${bg}`;
            }
          }
        }

        const last = conv.messages[0];

        return {
          id: conv.id,
          targetId: otherId,
          targetName: otherName,
          targetAvatar: otherAvatar,
          isBot,
          isBusinessInbox: isBusinessContext,
          businessName: myActingBusinessName,
          lastMessage: last?.content || '',
          lastMessageTime: last?.createdAt || conv.lastMessageAt || conv.updatedAt,
          lastMessageType: last?.type || 'TEXT',
          unreadCount: unreadByConversation.get(conv.id) || 0,
        };
      }),
    );

    const totalUnread = enrichedConversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

    const hasBot = enrichedConversations.some((c) => c.isBot);
    const finalConversations = hasBot
      ? enrichedConversations
      : [
          {
            id: 'bunzy-initial',
            targetId: 'bot',
            targetName: 'Bunzy 🐰',
            targetAvatar: null,
            isBot: true,
            isBusinessInbox: false,
            businessName: null,
            lastMessage: '¡Qué onda! Soy Bunzy, tu concierge de Rabbitty. ¿Qué spot o recompensa buscas hoy?',
            lastMessageTime: new Date().toISOString(),
            lastMessageType: 'TEXT',
            unreadCount: 0,
          },
          ...enrichedConversations,
        ];

    return NextResponse.json({ success: true, conversations: finalConversations, totalUnread });
  } catch (error) {
    console.error('Chat inbox error:', error);
    return NextResponse.json({ error: 'Error al obtener conversaciones' }, { status: 500 });
  }
}
