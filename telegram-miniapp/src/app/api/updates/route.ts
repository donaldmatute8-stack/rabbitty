import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { updatePosts } from '@/db/schema';

export const runtime = 'nodejs';

/**
 * Update Log público (solo lectura).
 *
 * GET /api/updates           → lista de novedades publicadas
 * GET /api/updates?slug=...  → una novedad por slug
 *
 * El contenido lo inyecta el equipo con `scripts/update-log.mjs`. Aquí no hay
 * escritura: la app solo lee.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    const limitParam = Number(searchParams.get('limit'));
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 50;

    if (slug) {
      const [post] = await db
        .select()
        .from(updatePosts)
        .where(and(eq(updatePosts.slug, slug), eq(updatePosts.status, 'PUBLISHED')))
        .limit(1);
      if (!post) return NextResponse.json({ error: 'Novedad no encontrada' }, { status: 404 });
      return NextResponse.json({ success: true, post });
    }

    const posts = await db
      .select({
        slug: updatePosts.slug,
        version: updatePosts.version,
        title: updatePosts.title,
        summary: updatePosts.summary,
        category: updatePosts.category,
        tags: updatePosts.tags,
        coverUrl: updatePosts.coverUrl,
        publishedAt: updatePosts.publishedAt,
      })
      .from(updatePosts)
      .where(eq(updatePosts.status, 'PUBLISHED'))
      .orderBy(desc(updatePosts.publishedAt))
      .limit(limit);

    return NextResponse.json({ success: true, posts });
  } catch (error) {
    console.error('[UPDATES GET]', error);
    return NextResponse.json({ error: 'No se pudieron cargar las novedades' }, { status: 500 });
  }
}
