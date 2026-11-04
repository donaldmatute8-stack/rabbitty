import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { conversations, conversationKeys, ownedBusinesses } from '@/db/schema';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { getOwnedBusinessIds, resolveAccessForConversation } from '@/lib/chat';

export const runtime = 'nodejs';

const MAX_ENTRIES = 40;

/**
 * ── POST /api/chat/e2e/conversation-keys ── guarda los SOBRES de la clave de
 * conversación (uno por dispositivo del destinatario).
 *
 * El servidor no puede abrirlos: solo los almacena y los devuelve al
 * dispositivo que corresponde.
 *
 * Body: { conversationId, entries: [{ recipientUserId, recipientDeviceId, wrappedKey }] }
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });

    const body = (await req.json().catch(() => null)) as
      | { conversationId?: string; entries?: Array<{ recipientUserId?: string; recipientDeviceId?: string; wrappedKey?: string }> }
      | null;

    const conversationId = (body?.conversationId ?? '').trim();
    const entries = Array.isArray(body?.entries) ? body!.entries!.slice(0, MAX_ENTRIES) : [];
    if (!conversationId || entries.length === 0) {
      return NextResponse.json({ success: false, error: 'conversationId y entries requeridos' }, { status: 400 });
    }

    const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
    if (!conv) return NextResponse.json({ success: false, error: 'Conversación no encontrada' }, { status: 404 });

    const businessIds = await getOwnedBusinessIds(caller.id);
    const access = await resolveAccessForConversation(conv, caller.id, businessIds);
    if (!access) return NextResponse.json({ success: false, error: 'Sin acceso' }, { status: 403 });

    // Solo se aceptan sobre para participantes reales del chat.
    const participants = new Set([conv.participant1, conv.participant2].filter(Boolean));
    const clean = entries
      .filter((e) => typeof e?.recipientDeviceId === 'string' && e.recipientDeviceId.length > 0 && e.recipientDeviceId.length <= 80)
      .filter((e) => typeof e?.wrappedKey === 'string' && e.wrappedKey.length > 0 && e.wrappedKey.length <= 2000)
      .filter((e) => typeof e?.recipientUserId === 'string' && participants.has(e.recipientUserId))
      .map((e) => ({
        conversationId,
        recipientUserId: e.recipientUserId as string,
        recipientDeviceId: e.recipientDeviceId as string,
        wrappedKey: e.wrappedKey as string,
      }));

    if (clean.length === 0) {
      return NextResponse.json({ success: false, error: 'Ningún sobre válido' }, { status: 400 });
    }

    await db.insert(conversationKeys).values(clean).onConflictDoNothing();

    return NextResponse.json({ success: true, stored: clean.length });
  } catch (error) {
    console.error('[E2E CONV KEYS POST]', error);
    return NextResponse.json({ success: false, error: 'No se pudieron guardar las claves' }, { status: 500 });
  }
}

/**
 * ── GET /api/chat/e2e/conversation-keys?conversationId=&deviceId= ──
 * Devuelve el sobre que corresponde a MI dispositivo (nunca el de otro).
 */
export async function GET(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });

    const url = new URL(req.url);
    const conversationId = (url.searchParams.get('conversationId') || '').trim();
    const deviceId = (url.searchParams.get('deviceId') || '').trim();
    if (!conversationId || !deviceId) {
      return NextResponse.json({ success: false, error: 'conversationId y deviceId requeridos' }, { status: 400 });
    }

    const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
    if (!conv) return NextResponse.json({ success: false, error: 'No encontrada' }, { status: 404 });

    const businessIds = await getOwnedBusinessIds(caller.id);
    const access = await resolveAccessForConversation(conv, caller.id, businessIds);
    if (!access) return NextResponse.json({ success: false, error: 'Sin acceso' }, { status: 403 });

    const [row] = await db
      .select({ wrappedKey: conversationKeys.wrappedKey })
      .from(conversationKeys)
      .where(and(
        eq(conversationKeys.conversationId, conversationId),
        eq(conversationKeys.recipientDeviceId, deviceId),
        eq(conversationKeys.recipientUserId, access.myParticipantId),
      ))
      .limit(1);

    return NextResponse.json({ success: true, wrappedKey: row?.wrappedKey ?? null });
  } catch (error) {
    console.error('[E2E CONV KEYS GET]', error);
    return NextResponse.json({ success: false, error: 'No se pudo leer la clave' }, { status: 500 });
  }
}
