import { NextResponse } from 'next/server';
import { getObject, isProductImageKey } from '@rabbitty/api/services/mediaStorage';

export const runtime = 'nodejs';

/**
 * ── GET /api/media/product/<key> ── foto de producto (pública) ─────────────
 *
 * El bucket es privado, pero la foto de un platillo o producto se muestra a
 * cualquiera que abra la ficha del negocio (sin sesión). Esta ruta sirve sólo la
 * carpeta `menu/` y valida el formato de la key, así que no se puede usar para
 * leer adjuntos del chat ni otras carpetas.
 *
 * Cache larga e immutable: la key lleva un uuid, nunca cambia de contenido.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  try {
    const { key } = await params;
    const path = (key ?? []).join('/');

    if (!isProductImageKey(path)) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    }

    const upstream = await getObject(path);
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('[MEDIA_PRODUCT]', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'No se pudo leer la imagen' }, { status: 500 });
  }
}
