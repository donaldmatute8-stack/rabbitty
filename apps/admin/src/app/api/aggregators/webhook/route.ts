import { NextResponse } from "next/server";
import { getRestaurantDb } from "../../../../../../../packages/api/src/db";
import { orders, orderItems } from "@rabbitty/database-restaurant/schema";
import { bus, EventTypes } from "@rabbitty/events";
import { z } from "zod";

const webhookSchema = z.object({
  id: z.string(),
  subtotal: z.number(),
  total: z.number(),
  items: z.array(z.object({
    mappedId: z.string().optional(),
    name: z.string().optional(),
    quantity: z.number().int().positive(),
    price: z.number().nonnegative()
  }))
});

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ") || authHeader.split(" ")[1] !== process.env.AGGREGATOR_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await req.json();
    const branchId = new URL(req.url).searchParams.get("branchId");

    if (!branchId) {
      return NextResponse.json({ error: "Missing branchId" }, { status: 400 });
    }

    const validationResult = webhookSchema.safeParse(payload);
    if (!validationResult.success) {
      return NextResponse.json({ error: "Invalid payload format", details: validationResult.error.format() }, { status: 400 });
    }
    const uberOrder = validationResult.data;

    const db = await getRestaurantDb();
    
    // 2. Insertar en Rabbitty DB
    const [newOrder] = await db.insert(orders).values({
      branchId,
      orderType: "DELIVERY",
      status: "PENDING",
      subtotal: uberOrder.subtotal,
      total: uberOrder.total,
      notes: `Aggregator Order #${uberOrder.id}`,
    }).returning();

    // 3. Insertar Items
    if (uberOrder.items.length > 0) {
      // Find default unmapped item or map correctly
      await db.insert(orderItems).values(
        uberOrder.items.map((item) => ({
          orderId: newOrder.id,
          menuItemId: item.mappedId || "00000000-0000-0000-0000-000000000000", // Fallback ID o genérico
          quantity: item.quantity,
          unitPrice: item.price,
          totalPrice: item.price * item.quantity,
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
