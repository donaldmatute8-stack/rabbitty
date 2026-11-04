import { NextResponse } from 'next/server';
import { db } from '@/db';
import { messages, conversations, ownedBusinesses, notificationsOutbox } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
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
import { chatRateLimit } from '@/lib/chatRateLimit';

import { enqueueChatEvent, kickChatOutbox } from '@/lib/realtime/chatOutbox';
import { keyBelongsToConversation } from '@/lib/media/storage';
const AUTO_REPLY_WINDOW_MS = 6 * 60 * 60 * 1000;

export async function POST(req: Request) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // ── H-FASE0 · rate limit 0.8 por identidad autenticada (patrón existente;
    // límite por userId, nunca por IP; Redis si REDIS_URL, memoria si no) ──
    const rl = await chatRateLimit(`chat_send:${caller.id}`, 20);
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Demasiados mensajes seguidos. Espera un momento 🐰' },
        { status: 429 }
      );
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
      /** H-FASE0 · idempotencia: uuid por MENSAJE generado en el cliente. */
      clientMessageId?: string;
    };

    const content = (body.content || '').trim();
    if (!body.conversationId || !content) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    // ── H-FASE0 · 0.9: cero media nueva en jsonb (TOAST bloat en Neon).
    // Texto, ubicación y tipos transaccionales siguen; las notas de voz nuevas
    // quedan CAPADAS — la solución real (storage de objetos) es el workstream
    // de media del plan, no un jsonb más grande.
    // La voz/foto ya NO viaja en jsonb: si trae `metadata.key` del bucket, se
    // acepta sin tope (el límite real es 5 MB en /api/chat/media). El cap viejo
    // queda solo como red de seguridad para clientes que aún manden dataURL.
    const mediaMeta = body.metadata as Record<string, unknown> | null;
    const storedKey = typeof mediaMeta?.key === 'string' ? mediaMeta.key : null;
    const hasStoredMedia = Boolean(
      storedKey && body.conversationId && keyBelongsToConversation(storedKey, body.conversationId)
    );

    if (body.type === 'VOICE' && !hasStoredMedia) {
      const voiceLen = typeof mediaMeta?.voiceDataUrl === 'string' ? mediaMeta.voiceDataUrl.length : 0;
      if (voiceLen > 200_000) {
        return NextResponse.json(
          { error: 'Esta nota de voz es muy larga para enviarse por ahora — actualiza la app 🐰' },
          { status: 413 }
        );
      }
    }

    if (storedKey && !hasStoredMedia) {
      return NextResponse.json({ error: 'Archivo adjunto inválido' }, { status: 400 });
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

    // userId REAL del destinatario para el outbox (el worker NOTIFICA a users).
    // El par puede ser businessId ⇒ el userId es el ownerId.
    const recipientForOutbox = otherId === 'bot'
      ? null
      : await resolveTelegramRecipient(otherId).catch(() => null);

    // ── H-FASE0 · send ATÓMICO E IDEMPOTENTE (una transacción, regla §4):
    //   (a) INSERT con UNIQUE(conversationId, clientMessageId) — un reintento
    //       tras timeout regresa el MISMO mensaje, no un duplicado;
    //   (b) lastMessageAt de la conversación en la misma tx;
    //   (c) la notificación del chat se registra EN la MISMA tx (outbox
    //       transaccional). Publicación at-least-once por el worker — el
    //       `void fire-and-forget` prohibido (mismo patrón que pagos, D-13).
    let userMessage: typeof messages.$inferSelect;
    let replayed = false;

    type SendTx = { userMessage: typeof messages.$inferSelect; replayed?: boolean };
    const txResult = await db.transaction(async (tx): Promise<SendTx> => {
      const inserted = await tx
        .insert(messages)
        .values({
          conversationId: conversation.id,
          senderId,
          content,
          type: isLocation ? 'LOCATION' : (body.type === 'VOICE' ? 'VOICE' : body.type === 'IMAGE' ? 'IMAGE' : 'TEXT'),
          metadata: isLocation
            ? { kind: 'LOCATION', lat: body.lat, lng: body.lng }
            : (body.metadata && typeof body.metadata === 'object' ? body.metadata : null),
          clientMessageId: body.clientMessageId?.trim() || null,
        })
        .onConflictDoNothing({ target: [messages.conversationId, messages.clientMessageId] })
        .returning();

      if (inserted.length === 0) {
        // UNIQUE impactado ⇒ replay idempotente: regresa el mensaje ORIGINAL.
        const [existing] = await tx.query.messages.findMany({
          where: and(
            eq(messages.conversationId, conversation.id),
            eq(messages.clientMessageId, body.clientMessageId!.trim()),
          ),
          limit: 1,
        });
        if (!existing) throw new Error('SEND_IDEMPOTENCY_MISSING');
        return { userMessage: existing, replayed: true };
      }

      const lastMessage = inserted[inserted.length - 1];

      await tx
        .update(conversations)
        .set({ lastMessageAt: now, updatedAt: now })
        .where(eq(conversations.id, conversation.id));

      // (c) evento del chat → outbox EN la tx. dedupeKey por mensaje ⇒ el
      // worker puede republicar sin duplicar campana (dedupe server-side);
      // el cliente además deduple por messageId (§3.4).
      if (recipientForOutbox?.userId) {
        await tx
          .insert(notificationsOutbox)
          .values({
            userId: recipientForOutbox.userId,
            type: 'CHAT',
            title: '💬 Nuevo mensaje',
            message: content.slice(0, 140),
            route: `/chat/${senderId}`,
            dedupeKey: lastMessage.id ? `chat_msg:${lastMessage.id}` : null,
            priority: 'high',
          })
          .onConflictDoNothing({ target: notificationsOutbox.dedupeKey });
      }

      // ── Fase 4: evento realtime EN LA MISMA TX ──
      // El mensaje y su evento son atómicos: si el INSERT del mensaje commitea,
      // el aviso existe en el outbox y el worker lo publicará (at-least-once).
      await enqueueChatEvent(tx, {
        conversationId: conversation.id,
        type: 'message.created',
        eventId: `msg:${lastMessage.id}`,
        payload: {
          messageId: lastMessage.id,
          conversationId: conversation.id,
          senderId,
          content: lastMessage.content,
          type: lastMessage.type,
          metadata: lastMessage.metadata ?? null,
          createdAt: lastMessage.createdAt,
        },
      });

      return { userMessage: lastMessage, replayed: false };
    });

    userMessage = txResult.userMessage;
    replayed = Boolean(txResult.replayed);

    // Publicación best-effort del evento (no bloquea la respuesta). Si falla,
    // el cron del outbox lo reintenta: el mensaje ya está persistido.
    if (!replayed) kickChatOutbox();

    // ── Respuesta del bot (Bunzy) — sin clientMessageId del usuario, con
    // clave propia derivada del mensaje (reintentos → mismo bot reply).
    if (otherId === 'bot' && !replayed) {
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
          clientMessageId: `bot_${userMessage?.id ?? content.slice(0, 24)}`,
        })
        .onConflictDoNothing({ target: [messages.conversationId, messages.clientMessageId] })
        .returning();

      await db
        .update(conversations)
        .set({ lastMessageAt: new Date(), updatedAt: new Date() })
        .where(eq(conversations.id, conversation.id))
        .catch(() => {});

      return NextResponse.json({
        success: true,
        message: userMessage,
        botResponse: botMessage ?? null,
        suggestions: reply.suggestions,
        options: reply.options ?? [],
        orderDraft: reply.orderDraft ?? null,
        transferRequest: reply.transferRequest ?? null,
        receiveQr: reply.receiveQr ?? null,
      });
    }

    // ── Auto-reply fuera de horario (Fase 0.5): la dedupe de ventana usa la
    // MISMA constraint UNIQUE con clientMessageId={auto:...} — el race
    // SELECT-then-INSERT desaparece, no puede haber dos AUTO_REPLY por ventana.
    let autoReply: typeof messages.$inferSelect | null = null;

    const [senderResolved] = [
      await resolveTelegramRecipient(senderId).catch(() => null),
    ];
    const [recipient, otherBusiness] = await Promise.all([
      resolveTelegramRecipient(otherId).catch(() => null),
      db.query.ownedBusinesses.findFirst({ where: eq(ownedBusinesses.id, otherId) }).catch(() => undefined),
    ]);
    const senderName = senderResolved?.displayName ?? 'Rabbitter';

    if (otherBusiness && !access.isBusinessInbox && !isBusinessOpen(otherBusiness) && !replayed) {
      const windowKey = `auto:${conversation.id.slice(0, 8)}:${Math.floor(now.getTime() / AUTO_REPLY_WINDOW_MS)}`;
      const [autoInserted] = await db
        .insert(messages)
        .values({
          conversationId: conversation.id,
          senderId: otherId,
          content:
            `¡Gracias por escribir a ${otherBusiness.name}! 🐰 En este momento estamos fuera de horario ` +
            `(${formatBusinessHours(otherBusiness)}). Te responderemos en cuanto abramos. Mientras tanto, ` +
            `puedes explorar sus recompensas en Rabbitty.`,
          type: 'AUTO_REPLY',
          clientMessageId: windowKey,
        })
        .onConflictDoNothing({ target: [messages.conversationId, messages.clientMessageId] })
        .returning();
      if (autoInserted) {
        autoReply = autoInserted;
        await db
          .update(conversations)
          .set({ lastMessageAt: new Date(), updatedAt: new Date() })
          .where(eq(conversations.id, conversation.id))
          .catch(() => {});
      }
    }

    // ── Post-commit, best-effort y no-fatal: Telegram DM (canal del afiliado
    // chatReplyChannel). El outbox YA tiene la notificación persistida en la
    // tx — el push in-app y APNs salen del worker. `notifyChatRecipient` entra
    // como replay idempotente por dedupeKey (chat_msg:{id}) ⇒ en conflicto no
    // duplica campana; su Telegram DM siempre es útil y va best-effort.
    void notifyChatRecipient({
      recipientUserId: recipient?.userId ?? null,
      recipientTelegramId: recipient?.telegramId ?? null,
      senderName,
      preview: content,
      targetId: senderId,
      conversationId: conversation.id,
      businessId: otherId,
      dedupeKey: userMessage?.id ? `chat_msg:${userMessage.id}` : null,
    }).catch((err) => console.warn('[ChatSend] notifyChatRecipient error:', err));

    return NextResponse.json({ success: true, message: userMessage, autoReply, suggestions: [] });
  } catch (error) {
    console.error('Chat send error:', error);
    return NextResponse.json({ error: 'Error al enviar el mensaje' }, { status: 500 });
  }
}
