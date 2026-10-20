import { sql } from './db';

export interface MenuItemData {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  category?: string;
  badge?: string;
  rewardBunz?: number;
}

export interface AffiliateLandingData {
  id: string;
  name: string;
  slug: string;
  category: string;
  tagline?: string;
  description: string | null;
  story?: string;
  address: string;
  city?: string;
  phone?: string;
  lat: number;
  lng: number;
  logoUrl: string | null;
  heroImage: string;
  gallery: string[];
  rewardPercentage: number;
  welcomeBunz?: number;
  startTime: string;
  endTime: string;
  templateStyle: 'editorial' | 'urban' | 'minimal';
  primaryColor?: string;
  accentColor?: string;
  features: {
    hasTableOrdering: boolean;
    hasTakeaway: boolean;
    hasReservations: boolean;
    hasRewards: boolean;
  };
  menuItems: MenuItemData[];
  ambienceTags?: string[];
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
        category: 'Cafetería de Especialidad & Tostaduría',
        tagline: 'Donde cada taza cuenta una historia de origen.',
        description: 'Tostaduría de café de especialidad y panadería de masa madre en el corazón de la ciudad. Espacio acústicamente curado para enfoque, lectura y buena conversación.',
        story: 'Nacimos con la convicción de que el buen café no tiene prisa. Seleccionamos granos de origen único cosechados a más de 1,400 metros de altura en Chiapas y Veracruz, tostados semanalmente en pequeños lotes para preservar sus notas florales y frutales.',
        address: 'Av. Lázaro Cárdenas #74, Zona Dorada',
        city: 'Bucerías, Nayarit',
        phone: '+52 322 102 3028',
        lat: 20.7567,
        lng: -105.3341,
        logoUrl: '/logos/626cafe-logo.png',
        heroImage: '/626cafe-hero.jpg',
        gallery: [
          '/626cafe-hero.jpg',
          '/menu-flatwhite.jpg',
          '/menu-croissant.jpg',
          'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=800&q=80',
        ],
        rewardPercentage: 15,
        welcomeBunz: 25,
        startTime: '08:00',
        endTime: '20:00',
        templateStyle: 'editorial',
        primaryColor: '#2C1810',
        accentColor: '#D97706',
        features: {
          hasTableOrdering: true,
          hasTakeaway: true,
          hasReservations: false, // Honest: no reservations for specialty coffee
          hasRewards: true,
        },
        ambienceTags: ['Café de Especialidad', 'Pet Friendly', 'Wi-Fi Alta Velocidad', 'Música Lofi & Acústica', 'Masa Madre'],
        menuItems: [
          {
            id: '1',
            name: 'Flat White Doble',
            category: 'Café Caliente',
            description: 'Extracción doble de espresso origen Chiapas con leche microtexturizada en cerámica artesanal.',
            price: 65,
            imageUrl: '/menu-flatwhite.jpg',
            badge: 'Favorito de la Casa',
            rewardBunz: 10,
          },
          {
            id: '2',
            name: 'Croissant Francés de Mantequilla',
            category: 'Panadería Artesanal',
            description: 'Hojaldre tradicional fermentado 48 horas con mantequilla pura de rancho. Horneado al amanecer.',
            price: 48,
            imageUrl: '/menu-croissant.jpg',
            badge: 'Horneado Diario',
            rewardBunz: 7,
          },
          {
            id: '3',
            name: 'Capuccino Red Velvet',
            category: 'Signature',
            description: 'Receta de autor con cacao tabasqueño orgánico, toque de frutos rojos silvestres y canela.',
            price: 75,
            imageUrl: '/menu-cappuccino.jpg',
            badge: 'Especial de Temporada',
            rewardBunz: 12,
          },
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
        AND ("status" = 'APPROVED' OR "status" = 'ACTIVE' OR "status" = 'active' OR "status" IS NULL)
      LIMIT 1;
    `;

    if (!businesses || businesses.length === 0) {
      // In development or demo mode, if database has no record for 626cafe, fallback to official pilot
      if (normalizedSlug === '626cafe') {
        return {
          id: '626cafe',
          name: '626 Café',
          slug: '626cafe',
          category: 'Cafetería de Especialidad & Tostaduría',
          tagline: 'Donde cada taza cuenta una historia de origen.',
          description: 'Tostaduría de café de especialidad y panadería de masa madre en el corazón de la ciudad. Espacio acústicamente curado para enfoque, lectura y buena conversación.',
          story: 'Nacimos con la convicción de que el buen café no tiene prisa. Seleccionamos granos de origen único cosechados a más de 1,400 metros de altura en Chiapas y Veracruz, tostados semanalmente en pequeños lotes para preservar sus notas florales y frutales.',
          address: 'Av. Lázaro Cárdenas #74, Zona Dorada',
          city: 'Bucerías, Nayarit',
          phone: '+52 322 102 3028',
          lat: 20.7567,
          lng: -105.3341,
          logoUrl: '/logos/626cafe-logo.png',
          heroImage: '/626cafe-hero.jpg',
          gallery: [
            '/626cafe-hero.jpg',
            '/menu-flatwhite.jpg',
            '/menu-croissant.jpg',
            'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=800&q=80',
          ],
          rewardPercentage: 15,
          welcomeBunz: 25,
          startTime: '08:00',
          endTime: '20:00',
          templateStyle: 'editorial',
          primaryColor: '#2C1810',
          accentColor: '#D97706',
          features: {
            hasTableOrdering: true,
            hasTakeaway: true,
            hasReservations: false,
            hasRewards: true,
          },
          ambienceTags: ['Café de Especialidad', 'Pet Friendly', 'Wi-Fi Alta Velocidad', 'Música Lofi & Acústica', 'Masa Madre'],
          menuItems: [
            {
              id: '1',
              name: 'Flat White Doble',
              category: 'Café Caliente',
              description: 'Extracción doble de espresso origen Chiapas con leche microtexturizada en cerámica artesanal.',
              price: 65,
              imageUrl: '/menu-flatwhite.jpg',
              badge: 'Favorito de la Casa',
              rewardBunz: 10,
            },
            {
              id: '2',
              name: 'Croissant Francés de Mantequilla',
              category: 'Panadería Artesanal',
              description: 'Hojaldre tradicional fermentado 48 horas con mantequilla pura de rancho. Horneado al amanecer.',
              price: 48,
              imageUrl: '/menu-croissant.jpg',
              badge: 'Horneado Diario',
              rewardBunz: 7,
            },
            {
              id: '3',
              name: 'Capuccino Red Velvet',
              category: 'Signature',
              description: 'Receta de autor con cacao tabasqueño orgánico, toque de frutos rojos silvestres y canela.',
              price: 75,
              imageUrl: '/menu-cappuccino.jpg',
              badge: 'Especial de Temporada',
              rewardBunz: 12,
            },
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

    // Determine template style dynamically based on category
    const catLower = (b.category || '').toLowerCase();
    const templateStyle: 'editorial' | 'urban' | 'minimal' = 
      catLower.includes('gym') || catLower.includes('barber') || catLower.includes('spa') || catLower.includes('wellness')
        ? 'minimal'
        : catLower.includes('bar') || catLower.includes('burger') || catLower.includes('pizza') || catLower.includes('night')
        ? 'urban'
        : 'editorial';

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
      tagline: b.description ? String(b.description).slice(0, 80) : undefined,
      description: b.description ? String(b.description) : null,
      story: b.description ? String(b.description) : undefined,
      address: String(b.address || ''),
      city: 'México',
      phone: undefined,
      lat: Number(b.lat || 19.4326),
      lng: Number(b.lng || -99.1332),
      logoUrl: b.logoUrl ? String(b.logoUrl) : null,
      heroImage: parsedGallery[0] || b.logoUrl || '/hero-bg.png',
      gallery: parsedGallery,
      rewardPercentage: Number(b.rewardPercentage || 10),
      welcomeBunz: 25,
      startTime: String(b.startTime || '09:00'),
      endTime: String(b.endTime || '21:00'),
      templateStyle,
      features: {
        hasTableOrdering: true,
        hasTakeaway: true,
        hasReservations: false,
        hasRewards: Number(b.rewardPercentage || 0) > 0,
      },
      menuItems,
      ambienceTags: [b.category || 'Comercio Local', 'Pago con Bunz', 'Comunidad Rabbitty'],
    };
  } catch (err) {
    console.error('[getAffiliateBySlug Error]:', err);
    return null;
  }
}
