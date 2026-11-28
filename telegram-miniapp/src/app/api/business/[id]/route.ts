import { NextResponse } from 'next/server';
import { db } from '@/db';
import { restaurantDb } from '@/db/restaurant';
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
import { resolveBusinessCover } from '@/lib/businessCover';
import { getProductStockMap } from '@rabbitty/api/services/storeStock';
import { resolveOrderingStatus } from '@/lib/orderingStatus';

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

    const isFoodAndBeverage = ['restaurant', 'cafeteria', 'cafe', 'bar', 'alimentos', 'comida', 'mariscos'].some(k =>
      (business.category || '').toLowerCase().includes(k)
    );

    // El perfil del restaurante se busca por el ID REAL del negocio, no por el
    // parámetro de la URL: si llega el slug (`626cafe`) antes no encontraba su
    // restaurante y la ficha salía sin menú. En multi-tenant NO se cae a un
    // restaurante "piloto": cada negocio ve solo su propia carta.
    const restaurant = await restaurantDb.query.restaurants.findFirst({
      where: eq(restaurants.businessId, business.id)
    });

    let primaryBranch: BranchRecord | null = null;
    let categoriesWithItems: CategoryWithItems[] = [];
    let branchTables: TableRecord[] = [];

    if (restaurant) {
      // ── Sucursal de PRODUCCIÓN ──
      // El restaurante puede tener varias sucursales activas (incluida
      // "Modo Entrenamiento (Sandbox)") y alguna archivada. `findFirst` a secas
      // devolvía la que apareciera primero: el catálogo mostraba la carta de
      // Sandbox (sin productos de tienda) o la de una sucursal archivada.
      // Misma regla que el checkout y la cotización de envío.
      const allBranches = (await restaurantDb.query.branches.findMany({
        where: eq(branches.restaurantId, restaurant.id),
      })) as BranchRecord[];
      const activeBranches = allBranches.filter((b) => b.isActive !== false);
      const productionBranch =
        activeBranches.find((b) => !/sandbox|entrenamiento|prueba|test/i.test(b.name || '')) ??
        activeBranches[0] ??
        allBranches[0] ??
        null;
      primaryBranch = productionBranch;

      if (primaryBranch) {
        // Fetch categories for this branch
        const categories = await restaurantDb.query.menuCategories.findMany({
          where: and(
            eq(menuCategories.branchId, primaryBranch.id),
            eq(menuCategories.isActive, true)
          ),
          orderBy: [asc(menuCategories.sortOrder), asc(menuCategories.name)]
        });

        // Fetch items for this branch
        const items = await restaurantDb.query.menuItems.findMany({
          where: and(
            eq(menuItems.branchId, primaryBranch.id),
            eq(menuItems.isActive, true)
          ),
          orderBy: [asc(menuItems.sortOrder), asc(menuItems.name)]
        });

        // Fetch modifiers
        const allModifiers = await restaurantDb.query.menuItemModifiers.findMany({
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

        // ── Existencias de la tienda ──
        // Sólo los productos controlan stock (los platillos no). Es la misma
        // consulta que usa el admin y el invariante: receta contra inventario.
        const productIds = items.filter((item) => item.kind === 'PRODUCT').map((item) => item.id);
        const stockMap = productIds.length
          ? await getProductStockMap(restaurantDb, productIds).catch(() => new Map())
          : new Map();

        categoriesWithItems = categories.map(cat => ({
          id: cat.id,
          name: cat.name,
          description: cat.description,
          items: (itemsByCatId.get(cat.id) || []).map((item) => {
            const stock = stockMap.get(item.id);
            return stock
              ? { ...item, stock: stock.stock, lowStock: stock.lowStock }
              : item;
          })
        }));

        // Fetch tables for table QR context
        const foundTables = await restaurantDb.query.tables.findMany({
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
      // LITE no tiene POS que reciba el pedido: no se ofrece ordering.
      digitalOrderingEnabled: business.participationModel !== 'LITE'
        && hasStructuredMenu
        && (primaryBranch !== null || isFoodAndBeverage),
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

    const coverImageUrl = resolveBusinessCover({
      id: business.id,
      gallery: business.gallery,
      category: business.category,
    });

    const unifiedBusiness = {
      ...business,
      rewardPercentage: effectiveRewardRate,
      coverImageUrl,
    };

    const unifiedRestaurant = restaurant ? {
      ...restaurant,
      defaultRewardRate: effectiveRewardRate,
    } : null;

    // ¿Se puede pedir ahora? El cliente lo necesita ANTES de armar el carrito:
    // si el local está cerrado no debe escribir el pedido para descubrirlo al
    // final. Misma regla que usa `/api/pos/checkout`.
    const orderingBase = await resolveOrderingStatus(restaurantDb, {
      branchId: primaryBranch?.id ?? null,
      activeDays: business.activeDays,
      startTime: business.startTime,
      endTime: business.endTime,
      timezone: business.timezone,
    });
    // Un negocio LITE solo participa en Bunz (perfil, ofertas y canjes): no
    // tiene POS que reciba pedidos, así que la app no debe ofrecer "pedir".
    const ordering = business.participationModel === 'LITE'
      ? {
          ...orderingBase,
          canOrder: false,
          state: 'CLOSED' as const,
          scheduleOpen: false,
          cashShiftOpen: false,
          message: 'Este negocio no recibe pedidos desde la app; puedes canjear sus Bunz en el local.',
          tone: 'info' as const,
          nextOpenLabel: null,
        }
      : orderingBase;

    return NextResponse.json({
      success: true,
      business: unifiedBusiness,
      restaurant: unifiedRestaurant,
      primaryBranch: primaryBranch || null,
      categories: categoriesWithItems,
      tables: branchTables,
      capabilities,
      ordering,
    });
  } catch (error) {
    console.error('Fetch Business By ID Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
