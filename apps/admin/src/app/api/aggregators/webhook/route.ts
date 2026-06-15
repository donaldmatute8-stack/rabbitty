import { NextResponse } from "next/server";
import { getRestaurantDb } from "../../../../../../../packages/api/src/db";
import { orders, orderItems } from "@rabbitty/database-restaurant/schema";
import { bus, EventTypes } from "@rabbitty/events";

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const branchId = new URL(req.url).searchParams.get("branchId");

    if (!branchId) {
      return NextResponse.json({ error: "Missing branchId" }, { status: 400 });
    }

    // Mocking the restaurant DB connection injection (En un entorno real usaríamos el pool correcto)
    const db = await getRestaurantDb(); // Mock function call for architecture
    
    // 1. Mapear la orden de UberEats al esquema Rabbitty
    const uberOrder = payload; // Ej: { id: "UE-123", items: [...], total: 200, ... }
    
    // 2. Insertar en Rabbitty DB
    const [newOrder] = await db.insert(orders).values({
      branchId,
      orderType: "DELIVERY", // O TAKE_OUT
      status: "PENDING",
      subtotal: uberOrder.subtotal || 0,
      total: uberOrder.total || 0,
      notes: `UberEats Order #${uberOrder.id}`,
    }).returning();

    // 3. Insertar Items
    if (uberOrder.items && Array.isArray(uberOrder.items)) {
      await db.insert(orderItems).values(
        uberOrder.items.map((item: any) => ({
          orderId: newOrder.id,
          menuItemId: item.mappedId || "unknown", // Idealmente mapeado al ID de rabbitty
          quantity: item.quantity || 1,
          unitPrice: item.price || 0,
          totalPrice: (item.price || 0) * (item.quantity || 1),
        }))
      );
    }

    // 4. Emitir evento para el KDS (Kitchen Display System)
    bus.emit(EventTypes.ORDER_CREATED, {
      branchId,
      orderId: newOrder.id,
      source: "UBER_EATS"
    });

    return NextResponse.json({ success: true, message: "Order injected to POS and KDS successfully", orderId: newOrder.id });
  } catch (error: any) {
    console.error("Aggregator Webhook Error:", error);
    return NextResponse.json({ error: "Failed to process aggregator webhook" }, { status: 500 });
  }
}
