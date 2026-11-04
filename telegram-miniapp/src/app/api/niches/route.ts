import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { niches } from '@/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * ── GET /api/niches ── catálogo de nichos para el onboarding.
 *
 *  · Sin parámetros: solo nichos ACTIVOS (los que el POS ya cubre).
 *  · ?all=1: incluye los nichos conocidos pero aún NO soportados. Se usa en el
 *    formulario de solicitud para sugerir el giro y en Bunzy para tener contexto.
 *
 * Viene de la tabla `niches` para poder añadir nichos nuevos sin tocar código.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const includeAll = url.searchParams.get('all') === '1';

  try {
    const rows = await db
      .select({
        id: niches.id,
        name: niches.name,
        icon: niches.icon,
        description: niches.description,
        isActive: niches.isActive,
        capabilities: niches.capabilities,
      })
      .from(niches)
      .where(includeAll ? undefined : eq(niches.isActive, true))
      .orderBy(asc(niches.order));

    return NextResponse.json({ success: true, niches: rows });
  } catch (error) {
    console.error('[NICHES]', error);
    // Fallback mínimo: nunca romper el onboarding por un error de lectura.
    return NextResponse.json({
      success: true,
      niches: [
        { id: 'restaurant', name: 'Restaurante', icon: 'utensils', capabilities: {}, isActive: true },
        { id: 'cafe', name: 'Cafetería', icon: 'coffee', capabilities: {}, isActive: true },
      ],
    });
  }
}
