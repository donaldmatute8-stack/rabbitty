import { NextResponse } from 'next/server';
import { db } from '@/db';
import { messageReactions, messageHides } from '@/db/schema';
import { conversations, messages, users, ownedBusinesses } from '@/db/schema';
import { and, eq, inArray, isNull, ne, or, asc, desc, sql, type SQL } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { getOwnedBusinessIds, resolveConversationAccess, isBusinessOpen } from '@/lib/chat';
import { decodeChatCursor, encodeChatCursor } from '@/lib/chatCursor';

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

    // H-FASE0 · regla §9 del plan: GET no muta estado. La marca de lectura
    // (readAt del otro + badge de notificaciones) es COMANDO explícito —
    // vive en POST /api/chat/mark-read y el cliente la llama al confirmar
    // visibilidad. Antar: una precarga o un retry ya no "lee" por el usuario.

    // H-FASE0 · paginación por cursor compuesto + delta:
    //  - SIN `after` (carga inicial): LAS ÚLTIMAS 50 (`before` para cargar
    //    más antiguos), ordenadas asc para pintar.
    //  - CON `after`: solo los mensajes nuevos desde el cursor confirmado
    //    (delta del interval — ya no re-descarga toda la conversación cada 4s).
    // History enriquecido con flag de cxc.
    const cursorRaw = searchParams.get('after');
    const beforeRaw = searchParams.get('before');
    const LIMIT = 50;

    const cursor = decodeChatCursor(cursorRaw);
    const before = decodeChatCursor(beforeRaw);

    const where: SQL | undefined = cursor || before
      ? and(
          eq(messages.conversationId, conversation.id),
          cursor
            ? (sql`("createdAt" > ${cursor.createdAt}) OR ("createdAt" = ${cursor.createdAt} AND "id" > ${cursor.id})`) as SQL
            : (sql`("createdAt" < ${before!.createdAt}) OR ("createdAt" = ${before!.createdAt} AND "id" < ${before!.id})`) as SQL,
        )
      : eq(messages.conversationId, conversation.id);

    let history;
    let hasMore = false;
    if (cursor) {
      // Delta: los nuevos desde el cursor confirmado (asc para pintar).
      history = await db.query.messages.findMany({
        where: where as never,
        orderBy: [asc(messages.createdAt)],
        limit: LIMIT + 1,
      });
      hasMore = false; // el delta no pagina infinito hacia atrás
    } else {
      // Inicial / carga de antiguos: últimos (o previos a `before`), limit+1
      // para saber si hay más; se pintan asc.
      const rows = await db.query.messages.findMany({
        where: where as never,
        orderBy: [desc(messages.createdAt)],
        limit: LIMIT + 1,
      });
      hasMore = rows.length > LIMIT;
      history = rows.slice(0, LIMIT).reverse();
    }

    // ── "Eliminar para mí": esos mensajes no existen para este usuario ──
    try {
      const idsForHides = history.map((m) => m.id);
      if (idsForHides.length > 0) {
        const hideRows = await db
          .select({ messageId: messageHides.messageId })
          .from(messageHides)
          .where(and(inArray(messageHides.messageId, idsForHides), eq(messageHides.userId, access.myParticipantId)));
        if (hideRows.length > 0) {
          const hidden = new Set(hideRows.map((r) => r.messageId));
          history = history.filter((m) => !hidden.has(m.id));
        }
      }
    } catch { /* si falla, se muestran (mejor que perder mensajes) */ }

    const latestMessage = history.length > 0 ? history[history.length - 1] : null;
    const nextCursor = latestMessage
      ? encodeChatCursor({
          createdAt: (latestMessage.createdAt instanceof Date
            ? latestMessage.createdAt.toISOString()
            : String(latestMessage.createdAt)),
          id: latestMessage.id,
        })
      : null;

    // H21: 'online' real — presenceSession abierta del par con ping vivo (≤5 min)
    let partnerOnline: boolean | null = null;
    if (otherId && otherId !== 'bot') {
      try {
        const { presenceSessions } = await import('@/db/schema');
        const openRow = await db.query.presenceSessions.findFirst({
          where: and(eq(presenceSessions.userId, otherId), isNull(presenceSessions.endedAt)),
        });
        partnerOnline = Boolean(openRow && (Date.now() - new Date(openRow.lastPingAt).getTime()) <= 5 * 60 * 1000);
      } catch { partnerOnline = null; }
    }

    // ── Reacciones + borrado "para todos" ──
    const ids = history.map((m) => m.id);
    const reactionsByMsg = new Map<string, Array<{ emoji: string; count: number; mine: boolean }>>();
    if (ids.length > 0) {
      try {
        const rows = await db
          .select({ messageId: messageReactions.messageId, emoji: messageReactions.emoji, userId: messageReactions.userId })
          .from(messageReactions)
          .where(inArray(messageReactions.messageId, ids));
        const acc = new Map<string, Map<string, { count: number; mine: boolean }>>();
        for (const r of rows) {
          const perMsg = acc.get(r.messageId) ?? new Map();
          const cur = perMsg.get(r.emoji) ?? { count: 0, mine: false };
          cur.count += 1;
          if (r.userId === access.myParticipantId) cur.mine = true;
          perMsg.set(r.emoji, cur);
          acc.set(r.messageId, perMsg);
        }
        for (const [msgId, perMsg] of acc) {
          reactionsByMsg.set(msgId, Array.from(perMsg.entries()).map(([emoji, v]) => ({ emoji, count: v.count, mine: v.mine })));
        }
      } catch { /* sin reacciones */ }
    }

    // Un mensaje borrado "para todos" no expone contenido ni metadata.
    const messagesOut = history.map((m) => ({
      ...m,
      content: m.deletedForAll ? '' : m.content,
      type: m.deletedForAll ? 'DELETED' : m.type,
      metadata: m.deletedForAll ? null : m.metadata,
      reactions: reactionsByMsg.get(m.id) ?? [],
    }));

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
      partnerOnline,
      otherTypingAt: conversation[access.otherTypingColumn],
      messages: messagesOut,
      // H-FASE0: contratos de la paginación/delta
      hasMore,
      nextCursor,
    });
  } catch (error) {
    console.error('Chat history error:', error);
    return NextResponse.json({ error: 'Error al obtener historial' }, { status: 500 });
  }
}
