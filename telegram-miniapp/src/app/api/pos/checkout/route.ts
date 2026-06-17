import { NextResponse } from 'next/server';
import { restaurantDb } from '@/db/restaurant';
import { orders, orderItems, tables, payments } from '@rabbitty/database-restaurant/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tableId, items, paymentMethod, tip = 0, existingOrderId, splitPaymentAmount } = body;

    // Si pasaron existingOrderId, es un Split Bill.
    // Si no, es una orden nueva.
    if (!existingOrderId && (!tableId || !items || items.length === 0)) {
      return NextResponse.json({ success: false, error: 'Datos inválidos' }, { status: 400 });
    }

    let targetOrderId = existingOrderId;
    let totalToPay = splitPaymentAmount;
    let totalTip = Number(tip) || 0;

    if (!existingOrderId) {
      const [table] = await restaurantDb.select().from(tables).where(eq(tables.id, tableId));
      if (!table) return NextResponse.json({ success: false, error: 'Mesa no válida' }, { status: 404 });

      const itemsTotal = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
      const grandTotal = itemsTotal + totalTip;

      // 1. Guardar la orden en la BD con estado PENDING
      const [newOrder] = await restaurantDb.insert(orders).values({
        branchId: table.branchId,
        tableId,
        subtotal: itemsTotal,
        tip: totalTip,
        total: grandTotal,
        status: paymentMethod === 'BUNZ' ? 'PAID' : 'PENDING',
        orderType: 'DINE_IN'
      }).returning();

      // 2. Guardar los items
      const orderItemsData = items.map((i: any) => ({
        orderId: newOrder.id,
        menuItemId: i.id,
        quantity: i.quantity,
        unitPrice: i.price,
        totalPrice: i.price * i.quantity,
        notes: i.notes || null,
      }));
      await restaurantDb.insert(orderItems).values(orderItemsData);

      targetOrderId = newOrder.id;
      totalToPay = grandTotal;
    } else {
      // Split payment logic
      const [existingOrder] = await restaurantDb.select().from(orders).where(eq(orders.id, existingOrderId));
      if (!existingOrder) return NextResponse.json({ success: false, error: 'Orden no encontrada' }, { status: 404 });
      
      // Update tip in the global order if they added any
      if (totalTip > 0) {
        await restaurantDb.update(orders).set({
          tip: existingOrder.tip + totalTip,
          total: existingOrder.total + totalTip
        }).where(eq(orders.id, existingOrderId));
      }

      totalToPay = (Number(splitPaymentAmount) || 0) + totalTip;
    }

    // 3. Generar pago con Telegram Stars si aplica
    if (paymentMethod === 'STARS') {
      const BOT_TOKEN = process.env.BOT_TOKEN;
      if (!BOT_TOKEN) throw new Error("Bot token no configurado");

      const starsAmount = Math.ceil(totalToPay); 
      
      const payload = {
        title: `Pago Mesa ${tableId.slice(0,4)}`,
        description: `Pago de consumo en restaurante ${totalTip > 0 ? '(con propina)' : ''}`,
        payload: `order_${targetOrderId}_amount_${totalToPay}_tip_${totalTip}`, // Webhook can parse this
        provider_token: "",
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
        return NextResponse.json({ success: true, invoiceLink: tgData.result, orderId: targetOrderId });
      } else {
        throw new Error(tgData.description || "Error creando invoice de Telegram");
      }
    } else if (paymentMethod === 'BUNZ') {
      // Si fue BUNZ, y era Split Payment, insertamos el payment y checamos si ya se cubrió el total
      await restaurantDb.insert(payments).values({
        orderId: targetOrderId,
        method: "BUNZ",
        amount: totalToPay,
        status: "COMPLETED"
      });

      // Lógica simplificada: aquí deberíamos llamar al wallet para descontar, lo asume exitoso por ahora
      const [orderAfter] = await restaurantDb.select().from(orders).where(eq(orders.id, targetOrderId));
      const allPayments = await restaurantDb.select().from(payments).where(eq(payments.orderId, targetOrderId));
      const sumPayments = allPayments.reduce((s, p) => s + p.amount, 0);

      if (sumPayments >= orderAfter.total) {
        await restaurantDb.update(orders).set({ status: 'PAID' }).where(eq(orders.id, targetOrderId));
      }
    }

    return NextResponse.json({ success: true, orderId: targetOrderId });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
