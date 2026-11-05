import { NextResponse } from 'next/server';
import { db } from '@/db';
import { bunzyDeliveries, conversations, messages, notifications } from '@/db/schema';
import { and, eq, isNull, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { getOwnedBusinessIds, resolveAccessForConversation } from '@/lib/chat';

export const runtime = 'nodejs';

/**
 * H-FASE0 · mark-read (comando explícito — regla §9: GET no muta estado).
 *
 * Un solo comando produce los dos ACKs:
 *  1) `readAt` de los mensajes del OTRO (tel lado móvil-cliente: ✓✓ del negocio)
 *  2) marca la campana in-app del hilo (isRead) — ya no hay "responde y el
 *     badge de la app se apaga por efecto secundario del fetch".
 *
 * El cliente lo llama al confirmar visibilidad REAL de la conversación
 * (pantalla abierta + visible), no en precarga ni en reintentos.
 */
const BodySchema = z.object({
  conversationId: z.string().min(1).optional(),
  targetId: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success || (!parsed.data.conversationId && !parsed.data.targetId)) {
      return NextResponse.json({ error: 'conversationId o targetId requerido' }, { status: 400 });
    }
    const { conversationId, targetId } = parsed.data;

    const businessIds = await getOwnedBusinessIds(caller.id);
    const convAuth = await resolveConversationAuth({ conversationId, targetId, userId: caller.id, businessIds });
    if (!convAuth) {
      return NextResponse.json({ error: 'Sin acceso a esta conversación' }, { status: 403 });
    }

    // 1) readAt de los mensajes que NO son míos
    const marked = await db
      .update(messages)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(messages.conversationId, convAuth.conversation.id),
          ne(messages.senderId, convAuth.access.myParticipantId),
          isNull(messages.readAt),
        ),
      )
      .returning({ id: messages.id });

    // 1.5) Bunzy Connect: la lectura REAL desde la app también cierra el
    // delivery oficial (antes solo lo hacía el admin).
    try {
      await db
        .update(bunzyDeliveries)
        .set({ status: 'READ', readAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(bunzyDeliveries.conversationId, convAuth.conversation.id),
            isNull(bunzyDeliveries.readAt),
          ),
        );
    } catch { /* best-effort: no romper el mark-read del chat */ }

    // 2) campana in-app del hilo ya vista
    try {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(
          and(
            eq(notifications.userId, caller.id),
            eq(notifications.type, 'CHAT'),
            eq(notifications.route, `/chat/${convAuth.otherId}`),
          ),
        );
    } catch { /* best-effort */ }

    return NextResponse.json({
      success: true,
      markedCount: marked.length,
      conversationId: convAuth.conversation.id,
    });
  } catch (error) {
    console.error('[CHAT MARK READ ERROR]', error);
    return NextResponse.json({ error: 'No se pudo marcar leído' }, { status: 500 });
  }
}

/** Autenticación de la conversación por id o por par (igual que send/history). */
async function resolveConversationAuth({
  conversationId,
  targetId,
  userId,
  businessIds,
}: {
  conversationId?: string;
  targetId?: string;
  userId: string;
  businessIds: string[];
}) {
  let conversation = conversationId
    ? await db.query.conversations.findFirst({ where: eq(conversations.id, conversationId) })
    : undefined;

  if (!conversation && targetId) {
    conversation = await db.query.conversations.findFirst({
      where: sql`("participant1" = ${userId} AND "participant2" = ${targetId}) OR ("participant1" = ${targetId} AND "participant2" = ${userId})`,
    });
  }
  if (!conversation) return null;

  const access = await resolveAccessForConversation(conversation, userId, businessIds);
  if (!access) return null;

  const otherId = access.otherParticipantId;
  return { conversation, access, otherId };
}
