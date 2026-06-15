import { NextResponse } from 'next/server';
import { restaurantDb } from '@/db/restaurant';
import { tables, menuItems, branches } from '@rabbitty/database-restaurant/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tableId = searchParams.get('tableId');

    if (!tableId) {
      return NextResponse.json({ success: false, error: 'tableId is required' }, { status: 400 });
    }

    const [table] = await restaurantDb.select().from(tables).where(eq(tables.id, tableId));

    if (!table) {
      return NextResponse.json({ success: false, error: 'Mesa no encontrada' }, { status: 404 });
    }

    const items = await restaurantDb.select().from(menuItems).where(
      and(
        eq(menuItems.branchId, table.branchId),
        eq(menuItems.isAvailable, true)
      )
    );

    return NextResponse.json({ success: true, items });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
