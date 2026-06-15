import { NextResponse } from 'next/server';
import { restaurantDb } from '@/db/restaurant';
import { orders, orderItems, tables } from '@rabbitty/database-restaurant/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tableId, items, paymentMethod } = body;
    
    // items es [{ id, quantity, price, name }]

    if (!tableId || !items || items.length === 0) {
      return NextResponse.json({ success: false, error: 'Datos inválidos' }, { status: 400 });
    }

    const [table] = await restaurantDb.select().from(tables).where(eq(tables.id, tableId));
    if (!table) return NextResponse.json({ success: false, error: 'Mesa no válida' }, { status: 404 });

    const totalAmount = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);

    // 1. Guardar la orden en la BD con estado PENDING
    const [newOrder] = await restaurantDb.insert(orders).values({
      branchId: table.branchId,
      tableId,
      subtotal: totalAmount,
      total: totalAmount,
      status: paymentMethod === 'BUNZ' ? 'PAID' : 'PENDING', // si es Bunz se descuenta directo (simplificado aquí)
      orderType: 'DINE_IN'
    }).returning();

    // 2. Guardar los items
    const orderItemsData = items.map((i: any) => ({
      orderId: newOrder.id,
      menuItemId: i.id,
      quantity: i.quantity,
      unitPrice: i.price,
      totalPrice: i.price * i.quantity
    }));
    await restaurantDb.insert(orderItems).values(orderItemsData);

    // 3. Generar pago con Telegram Stars si aplica
    if (paymentMethod === 'STARS') {
      const BOT_TOKEN = process.env.BOT_TOKEN;
      if (!BOT_TOKEN) throw new Error("Bot token no configurado");

      // Stars se cobra en unidades de stars (ej: 1 star = $0.02 USD approx, pero aquí asumimos 1 star = $1 para simplificar o calculamos la tasa)
      // La API pide price en units, para XTR (Telegram Stars), amount is in smallest units? No, 1 XTR = 1 unit.
      const starsAmount = Math.ceil(totalAmount); 
      
      const payload = {
        title: `Orden Mesa ${table.number || tableId}`,
        description: `Pago de consumo en restaurante`,
        payload: `order_${newOrder.id}`,
        provider_token: "", // Telegram Stars requires empty string
        currency: "XTR",
        prices: [{ label: "Total", amount: starsAmount }]
      };

      const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      const tgData = await tgRes.json();
      if (tgData.ok) {
        return NextResponse.json({ success: true, invoiceLink: tgData.result, orderId: newOrder.id });
      } else {
        throw new Error(tgData.description || "Error creando invoice de Telegram");
      }
    }

    return NextResponse.json({ success: true, orderId: newOrder.id });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
