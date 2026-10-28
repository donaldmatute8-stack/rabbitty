import { NextResponse } from 'next/server';
import { db } from '@/db';
import {
  ownedBusinesses,
  restaurants,
  branches,
  menuCategories,
  menuItems,
  menuItemModifiers,
  tables,
} from '@/db/schema';
import { eq, and, asc } from 'drizzle-orm';

interface BranchRecord {
  id: string;
  restaurantId: string;
  name: string;
  address: string;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  cashDropEnabled: boolean;
  cashDropThreshold: number;
  isActive: boolean;
}

interface TableRecord {
  id: string;
  branchId: string;
  number: number;
  capacity: number;
  location: string | null;
  qrCode: string | null;
  isActive: boolean;
}

interface CategoryWithItems {
  id: string;
  name: string;
  description: string | null;
  items: unknown[];
}

function normalizeToPercent(rate: number | null | undefined): number | null {
  if (rate == null) return null;
  if (rate > 0 && rate < 1) return Math.round(rate * 100);
  return Math.round(rate);
}

function resolveCoverImage(galleryRaw: string | null | undefined, category: string | null | undefined, businessId: string): string {
  // 1. Probar parsing de galería
  if (galleryRaw) {
    try {
      const parsed = JSON.parse(galleryRaw);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string' && parsed[0].startsWith('http')) {
        return parsed[0];
      }
    } catch {
      // Puede venir como string delimitado por comas o url directa
      if (galleryRaw.startsWith('http')) {
        return galleryRaw.split(',')[0].trim();
      }
    }
  }

  // 2. Mapas de portadas dinámicas temáticas en alta calidad según categoría
  const cat = (category || '').toLowerCase();
  const themeCovers: Record<string, string[]> = {
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

  let pool = themeCovers.cafe;
  if (cat.includes('bar') || cat.includes('copas') || cat.includes('cervez')) pool = themeCovers.bar;
  else if (cat.includes('marisco') || cat.includes('pescad') || cat.includes('seafood')) pool = themeCovers.mariscos;
  else if (cat.includes('pizza') || cat.includes('pasta') || cat.includes('italian')) pool = themeCovers.pizza;
  else if (cat.includes('taco') || cat.includes('mexic')) pool = themeCovers.tacos;
  else if (cat.includes('hamburg') || cat.includes('burger')) pool = themeCovers.burger;
  else if (cat.includes('barber') || cat.includes('salon') || cat.includes('corte')) pool = themeCovers.barberia;
  else if (cat.includes('gym') || cat.includes('fit') || cat.includes('entrena')) pool = themeCovers.fitness;

  // Selección determinista basada en el businessId para evitar cambios al refrescar
  let hash = 0;
  for (let i = 0; i < businessId.length; i++) {
    hash = (hash << 5) - hash + businessId.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % pool.length;
  return pool[index];
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const businessId = resolvedParams.id;

    let business = await db.query.ownedBusinesses.findFirst({
      where: eq(ownedBusinesses.id, businessId)
    });

    if (!business) {
      business = await db.query.ownedBusinesses.findFirst({
        where: eq(ownedBusinesses.slug, businessId)
      });
    }

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Try finding direct restaurant profile, with graceful fallback to pilot restaurant if F&B
    let restaurant = await db.query.restaurants.findFirst({
      where: eq(restaurants.businessId, businessId)
    });

    const isFoodAndBeverage = ['restaurant', 'cafeteria', 'cafe', 'bar', 'alimentos', 'comida', 'mariscos'].some(k => 
      (business.category || '').toLowerCase().includes(k)
    );

    if (!restaurant && isFoodAndBeverage) {
      restaurant = await db.query.restaurants.findFirst({
        where: eq(restaurants.businessId, 'rabbitty-main')
      });
    }

    let primaryBranch: BranchRecord | null = null;
    let categoriesWithItems: CategoryWithItems[] = [];
    let branchTables: TableRecord[] = [];

    if (restaurant) {
      const foundBranch = await db.query.branches.findFirst({
        where: and(
          eq(branches.restaurantId, restaurant.id),
          eq(branches.isActive, true)
        )
      });
      primaryBranch = (foundBranch as BranchRecord) || null;

      if (primaryBranch) {
        // Fetch categories for this branch
        const categories = await db.query.menuCategories.findMany({
          where: and(
            eq(menuCategories.branchId, primaryBranch.id),
            eq(menuCategories.isActive, true)
          ),
          orderBy: [asc(menuCategories.sortOrder), asc(menuCategories.name)]
        });

        // Fetch items for this branch
        const items = await db.query.menuItems.findMany({
          where: and(
            eq(menuItems.branchId, primaryBranch.id),
            eq(menuItems.isActive, true)
          ),
          orderBy: [asc(menuItems.sortOrder), asc(menuItems.name)]
        });

        // Fetch modifiers
        const allModifiers = await db.query.menuItemModifiers.findMany({
          orderBy: [asc(menuItemModifiers.sortOrder)]
        });

        type ModifierItem = typeof allModifiers[number];
        const modifiersByItemId = new Map<string, ModifierItem[]>();
        for (const mod of allModifiers) {
          if (!modifiersByItemId.has(mod.itemId)) {
            modifiersByItemId.set(mod.itemId, []);
          }
          modifiersByItemId.get(mod.itemId)?.push(mod);
        }

        type MenuItemRecord = typeof items[number] & { modifiers: ModifierItem[] };
        const itemsByCatId = new Map<string, MenuItemRecord[]>();
        for (const item of items) {
          const itemMods = modifiersByItemId.get(item.id) || [];
          const itemPayload: MenuItemRecord = {
            ...item,
            modifiers: itemMods
          };
          if (!itemsByCatId.has(item.categoryId)) {
            itemsByCatId.set(item.categoryId, []);
          }
          itemsByCatId.get(item.categoryId)?.push(itemPayload);
        }

        categoriesWithItems = categories.map(cat => ({
          id: cat.id,
          name: cat.name,
          description: cat.description,
          items: itemsByCatId.get(cat.id) || []
        }));

        // Fetch tables for table QR context
        const foundTables = await db.query.tables.findMany({
          where: and(
            eq(tables.branchId, primaryBranch.id),
            eq(tables.isActive, true)
          ),
          orderBy: [asc(tables.number)]
        });
        branchTables = (foundTables as TableRecord[]) || [];
      }
    }

    // Default sample services for non-F&B businesses (barbershop, gym, studios, etc.)
    const isServiceOrWellness = ['barberia', 'salon', 'spa', 'gimnasio', 'fitness', 'arte', 'tatuajes', 'servicios'].some(k => 
      (business.category || '').toLowerCase().includes(k)
    );

    if (categoriesWithItems.length === 0 && isServiceOrWellness) {
      categoriesWithItems = [
        {
          id: 'cat-servicios-principales',
          name: 'Servicios Principales',
          description: 'Servicios profesionales y citas disponibles',
          items: [
            {
              id: 'srv-1',
              name: 'Servicio Signature / Sesión Pro',
              description: 'Atención personalizada, diagnóstico y experiencia premium de la casa.',
              price: 350,
              imageUrl: null,
              isActive: true,
              isAvailable: true,
              modifiers: [
                { id: 'mod-1', name: 'Sesión Estándar (45 min)', type: 'SELECT', priceAdjust: 0 },
                { id: 'mod-2', name: 'Sesión Completa Deluxe (+30 min)', type: 'SELECT', priceAdjust: 150 }
              ]
            },
            {
              id: 'srv-2',
              name: 'Mantenimiento & Retoque Exprés',
              description: 'Revisión rápida para mantener tu mejor versión en menos de 30 minutos.',
              price: 180,
              imageUrl: null,
              isActive: true,
              isAvailable: true,
              modifiers: []
            }
          ]
        }
      ];
    }

    const hasStructuredMenu = categoriesWithItems.length > 0;

    const capabilities = {
      menuEnabled: hasStructuredMenu || isFoodAndBeverage,
      digitalOrderingEnabled: hasStructuredMenu && (primaryBranch !== null || isFoodAndBeverage),
      tableServiceEnabled: branchTables.length > 0,
      reservationsEnabled: true,
      appointmentBookingEnabled: isServiceOrWellness,
      loyaltyEnabled: business.givesBunz || business.acceptsBunz,
      moodEnabled: true,
    };

    // Single Source of Truth para el Cashback:
    // 1. Si el restaurante tiene defaultRewardRate configurado en Admin/POS, tiene prioridad.
    // 2. Si no, ownedBusinesses.rewardPercentage.
    // 3. Fallback a 15%.
    const effectiveRewardRate =
      normalizeToPercent(restaurant?.defaultRewardRate) ??
      normalizeToPercent(business.rewardPercentage) ??
      15;

    const coverImageUrl = resolveCoverImage(business.gallery, business.category, business.id);

    const unifiedBusiness = {
      ...business,
      rewardPercentage: effectiveRewardRate,
      coverImageUrl,
    };

    const unifiedRestaurant = restaurant ? {
      ...restaurant,
      defaultRewardRate: effectiveRewardRate,
    } : null;

    return NextResponse.json({
      success: true,
      business: unifiedBusiness,
      restaurant: unifiedRestaurant,
      primaryBranch: primaryBranch || null,
      categories: categoriesWithItems,
      tables: branchTables,
      capabilities
    });
  } catch (error) {
    console.error('Fetch Business By ID Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
