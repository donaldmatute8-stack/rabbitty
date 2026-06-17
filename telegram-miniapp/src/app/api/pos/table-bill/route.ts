import { NextResponse } from 'next/server';
import { restaurantDb } from '@/db/restaurant';
import { orders, orderItems } from '@rabbitty/database-restaurant/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tableId = searchParams.get('tableId');

    if (!tableId) {
      return NextResponse.json({ success: false, error: 'tableId is required' }, { status: 400 });
    }

    // Find the latest PENDING order for this table
    const [activeOrder] = await restaurantDb
      .select()
      .from(orders)
      .where(and(eq(orders.tableId, tableId), eq(orders.status, 'PENDING')))
      .orderBy(orders.createdAt)
      .limit(1);

    if (!activeOrder) {
      return NextResponse.json({ success: true, hasActiveOrder: false });
    }

    // Fetch order items
    const items = await restaurantDb
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, activeOrder.id));

    return NextResponse.json({
      success: true,
      hasActiveOrder: true,
      order: activeOrder,
      items
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
