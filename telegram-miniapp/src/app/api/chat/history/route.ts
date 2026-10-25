import { NextResponse } from 'next/server';
import { db } from '@/db';
import { conversations, messages, users, ownedBusinesses } from '@/db/schema';
import { and, eq, inArray, isNull, ne, or, asc } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { getOwnedBusinessIds, resolveConversationAccess, isBusinessOpen } from '@/lib/chat';

export async function GET(req: Request) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userId = caller.id;
    const targetId = searchParams.get('targetId');
    const conversationId = searchParams.get('conversationId');

    if (!targetId && !conversationId) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    const businessIds = await getOwnedBusinessIds(userId);
    const myIds = [userId, ...businessIds];

    let conversation = conversationId
      ? await db.query.conversations.findFirst({ where: eq(conversations.id, conversationId) })
      : undefined;

    if (!conversation && targetId) {
      conversation = await db.query.conversations.findFirst({
        where: or(
          and(inArray(conversations.participant1, myIds), eq(conversations.participant2, targetId)),
          and(eq(conversations.participant1, targetId), inArray(conversations.participant2, myIds)),
        ),
      });
    }

    let access = conversation ? resolveConversationAccess(conversation, userId, businessIds) : null;

    if (conversation && !access) {
      return NextResponse.json({ error: 'Sin acceso a esta conversación' }, { status: 403 });
    }

    let createdNow = false;
    if (!conversation) {
      if (!targetId) {
        return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 });
      }
      const [newConversation] = await db
        .insert(conversations)
        .values({ participant1: userId, participant2: targetId })
        .returning();
      conversation = newConversation;
      access = resolveConversationAccess(newConversation, userId, businessIds);
      createdNow = true;
    }

    if (!conversation || !access) {
      return NextResponse.json({ error: 'No se pudo resolver la conversación' }, { status: 500 });
    }

    const otherId = access.otherParticipantId;

    let targetName = 'Usuario';
    let targetAvatar: string | null = null;
    let businessOpen: boolean | null = null;
    let targetRole: 'BOT' | 'AFFILIATE' | 'RABBITTER' = 'RABBITTER';
    let targetUsername: string | null = null;
    let targetBio: string | null = null;
    let targetCategory: string | null = null;
    let targetBusinessId: string | null = null;

    if (otherId === 'bot') {
      targetName = 'Bunzy 🐰';
      targetRole = 'BOT';
      targetUsername = 'bunzy_concierge_bot';
      targetBio = 'Concierge oficial de Rabbitty. Asistente con IA para descubrir ofertas, reservar mesas y maximizar recompensas Bunz.';
    } else {
      const business = await db.query.ownedBusinesses.findFirst({
        where: or(eq(ownedBusinesses.id, otherId), eq(ownedBusinesses.slug, otherId)),
      });
      if (business) {
        targetName = business.name;
        targetRole = 'AFFILIATE';
        targetCategory = business.category || 'Negocio Afiliado';
        targetBusinessId = business.id;
        targetBio = business.description || `Comercio socio de Rabbitty en ${business.address || 'México'}. Recompensa hasta ${business.rewardPercentage || 0}% en Bunz.`;
        targetAvatar =
          business.logoUrl ||
          `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(business.name)}&backgroundColor=E91E63`;
        businessOpen = isBusinessOpen(business);
      } else {
        const otherUser = await db.query.users.findFirst({ where: eq(users.id, otherId) });
        if (otherUser) {
          targetName = `${otherUser.firstName || 'Explorador'} ${otherUser.lastName || ''}`.trim();
          targetUsername = otherUser.username || null;
          targetRole = otherUser.role === 'AFFILIATE' ? 'AFFILIATE' : 'RABBITTER';
          const userWithBio = otherUser as unknown as { bio?: string };
          targetBio = userWithBio.bio || (otherUser.role === 'AFFILIATE' ? 'Comercio y Embajador oficial de Rabbitty.' : 'Miembro activo y explorador de la comunidad Rabbitty.');
          const seed = otherUser.username || otherUser.firstName || otherUser.id;
          const bg = otherUser.role === 'AFFILIATE' ? 'FF8A00' : 'E91E63';
          targetAvatar = `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${bg}`;
        }
      }
    }

    if (targetId === 'bot' && createdNow) {
      await db.insert(messages).values({
        conversationId: conversation.id,
        senderId: 'bot',
        content:
          '¡Qué onda! Soy Bunzy 🐰, tu concierge oficial en Rabbitty. Dime qué se te antoja hoy o pregúntame cómo multiplicar tus bunz en los comercios de tu zona.',
      });
    }

    await db
      .update(messages)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(messages.conversationId, conversation.id),
          ne(messages.senderId, access.myParticipantId),
          isNull(messages.readAt),
        ),
      )
      .catch(() => {});

    const history = await db.query.messages.findMany({
      where: eq(messages.conversationId, conversation.id),
      orderBy: [asc(messages.createdAt)],
    });

    return NextResponse.json({
      success: true,
      conversationId: conversation.id,
      myParticipantId: access.myParticipantId,
      isBusinessInbox: access.isBusinessInbox,
      targetName,
      targetAvatar,
      targetRole,
      targetUsername,
      targetBio,
      targetCategory,
      targetBusinessId,
      businessOpen,
      otherTypingAt: conversation[access.otherTypingColumn],
      messages: history,
    });
  } catch (error) {
    console.error('Chat history error:', error);
    return NextResponse.json({ error: 'Error al obtener historial' }, { status: 500 });
  }
}
