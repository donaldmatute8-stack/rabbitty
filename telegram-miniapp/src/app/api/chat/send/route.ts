import { NextResponse } from 'next/server';
import { db } from '@/db';
import { messages, conversations, ownedBusinesses } from '@/db/schema';
import { and, desc, eq, gte } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import {
  getOwnedBusinessIds,
  resolveConversationAccess,
  resolveTelegramRecipient,
  notifyChatRecipient,
  isBusinessOpen,
  formatBusinessHours,
} from '@/lib/chat';
import { generateBunzyReply } from '@/lib/bunzy';

const AUTO_REPLY_WINDOW_MS = 6 * 60 * 60 * 1000;

export async function POST(req: Request) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const rawBody = await req.text();
    if (rawBody.length > 3_000_000) {
      return NextResponse.json({ error: 'Payload demasiado grande' }, { status: 413 });
    }
    const body = JSON.parse(rawBody) as {
      conversationId?: string;
      targetId?: string;
      content?: string;
      type?: string;
      lat?: number | null;
      lng?: number | null;
      metadata?: Record<string, unknown> | null;
    };

    const content = (body.content || '').trim();
    if (!body.conversationId || !content) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
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

    const senderId = access.myParticipantId;
    const otherId = access.otherParticipantId;
    const now = new Date();

    const hasCoords = typeof body.lat === 'number' && typeof body.lng === 'number';
    const isLocation = body.type === 'LOCATION' && hasCoords;

    const [userMessage] = await db
      .insert(messages)
      .values({
        conversationId: conversation.id,
        senderId,
        content,
        type: isLocation ? 'LOCATION' : (body.type === 'VOICE' ? 'VOICE' : 'TEXT'),
        metadata: isLocation
          ? { kind: 'LOCATION', lat: body.lat, lng: body.lng }
          : (body.metadata && typeof body.metadata === 'object' ? body.metadata : null),
      })
      .returning();

    await db
      .update(conversations)
      .set({ lastMessageAt: now, updatedAt: now })
      .where(eq(conversations.id, conversation.id))
      .catch(() => {});

    if (otherId === 'bot') {
      const reply = await generateBunzyReply({
        userId: caller.id,
        conversationId: conversation.id,
        content: isLocation ? 'usar mi ubicación' : content,
        lat: body.lat ?? null,
        lng: body.lng ?? null,
      });

      const botMetadata = reply.metadata
        ? { kind: 'BUSINESS', ...reply.metadata }
        : reply.options?.length
          ? { kind: 'OPTIONS', options: reply.options }
          : reply.orderDraft
            ? { kind: 'ORDER', orderDraft: reply.orderDraft }
            : reply.transferRequest
              ? { kind: 'TRANSFER_REQUEST', transferRequest: reply.transferRequest }
              : reply.receiveQr
                ? { kind: 'RECEIVE_QR', receiveQr: reply.receiveQr }
                : null;

      const [botMessage] = await db
        .insert(messages)
        .values({
          conversationId: conversation.id,
          senderId: 'bot',
          content: reply.content,
          type: reply.type,
          metadata: botMetadata,
        })
        .returning();

      await db
        .update(conversations)
        .set({ lastMessageAt: new Date(), updatedAt: new Date() })
        .where(eq(conversations.id, conversation.id))
        .catch(() => {});

      return NextResponse.json({
        success: true,
        message: userMessage,
        botResponse: botMessage,
        suggestions: reply.suggestions,
        options: reply.options ?? [],
        orderDraft: reply.orderDraft ?? null,
        transferRequest: reply.transferRequest ?? null,
        receiveQr: reply.receiveQr ?? null,
      });
    }

    const senderName = (await resolveTelegramRecipient(senderId)).displayName;
    const recipient = await resolveTelegramRecipient(otherId);

    let autoReply: typeof messages.$inferSelect | null = null;

    const otherBusiness = await db.query.ownedBusinesses
      .findFirst({ where: eq(ownedBusinesses.id, otherId) })
      .catch(() => undefined);

    if (otherBusiness && !access.isBusinessInbox && !isBusinessOpen(otherBusiness)) {
      const recentAutoReply = await db.query.messages
        .findFirst({
          where: and(
            eq(messages.conversationId, conversation.id),
            eq(messages.type, 'AUTO_REPLY'),
            gte(messages.createdAt, new Date(now.getTime() - AUTO_REPLY_WINDOW_MS)),
          ),
          orderBy: [desc(messages.createdAt)],
        })
        .catch(() => undefined);

      if (!recentAutoReply) {
        const autoContent =
          `¡Gracias por escribir a ${otherBusiness.name}! 🐰 En este momento estamos fuera de horario ` +
          `(${formatBusinessHours(otherBusiness)}). Te responderemos en cuanto abramos. Mientras tanto, ` +
          `puedes explorar sus recompensas en Rabbitty.`;
        const [inserted] = await db
          .insert(messages)
          .values({
            conversationId: conversation.id,
            senderId: otherId,
            content: autoContent,
            type: 'AUTO_REPLY',
          })
          .returning();
        autoReply = inserted;
        await db
          .update(conversations)
          .set({ lastMessageAt: new Date(), updatedAt: new Date() })
          .where(eq(conversations.id, conversation.id))
          .catch(() => {});
      }
    }

    await notifyChatRecipient({
      recipientUserId: recipient.userId,
      recipientTelegramId: recipient.telegramId,
      senderName,
      preview: content,
      targetId: senderId,
      conversationId: conversation.id,
      businessId: otherId,
    });

    return NextResponse.json({ success: true, message: userMessage, autoReply, suggestions: [] });
  } catch (error) {
    console.error('Chat send error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
