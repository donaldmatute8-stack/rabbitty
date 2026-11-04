import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { niches } from '@/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * ── GET /api/niches ── catálogo de nichos para el onboarding.
 * Viene de la tabla `niches` para poder añadir nichos nuevos sin tocar código.
 */
export async function GET() {
  try {
    const rows = await db
      .select({
        id: niches.id,
        name: niches.name,
        icon: niches.icon,
        capabilities: niches.capabilities,
      })
      .from(niches)
      .where(eq(niches.isActive, true))
      .orderBy(asc(niches.order));
    return NextResponse.json({ success: true, niches: rows });
  } catch (error) {
    console.error('[NICHES]', error);
    // Fallback mínimo: nunca romper el onboarding por un error de lectura.
    return NextResponse.json({
      success: true,
      niches: [
        { id: 'restaurant', name: 'Restaurante', icon: 'utensils', capabilities: {} },
        { id: 'cafe', name: 'Cafetería', icon: 'coffee', capabilities: {} },
        { id: 'other', name: 'Otro', icon: 'store', capabilities: {} },
      ],
    });
  }
}
