import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { conversations } from '@/db/schema';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { getOwnedBusinessIds, resolveAccessForConversation } from '@/lib/chat';
import { getObject, isMediaStorageConfigured, keyBelongsToConversation } from '@/lib/media/storage';

export const runtime = 'nodejs';

const EXT_TO_MIME: Record<string, string> = {
  webm: 'audio/webm',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  webp: 'image/webp',
  jpg: 'image/jpeg',
  png: 'image/png',
};

/**
 * ── GET /api/chat/media/[...key] ── sirve el binario SOLO a quien pertenece a
 * la conversación. El bucket es privado: esta ruta es la única puerta.
 *
 * La key tiene la forma `chat/<conversationId>/<uuid>.<ext>`, así que el
 * conversationId sale de la propia key y se valida contra la sesión.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  try {
    const caller = await getAuthenticatedUser(_req);
    if (!caller) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
    if (!isMediaStorageConfigured()) {
      return NextResponse.json({ success: false, error: 'Storage no configurado' }, { status: 503 });
    }

    const { key: segments } = await params;
    const key = segments.map((s) => decodeURIComponent(s)).join('/');
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

    const upstream = await getObject(key);
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ success: false, error: 'Archivo no disponible' }, { status: 404 });
    }

    const ext = (key.split('.').pop() || '').toLowerCase();
    const contentType = EXT_TO_MIME[ext] ?? 'application/octet-stream';

    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        // Privado: nunca cachear en CDN/proxy intermedios.
        'Cache-Control': 'private, max-age=0, no-store',
      },
    });
  } catch (error) {
    console.error('[CHAT MEDIA GET]', error);
    return NextResponse.json({ success: false, error: 'No se pudo leer el archivo' }, { status: 500 });
  }
}
