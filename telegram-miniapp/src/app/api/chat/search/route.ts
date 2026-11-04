import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { conversations, messages, users, ownedBusinesses, conversationMembers } from '@/db/schema';
import { getAuthenticatedUser } from '@/lib/serverAuth';

export const runtime = 'nodejs';

const LIMIT = 40;

/**
 * ── GET /api/chat/search?q=&conversationId? ── búsqueda en el HISTORIAL.
 *
 * Decisión (ADR-013): la búsqueda server-side existe SOLO para conversaciones
 * BUSINESS. En PEER el cifrado E2E es el objetivo y el servidor no debe poder
 * indexar el contenido; ahí se buscará en el cliente.
 *
 * - Sin `conversationId`: busca en todas mis conversaciones BUSINESS.
 * - Con `conversationId`: limita a esa (y valida acceso).
 */
export async function GET(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });

    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').trim();
    const conversationId = url.searchParams.get('conversationId');
    if (q.length < 2) {
      return NextResponse.json({ success: true, results: [], scope: 'business-only', reason: 'QUERY_TOO_SHORT' });
    }

    const myBusinesses = await db
      .select({ id: ownedBusinesses.id })
      .from(ownedBusinesses)
      .where(eq(ownedBusinesses.ownerId, caller.id))
      .catch(() => [] as { id: string }[]);
    const bizIds = myBusinesses.map((b) => b.id);
    const myIds = [caller.id, ...bizIds];

    // Conversaciones visibles: 1:1 donde participo (o mi negocio) + grupos donde soy miembro.
    const groupRows = await db
      .select({ conversationId: conversationMembers.conversationId })
      .from(conversationMembers)
      .where(and(inArray(conversationMembers.userId, myIds), isNull(conversationMembers.leftAt)))
      .catch(() => [] as { conversationId: string }[]);
    const groupIds = groupRows.map((r) => r.conversationId);

    const convs = await db
      .select({ id: conversations.id, audience: conversations.audience })
      .from(conversations)
      .where(
        or(
          inArray(conversations.participant1, myIds),
          inArray(conversations.participant2, myIds),
          ...(groupIds.length > 0 ? [inArray(conversations.id, groupIds)] : []),
        ),
      );

    // Solo BUSINESS (ver ADR-013).
    const allowed = convs
      .filter((c) => c.audience === 'BUSINESS')
      .map((c) => c.id)
      .filter((id) => (conversationId ? id === conversationId : true));

    if (allowed.length === 0) {
      return NextResponse.json({ success: true, results: [], scope: 'business-only' });
    }

    const rows = await db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        content: messages.content,
        senderId: messages.senderId,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(
        and(
          inArray(messages.conversationId, allowed),
          ilike(messages.content, `%${q}%`),
          isNull(messages.deletedAt),
        ),
      )
      .orderBy(desc(messages.createdAt))
      .limit(LIMIT);

    // Nombres de remitentes (solo usuarios; los negocios se muestran como "El negocio").
    const senderIds = Array.from(new Set(rows.map((r) => r.senderId)));
    const people = senderIds.length
      ? await db
          .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, username: users.username })
          .from(users)
          .where(inArray(users.id, senderIds.filter((id) => /^[0-9a-f-]{36}$/i.test(id))))
          .catch(() => [] as Array<{ id: string; firstName: string | null; lastName: string | null; username: string | null }>)
      : [];
    const nameById = new Map(
      people.map((u) => [u.id, `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.username || 'Rabbitter']),
    );

    return NextResponse.json({
      success: true,
      scope: 'business-only',
      results: rows.map((r) => ({
        ...r,
        senderName: nameById.get(r.senderId) ?? (bizIds.includes(r.senderId) ? 'El negocio' : 'Rabbitter'),
      })),
    });
  } catch (error) {
    console.error('[CHAT SEARCH]', error);
    return NextResponse.json({ success: false, error: 'No se pudo buscar' }, { status: 500 });
  }
}
