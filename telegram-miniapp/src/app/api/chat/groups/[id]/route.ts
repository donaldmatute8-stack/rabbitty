import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { conversations, conversationMembers } from '@/db/schema';
import { getAuthenticatedUser } from '@/lib/serverAuth';

export const runtime = 'nodejs';

const MAX_MEMBERS = 50;

/**
 * ── GET /api/chat/groups/[id] ── info + miembros (solo si soy miembro).
 * ── PATCH ── añadir/quitar miembros o salir (ADMIN para add/remove).
 * ── DELETE ── salir del grupo (o borrarlo si soy el último ADMIN y quedo solo).
 */

async function membershipOf(conversationId: string, userId: string) {
  const [row] = await db
    .select({ role: conversationMembers.role })
    .from(conversationMembers)
    .where(and(
      eq(conversationMembers.conversationId, conversationId),
      eq(conversationMembers.userId, userId),
      isNull(conversationMembers.leftAt),
    ))
    .limit(1);
  return row ?? null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
    const { id } = await params;

    const me = await membershipOf(id, caller.id);
    if (!me) return NextResponse.json({ success: false, error: 'Sin acceso' }, { status: 403 });

    const [group] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
    if (!group) return NextResponse.json({ success: false, error: 'No encontrado' }, { status: 404 });

    const members = await db
      .select({ userId: conversationMembers.userId, role: conversationMembers.role, joinedAt: conversationMembers.joinedAt })
      .from(conversationMembers)
      .where(and(eq(conversationMembers.conversationId, id), isNull(conversationMembers.leftAt)));

    return NextResponse.json({
      success: true,
      group: { id: group.id, name: group.name, kind: group.kind, audience: group.audience, createdAt: group.createdAt },
      members,
      myRole: me.role,
    });
  } catch (error) {
    console.error('[CHAT GROUP GET]', error);
    return NextResponse.json({ success: false, error: 'No se pudo leer el grupo' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
    const { id } = await params;

    const me = await membershipOf(id, caller.id);
    if (!me) return NextResponse.json({ success: false, error: 'Sin acceso' }, { status: 403 });

    const body = (await req.json().catch(() => null)) as { add?: string[]; remove?: string[] } | null;
    const add = Array.isArray(body?.add) ? body!.add.filter((x): x is string => typeof x === 'string' && x.length > 0) : [];
    const remove = Array.isArray(body?.remove) ? body!.remove.filter((x): x is string => typeof x === 'string' && x.length > 0) : [];

    if (me.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Solo el admin del grupo puede cambiar miembros' }, { status: 403 });
    }
    if (add.length === 0 && remove.length === 0) {
      return NextResponse.json({ success: false, error: 'Nada que cambiar' }, { status: 400 });
    }

    if (add.length > 0) {
      await db
        .insert(conversationMembers)
        .values(add.slice(0, MAX_MEMBERS).map((userId) => ({ conversationId: id, userId, role: 'MEMBER' })))
        .onConflictDoNothing();
      // Si alguien había salido, se reactiva.
      await db
        .update(conversationMembers)
        .set({ leftAt: null })
        .where(and(eq(conversationMembers.conversationId, id), inArray(conversationMembers.userId, add)));
    }

    if (remove.length > 0) {
      await db
        .update(conversationMembers)
        .set({ leftAt: new Date() })
        .where(and(eq(conversationMembers.conversationId, id), inArray(conversationMembers.userId, remove)));
    }

    return NextResponse.json({ success: true, added: add.length, removed: remove.length });
  } catch (error) {
    console.error('[CHAT GROUP PATCH]', error);
    return NextResponse.json({ success: false, error: 'No se pudo actualizar el grupo' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
    const { id } = await params;

    const me = await membershipOf(id, caller.id);
    if (!me) return NextResponse.json({ success: false, error: 'Sin acceso' }, { status: 403 });

    // Salir = marcar leftAt (el historial de los demás no se toca).
    await db
      .update(conversationMembers)
      .set({ leftAt: new Date() })
      .where(and(eq(conversationMembers.conversationId, id), eq(conversationMembers.userId, caller.id)));

    return NextResponse.json({ success: true, left: true });
  } catch (error) {
    console.error('[CHAT GROUP LEAVE]', error);
    return NextResponse.json({ success: false, error: 'No se pudo salir del grupo' }, { status: 500 });
  }
}
