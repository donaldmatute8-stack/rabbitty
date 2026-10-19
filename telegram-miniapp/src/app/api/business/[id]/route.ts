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

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const businessId = resolvedParams.id;

    const business = await db.query.ownedBusinesses.findFirst({
      where: eq(ownedBusinesses.id, businessId)
    });

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

    return NextResponse.json({
      success: true,
      business,
      restaurant: restaurant || null,
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
