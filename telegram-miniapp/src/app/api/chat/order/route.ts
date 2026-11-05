import { NextResponse } from 'next/server';
import { db } from '@/db';
import { conversations, messages, ownedBusinesses } from '@/db/schema';
import { restaurantDb } from '@/db/restaurant';
import { branches, orders, restaurants } from '@rabbitty/database-restaurant/schema';
import { and, eq, or } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { resolveTelegramRecipient, notifyChatRecipient, isBusinessOpen } from '@/lib/chat';

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
      orderType?: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
      deliveryAddress?: string;
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
    // Fuera de horario el local no recibe pedidos (el chat normal sigue vivo).
    if (!isBusinessOpen(business)) {
      return NextResponse.json(
        {
          error: `El local está cerrado ahora (${business.startTime}–${business.endTime}). Puedes pedir dentro del horario.`,
        },
        { status: 409 },
      );
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

    // ── Orden real en el POS ──
    // Antes el pedido por chat era solo un mensaje: el POS nunca lo veía.
    // Se crea como borrador sin productos (el cajero los carga) para que
    // entre a la cola, tenga seguimiento y pueda asignarse repartidor.
    let posOrderId: string | null = null;
    try {
      // Preferir la sucursal de PRODUCCIÓN activa (no Sandbox/Entrenamiento).
      const branchRows = await restaurantDb
        .select({ id: branches.id, name: branches.name, isActive: branches.isActive })
        .from(branches)
        .innerJoin(restaurants, eq(branches.restaurantId, restaurants.id))
        .where(eq(restaurants.businessId, businessId));
      const activeBranchRows = branchRows.filter((b) => b.isActive !== false);
      const branch =
        activeBranchRows.find((b) => !/sandbox|entrenamiento|prueba|test/i.test(b.name || '')) ??
        activeBranchRows[0] ??
        branchRows[0];
      if (branch?.id) {
        const orderType =
          body.orderType === 'DINE_IN' || body.orderType === 'DELIVERY' ? body.orderType : 'TAKEAWAY';
        const [created] = await restaurantDb
          .insert(orders)
          .values({
            branchId: branch.id,
            customerId: caller.id,
            orderType,
            status: 'PENDING',
            subtotal: 0,
            tax: 0,
            discount: 0,
            tip: 0,
            total: 0,
            notes: summary.slice(0, 500),
            deliveryAddress:
              orderType === 'DELIVERY' ? body.deliveryAddress?.trim().slice(0, 300) ?? null : null,
          })
          .returning({ id: orders.id });
        posOrderId = created?.id ?? null;
      }
    } catch (posErr) {
      // Nunca romper el chat por el POS: el mensaje sigue siendo válido.
      console.warn('[CHAT ORDER] no se pudo crear la orden en POS:', posErr);
    }

    const [orderMessage] = await db
      .insert(messages)
      .values({
        conversationId: conversation.id,
        senderId: caller.id,
        content: summary,
        type: 'ORDER',
        metadata: {
          kind: 'ORDER',
          // Si hay orden en POS, el id real habilita el seguimiento.
          orderId: posOrderId || orderId,
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
      conversationId: conversation.id,
      businessId,
    });

    return NextResponse.json({
      success: true,
      orderId: posOrderId || orderId,
      posOrderId,
      conversationId: conversation.id,
      message: orderMessage,
    });
  } catch (error) {
    console.error('Chat order error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
