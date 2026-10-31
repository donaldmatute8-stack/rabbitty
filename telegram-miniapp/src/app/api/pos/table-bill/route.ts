import { NextResponse } from 'next/server';
import { restaurantDb } from '@/db/restaurant';
import { orders, orderItems } from '@rabbitty/database-restaurant/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/serverAuth';

export async function GET(req: Request) {
  try {
    // Cuenta de mesa = dato del comensal en el local; requiere sesión
    const caller = await getAuthenticatedUser(req).catch(() => null);
    if (!caller) {
      return NextResponse.json({ success: false, error: 'Sin sesión' }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const tableId = searchParams.get('tableId');

    if (!tableId) {
      return NextResponse.json({ success: false, error: 'tableId is required' }, { status: 400 });
    }

    // Cuenta de la mesa: TODAS las comandas PENDING de la mesa (p. ej. si un
    // comensal no reclamo y el staff abrió orden aparte, la cuenta real es la
    // suma de ambas).
    const activeOrders = await restaurantDb
      .select()
      .from(orders)
      .where(and(eq(orders.tableId, tableId), eq(orders.status, 'PENDING')));

    // (desc para scoping/descarte determinista)
    activeOrders.sort((a, b) => (b.createdAt ? b.createdAt.getTime() : 0) - (a.createdAt ? a.createdAt.getTime() : 0));

    if (activeOrders.length === 0) {
      return NextResponse.json({ success: true, hasActiveOrder: false });
    }
    const activeOrder = activeOrders[0];

    // Scoping: solo el comensal que reclama la mesa consulta esta cuenta
    const { tableSessions } = await import('@rabbitty/database-restaurant/schema');
    const [session] = await restaurantDb
      .select()
      .from(tableSessions)
      .where(and(eq(tableSessions.tableId, tableId), eq(tableSessions.status, 'OPEN')))
      .limit(1);
    const owns = session?.customerId === caller.id || activeOrders.some((o) => o.customerId === caller.id);
    if (!owns) {
      return NextResponse.json({ success: false, error: 'Esta cuenta pertenece a otro comensal' }, { status: 403 });
    }

    // Items (con nombre) de todas las comandas pending de la mesa
    const { menuItems } = await import('@rabbitty/database-restaurant/schema');
    const itemsRaw = await restaurantDb
      .select()
      .from(orderItems)
      .where(inArray(orderItems.orderId, activeOrders.map((o) => o.id)));
    const nameCache = new Map<string, string>();
    const items = [];
    for (const it of itemsRaw) {
      if (!nameCache.has(it.menuItemId)) {
        const [mi] = await restaurantDb.select({ name: menuItems.name }).from(menuItems).where(eq(menuItems.id, it.menuItemId)).limit(1);
        nameCache.set(it.menuItemId, mi?.name ?? '');
      }
      items.push({ ...it, name: nameCache.get(it.menuItemId) || it.menuItemId });
    }

    return NextResponse.json({
      success: true,
      hasActiveOrder: true,
      order: activeOrder,
      // total agregado de todas las comandas pending de la mesa (propinas incl.)
      total: activeOrders.reduce((s, o) => s + Number(o.total || 0), 0),
      items,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
