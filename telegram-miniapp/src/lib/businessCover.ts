/**
 * ── businessCover ── ÚNICA FUENTE de la portada de un negocio (H-COVER-SSOT).
 *
 * Regla: la portada SIEMPRE sale de `ownedBusinesses.gallery[0]` (lo que el
 * afiliado sube). Si no hay galería, se usa un pool temático determinista por
 * categoría + id (nunca cambia al refrescar). TODOS los consumidores —feed,
 * página del afiliado, API de negocio, OG/share— deben resolver por aquí para
 * que subir la cover se refleje en TODAS partes a la vez.
 *
 * Cuando exista la columna `coverImageUrl` en prod, se agrega como prioridad
 * #1 en este único lugar y todos los consumidores la heredan.
 */

export const BUSINESS_COVER_WIDTH = 1200;

/** Portada neutra final (si la categoría no tiene pool). */
export const DEFAULT_BUSINESS_COVER =
  'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1200&q=85';

/** Pool temático por categoría (determinista por businessId). */
const THEME_COVERS: Record<string, string[]> = {
  cafe: [
    'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1200&q=85', // Artisan coffee bar
    'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1200&q=85', // Bright cozy café
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=85', // Espresso machine vibe
  ],
  bar: [
    'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=85', // Modern craft bar
    'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?auto=format&fit=crop&w=1200&q=85', // Speakeasy cocktail lounge
  ],
  mariscos: [
    'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=1200&q=85', // Fresh seafood dishes
    'https://images.unsplash.com/photo-1559737558-245cb3842c67?auto=format&fit=crop&w=1200&q=85', // Coastal restaurant
  ],
  pizza: [
    'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1200&q=85', // Neapolitan pizza oven
    'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=1200&q=85', // Rustic pizzeria
  ],
  tacos: [
    'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=1200&q=85', // Mexican street food tacos
    'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?auto=format&fit=crop&w=1200&q=85', // Gourmet taco bar
  ],
  burger: [
    'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1200&q=85', // Gourmet burger joint
    'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1200&q=85', // Smash burger kitchen
  ],
  barberia: [
    'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=85', // Barber lounge
    'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=1200&q=85', // Classic barbershop
  ],
  fitness: [
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=85', // Training studio
    'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=1200&q=85', // Gym & wellness
  ],
};

/** Parsea `gallery` (jsonb/string/comas/url directa) sin romper con basura. */
export function parseGallery(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
  }
  if (typeof raw !== 'string') return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
    }
    if (typeof parsed === 'string' && parsed.startsWith('http')) return [parsed];
  } catch {
    /* no era JSON: puede ser url directa o lista separada por comas */
  }
  if (trimmed.startsWith('http')) {
    return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function pickThemeCover(category: string | null | undefined, businessId: string): string {
  const cat = (category || '').toLowerCase();
  let pool = THEME_COVERS.cafe;
  if (cat.includes('bar') || cat.includes('copas') || cat.includes('cervez')) pool = THEME_COVERS.bar;
  else if (cat.includes('marisco') || cat.includes('pescad') || cat.includes('seafood')) pool = THEME_COVERS.mariscos;
  else if (cat.includes('pizza') || cat.includes('pasta') || cat.includes('italian')) pool = THEME_COVERS.pizza;
  else if (cat.includes('taco') || cat.includes('mexic')) pool = THEME_COVERS.tacos;
  else if (cat.includes('hamburg') || cat.includes('burger')) pool = THEME_COVERS.burger;
  else if (cat.includes('barber') || cat.includes('salon') || cat.includes('corte')) pool = THEME_COVERS.barberia;
  else if (cat.includes('gym') || cat.includes('fit') || cat.includes('entrena') || cat.includes('crossfit')) pool = THEME_COVERS.fitness;

  let hash = 0;
  for (let i = 0; i < businessId.length; i++) {
    hash = (hash << 5) - hash + businessId.charCodeAt(i);
    hash |= 0;
  }
  return pool[Math.abs(hash) % pool.length] ?? DEFAULT_BUSINESS_COVER;
}

/**
 * Resuelve la portada de un negocio.
 * Prioridad: coverImageUrl explícita → gallery[0] → pool temático por categoría.
 */
export function resolveBusinessCover(input: {
  id: string;
  gallery?: unknown;
  category?: string | null;
  coverImageUrl?: string | null;
}): string {
  const explicit = typeof input.coverImageUrl === 'string' ? input.coverImageUrl.trim() : '';
  if (explicit.startsWith('http')) return explicit;

  const gallery = parseGallery(input.gallery);
  const first = gallery[0];
  if (first && first.startsWith('http')) return first;

  return pickThemeCover(input.category, input.id);
}
