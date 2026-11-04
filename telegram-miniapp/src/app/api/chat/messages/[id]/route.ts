import { NextRequest, NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { conversations, messages, messageReactions } from '@/db/schema';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { getOwnedBusinessIds, resolveConversationAccess } from '@/lib/chat';
import { enqueueChatEvent, kickChatOutbox } from '@/lib/realtime/chatOutbox';

export const runtime = 'nodejs';

const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 h, igual que las reseñas
const MAX_LEN = 4000;

/** Carga el mensaje + valida que el caller pertenezca a la conversación. */
async function loadMessage(id: string, callerId: string) {
  const [msg] = await db.select().from(messages).where(eq(messages.id, id)).limit(1);
  if (!msg) return { error: 'NOT_FOUND' as const };
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, msg.conversationId)).limit(1);
  if (!conv) return { error: 'NOT_FOUND' as const };
  const businessIds = await getOwnedBusinessIds(callerId);
  const access = resolveConversationAccess(conv, callerId, businessIds);
  if (!access) return { error: 'FORBIDDEN' as const };
  return { msg, access };
}

/**
 * ── PATCH /api/chat/messages/[id] ── EDITAR
 * Solo el autor, dentro de 24 h, y solo mensajes de texto no borrados.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });

    const { id } = await params;
    const loaded = await loadMessage(id, caller.id);
    if ('error' in loaded) {
      return NextResponse.json({ success: false, error: 'No encontrado o sin acceso' }, { status: loaded.error === 'FORBIDDEN' ? 403 : 404 });
    }
    const { msg, access } = loaded;

    if (msg.senderId !== access.myParticipantId) {
      return NextResponse.json({ success: false, error: 'Solo puedes editar tus mensajes' }, { status: 403 });
    }
    if (msg.deletedAt) {
      return NextResponse.json({ success: false, error: 'El mensaje está eliminado' }, { status: 400 });
    }
    if (msg.type !== 'TEXT') {
      return NextResponse.json({ success: false, error: 'Solo se pueden editar mensajes de texto' }, { status: 400 });
    }
    const createdAt = msg.createdAt ? new Date(msg.createdAt).getTime() : 0;
    if (!createdAt || Date.now() - createdAt > EDIT_WINDOW_MS) {
      return NextResponse.json({ success: false, error: 'Ya pasó la ventana de edición (24 h)' }, { status: 400 });
    }

    const body = (await req.json().catch(() => null)) as { content?: string } | null;
    const content = (body?.content ?? '').trim();
    if (!content || content.length > MAX_LEN) {
      return NextResponse.json({ success: false, error: 'Contenido inválido' }, { status: 400 });
    }

    const [updated] = await db
      .update(messages)
      .set({ content, editedAt: new Date() })
      .where(eq(messages.id, id))
      .returning();

    await enqueueChatEvent(db as never, {
      conversationId: msg.conversationId,
      type: 'message.created',
      eventId: `msg:${id}:edit:${Date.now()}`,
      payload: { messageId: id, conversationId: msg.conversationId, senderId: msg.senderId, content, type: msg.type, editedAt: new Date().toISOString() },
    }).catch(() => undefined);
    kickChatOutbox();

    return NextResponse.json({ success: true, message: updated });
  } catch (error) {
    console.error('[CHAT MESSAGE EDIT]', error);
    return NextResponse.json({ success: false, error: 'No se pudo editar' }, { status: 500 });
  }
}

/**
 * ── DELETE /api/chat/messages/[id] ── ELIMINAR
 * Body { forEveryone?: boolean }. "Para todos" solo el autor.
 * Soft-delete: el contenido se conserva en la fila (auditoría) pero la API lo
 * oculta a ambos lados.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });

    const { id } = await params;
    const body = (await req.json().catch(() => null)) as { forEveryone?: boolean } | null;
    const forEveryone = Boolean(body?.forEveryone);

    const loaded = await loadMessage(id, caller.id);
    if ('error' in loaded) {
      return NextResponse.json({ success: false, error: 'No encontrado o sin acceso' }, { status: loaded.error === 'FORBIDDEN' ? 403 : 404 });
    }
    const { msg, access } = loaded;

    if (forEveryone && msg.senderId !== access.myParticipantId) {
      return NextResponse.json({ success: false, error: 'Solo puedes eliminar para todos tus propios mensajes' }, { status: 403 });
    }

    await db
      .update(messages)
      .set({ deletedAt: new Date(), deletedForAll: forEveryone, deletedBy: caller.id })
      .where(eq(messages.id, id));

    if (forEveryone) {
      await enqueueChatEvent(db as never, {
        conversationId: msg.conversationId,
        type: 'message.created',
        eventId: `msg:${id}:delete:${Date.now()}`,
        payload: { messageId: id, conversationId: msg.conversationId, senderId: msg.senderId, content: '', type: 'DELETED', deleted: true },
      }).catch(() => undefined);
      kickChatOutbox();
    }

    return NextResponse.json({ success: true, forEveryone });
  } catch (error) {
    console.error('[CHAT MESSAGE DELETE]', error);
    return NextResponse.json({ success: false, error: 'No se pudo eliminar' }, { status: 500 });
  }
}

/**
 * ── POST /api/chat/messages/[id] ── REACCIONAR (toggle)
 * Body { emoji }. Tocar la misma reacción la quita.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });

    const { id } = await params;
    const loaded = await loadMessage(id, caller.id);
    if ('error' in loaded) {
      return NextResponse.json({ success: false, error: 'No encontrado o sin acceso' }, { status: loaded.error === 'FORBIDDEN' ? 403 : 404 });
    }
    const { msg, access } = loaded;

    const body = (await req.json().catch(() => null)) as { emoji?: string } | null;
    const emoji = (body?.emoji ?? '').trim();
    const ALLOWED = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
    if (!ALLOWED.includes(emoji)) {
      return NextResponse.json({ success: false, error: 'Reacción no permitida' }, { status: 400 });
    }

    const me = access.myParticipantId;
    const [existing] = await db
      .select({ id: messageReactions.id })
      .from(messageReactions)
      .where(and(eq(messageReactions.messageId, id), eq(messageReactions.userId, me), eq(messageReactions.emoji, emoji)))
      .limit(1);

    if (existing) {
      await db.delete(messageReactions).where(eq(messageReactions.id, existing.id));
    } else {
      await db.insert(messageReactions).values({ messageId: id, userId: me, emoji }).onConflictDoNothing();
    }

    const rows = await db
      .select({ emoji: messageReactions.emoji, userId: messageReactions.userId })
      .from(messageReactions)
      .where(eq(messageReactions.messageId, id));

    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;

    await enqueueChatEvent(db as never, {
      conversationId: msg.conversationId,
      type: 'message.created',
      eventId: `react:${id}:${me}:${emoji}:${Date.now()}`,
      payload: { messageId: id, conversationId: msg.conversationId, reaction: true, emoji, counts },
    }).catch(() => undefined);
    kickChatOutbox();

    return NextResponse.json({ success: true, added: !existing, counts, myReactions: rows.filter((r) => r.userId === me).map((r) => r.emoji) });
  } catch (error) {
    console.error('[CHAT MESSAGE REACTION]', error);
    return NextResponse.json({ success: false, error: 'No se pudo reaccionar' }, { status: 500 });
  }
}
