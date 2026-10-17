import { NextResponse } from 'next/server';
import { db } from '@/db';
import { conversations, messages, ownedBusinesses } from '@/db/schema';
import { and, eq, or } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { resolveTelegramRecipient, notifyChatRecipient } from '@/lib/chat';

export async function POST(req: Request) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = (await req.json()) as {
      businessId?: string;
      items?: string;
      notes?: string;
    };

    const businessId = (body.businessId || '').trim();
    const items = (body.items || '').trim();
    if (!businessId || !items) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    const business = await db.query.ownedBusinesses.findFirst({ where: eq(ownedBusinesses.id, businessId) });
    if (!business) {
      return NextResponse.json({ error: 'Comercio no encontrado' }, { status: 404 });
    }

    let conversation = await db.query.conversations.findFirst({
      where: or(
        and(eq(conversations.participant1, caller.id), eq(conversations.participant2, businessId)),
        and(eq(conversations.participant1, businessId), eq(conversations.participant2, caller.id)),
      ),
    });
    if (!conversation) {
      const [created] = await db
        .insert(conversations)
        .values({ participant1: caller.id, participant2: businessId })
        .returning();
      conversation = created;
    }

    const orderId = `ord-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const itemLines = items
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const summary = `🛒 Pedido Bunzy\n${itemLines.join('\n')}${body.notes ? `\n\n📝 ${body.notes.trim()}` : ''}`;

    const [orderMessage] = await db
      .insert(messages)
      .values({
        conversationId: conversation.id,
        senderId: caller.id,
        content: summary,
        type: 'ORDER',
        metadata: {
          kind: 'ORDER',
          orderId,
          businessId,
          businessName: business.name,
          items: itemLines,
          notes: body.notes?.trim() || undefined,
          status: 'SENT',
        },
      })
      .returning();

    await db
      .update(conversations)
      .set({ lastMessageAt: new Date(), updatedAt: new Date() })
      .where(eq(conversations.id, conversation.id))
      .catch(() => {});

    const recipient = await resolveTelegramRecipient(businessId);
    const sender = await resolveTelegramRecipient(caller.id);
    await notifyChatRecipient({
      recipientUserId: recipient.userId,
      recipientTelegramId: recipient.telegramId,
      senderName: sender.displayName,
      preview: `Nuevo pedido: ${itemLines[0] || 'pedido'}`,
    });

    return NextResponse.json({
      success: true,
      orderId,
      conversationId: conversation.id,
      message: orderMessage,
    });
  } catch (error) {
    console.error('Chat order error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
