import { NextResponse } from 'next/server';
import { restaurantDb } from '@/db/restaurant';
import { orders, orderItems, tables, payments, branches, restaurants } from '@rabbitty/database-restaurant/schema';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { users, ownedBusinesses } from '@/db/schema';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { recordLedgerTransaction, findLedgerEntry } from '@/lib/ledgerHelper';

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
    const totalTip = Number(tip) || 0;

    if (!existingOrderId) {
      const [table] = await restaurantDb.select().from(tables).where(eq(tables.id, tableId));
      if (!table) return NextResponse.json({ success: false, error: 'Mesa no válida' }, { status: 404 });

      interface OrderItemInput {
        id: string;
        price: number;
        quantity: number;
        notes?: string | null;
      }
      const typedItems = items as OrderItemInput[];
      const itemsTotal = typedItems.reduce((sum: number, item: OrderItemInput) => sum + (item.price * item.quantity), 0);
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
      const orderItemsData = typedItems.map((i: OrderItemInput) => ({
        orderId: newOrder.id,
        menuItemId: i.id,
        quantity: i.quantity,
        unitPrice: i.price,
        totalPrice: i.price * i.quantity,
        notes: i.notes || null,
      }));
      await restaurantDb.insert(orderItems).values(orderItemsData);

      // 3. Notificar al sistema del restaurante (POS / KDS)
      try {
        const { sendEcosystemNotification } = await import('@/lib/push/notify');
        const caller = await getAuthenticatedUser(req).catch(() => null);
        let customerName = 'Cliente en Mesa';
        if (caller?.id) {
          const u = await db.query.users.findFirst({ where: eq(users.id, caller.id) });
          if (u) {
            customerName = `${u.firstName || 'Cliente'} ${u.lastName || ''}`.trim();
          }
        }
        
        // Buscar el dueño o branch para emitir la alerta
        const [branch] = await restaurantDb.select().from(branches).where(eq(branches.id, table.branchId));
        if (branch) {
          const [rest] = await restaurantDb.select().from(restaurants).where(eq(restaurants.id, branch.restaurantId));
          if (rest && rest.businessId) {
            const biz = await db.query.ownedBusinesses.findFirst({ where: eq(ownedBusinesses.id, rest.businessId) });
            if (biz?.ownerId) {
              await sendEcosystemNotification({
                userId: biz.ownerId,
                title: `🍽️ Nueva Comanda - Mesa #${table.number}`,
                message: `${customerName} ordenó ${typedItems.length} platillo(s) ($${grandTotal} MXN).`,
                type: 'SYSTEM',
                route: '/business-dashboard',
                threadId: 'table_orders',
              });
            }
          }
        }
      } catch (notifErr) {
        console.warn('Could not send table order notification:', notifErr);
      }

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
      const caller = await getAuthenticatedUser(req);
      if (!caller) {
        return NextResponse.json({ success: false, error: 'Inicia sesión para pagar con Bunz' }, { status: 401 });
      }

      const bunzRequired = Math.round(Number(totalToPay));
      if (bunzRequired <= 0) {
        return NextResponse.json({ success: false, error: 'Monto inválido de Bunz' }, { status: 400 });
      }

      // 1. Atomic debit from user account with row-lock and authoritative ledger entry
      const idempotencyKey = `pos_chk_${targetOrderId}_${caller.id}_${bunzRequired}`;
      await db.transaction(async (tx) => {
        const [lockedUser] = await tx
          .select()
          .from(users)
          .where(eq(users.id, caller.id))
          .limit(1)
          .for('update');

        if (!lockedUser) throw new Error('USUARIO_NO_ENCONTRADO');

        const prior = await findLedgerEntry(idempotencyKey, tx);
        if (prior) return; // Idempotent replay

        const available = (lockedUser.totalBunzEarned || 0) - (lockedUser.totalBunzSpent || 0);
        if (available < bunzRequired) {
          throw new Error('SALDO_INSUFICIENTE_BUNZ');
        }

        // Debit user balance
        await tx
          .update(users)
          .set({
            totalBunzSpent: sql`COALESCE(${users.totalBunzSpent}, 0) + ${bunzRequired}`,
            updatedAt: new Date(),
          })
          .where(eq(users.id, lockedUser.id));

        // Record authoritative ledger entry
        await recordLedgerTransaction(
          {
            payerSubjectId: `usr_${caller.id}`,
            payeeSubjectId: 'POS_CHECKOUT',
            amount: bunzRequired,
            type: 'SPEND',
            referenceId: targetOrderId,
            idempotencyKey,
            metadata: {
              orderId: targetOrderId,
              tableId,
              concept: 'Pago de mesa POS con Bunz',
            },
          },
          tx
        );
      });

      // 2. Insert restaurant payment record
      await restaurantDb.insert(payments).values({
        orderId: targetOrderId,
        method: "BUNZ",
        amount: totalToPay,
        status: "COMPLETED"
      });

      const [orderAfter] = await restaurantDb.select().from(orders).where(eq(orders.id, targetOrderId));
      const allPayments = await restaurantDb.select().from(payments).where(eq(payments.orderId, targetOrderId));
      const sumPayments = allPayments.reduce((s, p) => s + p.amount, 0);

      if (sumPayments >= orderAfter.total) {
        await restaurantDb.update(orders).set({ status: 'PAID' }).where(eq(orders.id, targetOrderId));
      }

      // Notificar al Rabbitter de su consumo con Bunz
      try {
        let restaurantName = 'el restaurante';
        const [ord] = await restaurantDb.select({ branchId: orders.branchId }).from(orders).where(eq(orders.id, targetOrderId)).limit(1);
        const resolvedBranchId = ord?.branchId;
        if (resolvedBranchId) {
          const [branch] = await restaurantDb.select().from(branches).where(eq(branches.id, resolvedBranchId)).limit(1);
          if (branch) {
            const [rest] = await restaurantDb.select().from(restaurants).where(eq(restaurants.id, branch.restaurantId)).limit(1);
            if (rest?.name) restaurantName = rest.name;
          }
        }

        const { sendEcosystemNotification } = await import('@/lib/push/notify');
        await sendEcosystemNotification({
          userId: caller.id,
          title: '💸 Pago con Bunz realizado',
          message: `Has gastado ${bunzRequired.toLocaleString()} Bunz en ${restaurantName}. ¡Disfruta tu visita!`,
          type: 'SYSTEM',
          route: '/profile/wallet',
          pushData: { orderId: targetOrderId, bunzSpent: bunzRequired },
          threadId: 'spending',
        });
      } catch (pushErr) {
        console.warn('Could not send user spending notification:', pushErr);
      }
    }

    return NextResponse.json({ success: true, orderId: targetOrderId });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error desconocido procesando pago';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
