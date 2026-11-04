import { NextRequest, NextResponse } from 'next/server';
import { inArray } from 'drizzle-orm';
import { db } from '@/db';
import { conversations, conversationMembers, ownedBusinesses } from '@/db/schema';
import { getAuthenticatedUser } from '@/lib/serverAuth';

export const runtime = 'nodejs';

const MAX_MEMBERS = 50;

/**
 * ── POST /api/chat/groups ── crear un grupo de Rabbitters.
 *
 * Nace `kind = GROUP`, `audience = PEER` (privacidad de Rabbitters; E2E es
 * fase posterior). El creador queda como ADMIN.
 *
 * Body: { name, memberIds: string[] }
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });

    const body = (await req.json().catch(() => null)) as
      | { name?: string; memberIds?: string[] }
      | null;
    const name = (body?.name ?? '').trim();
    const rawMembers = Array.isArray(body?.memberIds) ? body.memberIds : [];

    if (name.length < 1 || name.length > 60) {
      return NextResponse.json({ success: false, error: 'Nombre inválido (1–60)' }, { status: 400 });
    }
    const memberIds = Array.from(new Set(rawMembers.filter((id): id is string => typeof id === 'string' && id.length > 0)))
      .filter((id) => id !== caller.id)
      .slice(0, MAX_MEMBERS);
    if (memberIds.length === 0) {
      return NextResponse.json({ success: false, error: 'Elige al menos un miembro' }, { status: 400 });
    }

    // No se puede meter a un negocio ajeno como miembro de un grupo de personas.
    try {
      const bizRows = await db
        .select({ id: ownedBusinesses.id })
        .from(ownedBusinesses)
        .where(inArray(ownedBusinesses.id, memberIds));
      if (bizRows.length > 0) {
        return NextResponse.json({ success: false, error: 'Los grupos son entre personas' }, { status: 400 });
      }
    } catch { /* si falla, se valida abajo en el insert */ }

    const [group] = await db
      .insert(conversations)
      .values({
        // En GROUP estos dos campos no autorizan; se conserva el creador para
        // que la lista lo trate como chat propio.
        participant1: caller.id,
        participant2: '',
        kind: 'GROUP',
        audience: 'PEER',
        name,
        lastMessageAt: new Date(),
      })
      .returning();
    if (!group) throw new Error('No se pudo crear el grupo');

    await db
      .insert(conversationMembers)
      .values([
        { conversationId: group.id, userId: caller.id, role: 'ADMIN' },
        ...memberIds.map((id) => ({ conversationId: group.id, userId: id, role: 'MEMBER' })),
      ])
      .onConflictDoNothing();

    return NextResponse.json({ success: true, group: { id: group.id, name: group.name, kind: group.kind } });
  } catch (error) {
    console.error('[CHAT GROUP CREATE]', error);
    return NextResponse.json({ success: false, error: 'No se pudo crear el grupo' }, { status: 500 });
  }
}

