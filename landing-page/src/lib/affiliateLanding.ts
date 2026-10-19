import { sql } from './db';

export interface AffiliateLandingData {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string | null;
  address: string;
  lat: number;
  lng: number;
  logoUrl: string | null;
  gallery: string[];
  rewardPercentage: number;
  startTime: string;
  endTime: string;
  menuItems: Array<{
    id: string;
    name: string;
    description: string | null;
    price: number;
    imageUrl: string | null;
  }>;
}

export const RESERVED_SLUGS = new Set([
  'api',
  'admin',
  'app',
  'auth',
  'www',
  'mail',
  'status',
  'docs',
  'dev',
  'staging',
  'blog',
  'support',
  'help',
  'download',
  'privacy',
  'whitepaper',
]);

export function isValidSlug(slug: string): boolean {
  if (!slug || slug.length < 3 || slug.length > 40) return false;
  if (RESERVED_SLUGS.has(slug.toLowerCase())) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

export async function getAffiliateBySlug(slug: string): Promise<AffiliateLandingData | null> {
  const normalizedSlug = slug.toLowerCase().trim();
  if (!isValidSlug(normalizedSlug)) return null;

  if (!sql) {
    // Fallback static mock for 626cafe if database not configured
    if (normalizedSlug === '626cafe') {
      return {
        id: '626cafe',
        name: '626 Café',
        slug: '626cafe',
        category: 'Cafetería de Especialidad',
        description: 'Café de especialidad, desayunos artesanales, panadería francesa y ambiente relajado en el corazón de la ciudad.',
        address: 'Calle Libertad 626, Centro',
        lat: 19.4326,
        lng: -99.1332,
        logoUrl: '/icon_ra.png',
        gallery: [
          'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80',
          'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=800&q=80',
        ],
        rewardPercentage: 20,
        startTime: '08:00',
        endTime: '20:00',
        menuItems: [
          { id: '1', name: 'Flat White Doble', description: 'Espresso doble y leche micro-texturizada.', price: 65, imageUrl: null },
          { id: '2', name: 'Croissant Mantequilla', description: 'Panadería fresca del día.', price: 48, imageUrl: null },
          { id: '3', name: 'Capuccino Red Velvet', description: 'Receta signature con cacao y toque de frutos rojos.', price: 75, imageUrl: null },
        ],
      };
    }
    return null;
  }

  try {
    const businesses = await sql`
      SELECT 
        id, 
        name, 
        slug, 
        category, 
        description, 
        address, 
        lat, 
        lng, 
        "logoUrl", 
        gallery, 
        "rewardPercentage", 
        "startTime", 
        "endTime"
      FROM "ownedBusinesses"
      WHERE slug = ${normalizedSlug}
        AND ("status" = 'active' OR "status" IS NULL)
      LIMIT 1;
    `;

    if (!businesses || businesses.length === 0) {
      // In development or demo mode, if database has no record for 626cafe, fallback to official pilot
      if (normalizedSlug === '626cafe') {
        return {
          id: '626cafe',
          name: '626 Café',
          slug: '626cafe',
          category: 'Cafetería de Especialidad',
          description: 'Café de especialidad, desayunos artesanales, panadería francesa y ambiente relajado en el corazón de la ciudad.',
          address: 'Calle Libertad 626, Centro',
          lat: 19.4326,
          lng: -99.1332,
          logoUrl: '/icon_ra.png',
          gallery: [
            'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=800&q=80',
          ],
          rewardPercentage: 20,
          startTime: '08:00',
          endTime: '20:00',
          menuItems: [
            { id: '1', name: 'Flat White Doble', description: 'Espresso doble y leche micro-texturizada.', price: 65, imageUrl: null },
            { id: '2', name: 'Croissant Mantequilla', description: 'Panadería fresca del día.', price: 48, imageUrl: null },
            { id: '3', name: 'Capuccino Red Velvet', description: 'Receta signature con cacao y toque de frutos rojos.', price: 75, imageUrl: null },
          ],
        };
      }
      return null;
    }
    const b = businesses[0];

    let parsedGallery: string[] = [];
    try {
      parsedGallery = b.gallery ? (typeof b.gallery === 'string' ? JSON.parse(b.gallery) : b.gallery) : [];
    } catch {
      parsedGallery = [];
    }

    // Strictly isolated query for menu items belonging exclusively to this business
    let menuItems: Array<{ id: string; name: string; description: string | null; price: number; imageUrl: string | null }> = [];
    try {
      const items = await sql`
        SELECT mi.id, mi.name, mi.description, mi.price, mi."imageUrl"
        FROM menu_items mi
        JOIN branches br ON mi."branchId" = br.id
        JOIN restaurants r ON br."restaurantId" = r.id
        WHERE r."businessId" = ${b.id}
          AND mi."isActive" = true
        ORDER BY mi."sortOrder" ASC, mi.name ASC
        LIMIT 25;
      `;
      menuItems = items.map(i => ({
        id: String(i.id),
        name: String(i.name),
        description: i.description ? String(i.description) : null,
        price: Number(i.price),
        imageUrl: i.imageUrl ? String(i.imageUrl) : null,
      }));
    } catch {
      menuItems = [];
    }

    return {
      id: String(b.id),
      name: String(b.name),
      slug: String(b.slug),
      category: String(b.category || 'Comercio Local'),
      description: b.description ? String(b.description) : null,
      address: String(b.address || ''),
      lat: Number(b.lat || 19.4326),
      lng: Number(b.lng || -99.1332),
      logoUrl: b.logoUrl ? String(b.logoUrl) : null,
      gallery: parsedGallery,
      rewardPercentage: Number(b.rewardPercentage || 10),
      startTime: String(b.startTime || '09:00'),
      endTime: String(b.endTime || '21:00'),
      menuItems,
    };
  } catch (err) {
    console.error('[getAffiliateBySlug Error]:', err);
    return null;
  }
}
