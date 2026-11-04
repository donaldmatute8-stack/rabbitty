import { NextRequest, NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { conversations, messages } from '@/db/schema';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { getOwnedBusinessIds, resolveAccessForConversation } from '@/lib/chat';
import { deleteObject, keyBelongsToConversation } from '@/lib/media/storage';

export const runtime = 'nodejs';

/**
 * ── POST /api/chat/media/viewed ── marca una foto "ver una vez" como vista y
 * BORRA el objeto del bucket.
 *
 * Regla: una sola vista significa una sola vista. Después de esto el archivo ya
 * no existe, así que ni el remitente puede volver a abrirlo (queda el registro
 * `viewedAt` en el mensaje).
 *
 * Body: { key }
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });

    const body = (await req.json().catch(() => null)) as { key?: string } | null;
    const key = body?.key?.trim();
    if (!key) return NextResponse.json({ success: false, error: 'key requerida' }, { status: 400 });

    const parts = key.split('/');
    if (parts.length < 3 || parts[0] !== 'chat') {
      return NextResponse.json({ success: false, error: 'Ruta inválida' }, { status: 400 });
    }
    const conversationId = parts[1];
    if (!keyBelongsToConversation(key, conversationId)) {
      return NextResponse.json({ success: false, error: 'Ruta inválida' }, { status: 400 });
    }

    const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
    if (!conv) return NextResponse.json({ success: false, error: 'No encontrado' }, { status: 404 });

    const businessIds = await getOwnedBusinessIds(caller.id);
    const access = await resolveAccessForConversation(conv, caller.id, businessIds);
    if (!access) return NextResponse.json({ success: false, error: 'Sin acceso' }, { status: 403 });

    // Marca viewedAt en el mensaje (jsonb) — solo si aún no estaba vista.
    await db
      .update(messages)
      .set({
        metadata: sql`jsonb_set(coalesce(${messages.metadata}, '{}'::jsonb), '{viewedAt}', to_jsonb(now()::text))`,
      })
      .where(
        and(
          eq(messages.conversationId, conversationId),
          sql`${messages.metadata}->>'key' = ${key}`,
          sql`(${messages.metadata}->>'viewedAt') IS NULL`,
        ),
      )
      .catch(() => undefined);

    // El archivo desaparece: ni el autor puede reabrirlo.
    await deleteObject(key);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[CHAT MEDIA VIEWED]', error);
    return NextResponse.json({ success: false, error: 'No se pudo marcar como vista' }, { status: 500 });
  }
}
