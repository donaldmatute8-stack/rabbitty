import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { conversations } from '@/db/schema';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { getOwnedBusinessIds, resolveAccessForConversation } from '@/lib/chat';
import {
  ALLOWED_MEDIA_TYPES,
  MAX_MEDIA_BYTES,
  buildMediaKey,
  isMediaStorageConfigured,
  uploadObject,
} from '@/lib/media/storage';

export const runtime = 'nodejs';

/**
 * ── POST /api/chat/media ── sube una nota de voz o una foto al bucket privado.
 *
 * Devuelve la `key`. El mensaje guarda solo la key; el binario nunca entra a
 * Postgres (por eso ya no hay tope de 200 KB).
 *
 * Form: file + conversationId (+ durationMs opcional)
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });

    if (!isMediaStorageConfigured()) {
      return NextResponse.json({ success: false, error: 'Storage no configurado' }, { status: 503 });
    }

    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > MAX_MEDIA_BYTES + 64 * 1024) {
      return NextResponse.json({ success: false, error: 'Archivo demasiado grande (máx 5 MB)' }, { status: 413 });
    }

    const form = await req.formData().catch(() => null);
    const file = form?.get('file');
    const conversationId = String(form?.get('conversationId') || '').trim();
    if (!(file instanceof Blob) || !conversationId) {
      return NextResponse.json({ success: false, error: 'file y conversationId requeridos' }, { status: 400 });
    }
    if (file.size > MAX_MEDIA_BYTES) {
      return NextResponse.json({ success: false, error: 'Archivo demasiado grande (máx 5 MB)' }, { status: 413 });
    }

    const mime = (file.type || '').split(';')[0].trim().toLowerCase();
    if (!ALLOWED_MEDIA_TYPES[mime]) {
      return NextResponse.json(
        { success: false, error: `Formato no permitido (${mime || 'desconocido'})` },
        { status: 415 },
      );
    }

    const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
    if (!conv) return NextResponse.json({ success: false, error: 'Conversación no encontrada' }, { status: 404 });

    const businessIds = await getOwnedBusinessIds(caller.id);
    const access = await resolveAccessForConversation(conv, caller.id, businessIds);
    if (!access) return NextResponse.json({ success: false, error: 'Sin acceso' }, { status: 403 });

    const key = buildMediaKey(conv.id, mime);
    const buffer = await file.arrayBuffer();
    await uploadObject(key, buffer, mime);

    return NextResponse.json({
      success: true,
      key,
      mime,
      size: file.size,
      durationMs: Number(form?.get('durationMs') || 0) || null,
    });
  } catch (error) {
    console.error('[CHAT MEDIA UPLOAD]', error);
    return NextResponse.json({ success: false, error: 'No se pudo subir el archivo' }, { status: 500 });
  }
}
