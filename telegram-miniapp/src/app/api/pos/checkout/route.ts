import { NextResponse } from 'next/server';
import { restaurantDb } from '@/db/restaurant';
import { orders, orderItems, tables, tableSessions, payments, branches, restaurants } from '@rabbitty/database-restaurant/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '@/db';
import { users, ownedBusinesses } from '@/db/schema';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { isBusinessOpen } from '@/lib/chat';
import { recordLedgerTransaction, findLedgerEntry } from '@/lib/ledgerHelper';

// IVA canónico idéntico al POS (packages/api/src/routers/pos.ts calcTax):
// los precios del menú incluyen IVA 16% — el desglose se deriva, nunca se suma.
const TAX_RATE = 0.16;
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Dirección estructurada de entrega.
 * Uber Direct (y cualquier proveedor serio) necesita campos separados, no una
 * línea de texto. `text` se conserva para mostrar/WhatsApp/seguimiento.
 */
interface DeliveryAddressData {
  street1: string;
  street2?: string;
  neighborhood?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string;
  notes?: string;
  lat?: number;
  lng?: number;
}

function normalizeDeliveryAddress(
  raw: unknown,
  fallbackText?: string,
): { text: string; data: DeliveryAddressData } | null {
  const a = (raw ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof a[k] === 'string' ? (a[k] as string).trim() : '');
  const num = (k: string) => (typeof a[k] === 'number' && Number.isFinite(a[k]) ? (a[k] as number) : undefined);

  const street1 = str('street1');
  const city = str('city');
  const state = str('state');
  const zip = str('zip');

  // Si no viene estructurada, aceptamos el texto libre (compatibilidad) como calle.
  if (!street1 && fallbackText) {
    return {
      text: fallbackText.trim().slice(0, 300),
      data: {
        street1: fallbackText.trim().slice(0, 200),
        city: city || '',
        state: state || '',
        zip: zip || '',
        country: (str('country') || 'MX').toUpperCase(),
      },
    };
  }

  if (street1.length < 4 || city.length < 3 || state.length < 2 || zip.length < 4) return null;

  const data: DeliveryAddressData = {
    street1,
    street2: str('street2') || undefined,
    neighborhood: str('neighborhood') || undefined,
    city,
    state,
    zip,
    country: (str('country') || 'MX').toUpperCase(),
    phone: str('phone') || undefined,
    notes: str('notes') || undefined,
    lat: num('lat'),
    lng: num('lng'),
  };

  const text = [
    data.street1,
    data.street2,
    data.neighborhood ? `Col. ${data.neighborhood}` : '',
    `${data.city}, ${data.state} ${data.zip}`,
  ]
    .filter(Boolean)
    .join(', ');

  return { text: text.slice(0, 300), data };
}

// H-ORDER-LOCAL: el cliente del perfil afiliado manda el id del NEGOCIO
// (ownedBusinesses.id) en `branchId` — NO es un branches.id, y el INSERT en
// orders reventaba con FK (error "Failed query: insert into \"orders\""
// llegando crudo al usuario). Resolvemos ambos casos: branch id directo, o
// business id → restaurante → sucursal.
async function resolveBranchId(branchOrBusinessId: string): Promise<string | null> {
  const [byId] = await restaurantDb
    .select({ id: branches.id })
    .from(branches)
    .where(eq(branches.id, branchOrBusinessId))
    .limit(1);
  if (byId) return byId.id;
  // Un negocio puede tener varias sucursales (incluida Sandbox/Entrenamiento).
  // El pedido debe caer en la de PRODUCCIÓN activa, no en la de pruebas.
  const byBusiness = await restaurantDb
    .select({ id: branches.id, name: branches.name, isActive: branches.isActive })
    .from(branches)
    .innerJoin(restaurants, eq(branches.restaurantId, restaurants.id))
    .where(eq(restaurants.businessId, branchOrBusinessId));
  if (byBusiness.length === 0) return null;
  const activeBranches = byBusiness.filter((b) => b.isActive !== false);
  const production =
    activeBranches.find((b) => !/sandbox|entrenamiento|prueba|test/i.test(b.name || '')) ??
    activeBranches[0] ??
    byBusiness[0];
  return production?.id ?? null;
}

/** Motivo legible si el negocio está cerrado; null si puede recibir pedidos. */
async function businessClosedReason(branchId: string): Promise<string | null> {
  try {
    const [biz] = await restaurantDb
      .select({ businessId: restaurants.businessId })
      .from(branches)
      .innerJoin(restaurants, eq(branches.restaurantId, restaurants.id))
      .where(eq(branches.id, branchId))
      .limit(1);
    if (!biz?.businessId) return null;
    const [owner] = await db
      .select({
        activeDays: ownedBusinesses.activeDays,
        startTime: ownedBusinesses.startTime,
        endTime: ownedBusinesses.endTime,
        timezone: ownedBusinesses.timezone,
      })
      .from(ownedBusinesses)
      .where(eq(ownedBusinesses.id, biz.businessId))
      .limit(1);
    if (!owner) return null;
    if (isBusinessOpen(owner)) return null;
    return `El local está cerrado ahora (${owner.startTime}–${owner.endTime}). Puedes pedir dentro del horario.`;
  } catch {
    // Si falla la consulta, no bloqueamos el pedido.
    return null;
  }
}

export async function POST(req: Request) {
  try {    const body = await req.json();
    const {
      tableId,
      items,
      paymentMethod,
      tip = 0,
      existingOrderId,
      splitPaymentAmount,
      orderType: requestedOrderType,
      deliveryAddress,
      deliveryAddressData,
    } = body;

    // Domicilio / recoger / mesa: el POS necesita distinguirlo para prometer
    // tiempo de entrega y asignar repartidor.
    const resolvedOrderType =
      tableId
        ? 'DINE_IN'
        : requestedOrderType === 'DELIVERY'
          ? 'DELIVERY'
          : 'TAKEAWAY';
    const addressResult =
      resolvedOrderType === 'DELIVERY'
        ? normalizeDeliveryAddress(
            deliveryAddressData,
            typeof deliveryAddress === 'string' ? deliveryAddress : undefined,
          )
        : null;
    // Sin dirección válida no se puede entregar: se rechaza acá, no en el POS
    // cuando ya prometimos tiempo de entrega.
    if (resolvedOrderType === 'DELIVERY' && !addressResult) {
      return NextResponse.json(
        {
          success: false,
          error: 'Falta la dirección de entrega (calle, ciudad, estado y CP) para el pedido a domicilio.',
        },
        { status: 400 },
      );
    }
    const normalizedAddress = addressResult?.text ?? null;
    const normalizedAddressData = addressResult?.data ?? null;

    // Si pasaron existingOrderId, es un Split Bill.
    // Si no, es una orden nueva. La mesa es opcional si hay usuario
    // autenticado: puede pedir "producto solo" y el POS le asigna mesa.
    // Autenticación best-effort: el comensal de la app envía headers; los
    // códigos QR externos (sin sesión) siguen funcionando como anónimos.
    const caller = await getAuthenticatedUser(req).catch(() => null);
    if (!existingOrderId && (!items || items.length === 0)) {
      return NextResponse.json({ success: false, error: 'Datos inválidos' }, { status: 400 });
    }
    if (!existingOrderId && !tableId && !caller) {
      return NextResponse.json({ success: false, error: 'Datos inválidos' }, { status: 400 });
    }

    let targetOrderId = existingOrderId;
    let totalToPay = splitPaymentAmount;
    const totalTip = Number(tip) || 0;

    if (!existingOrderId) {
      // Mesa opcional: si no hay tableId, la order se crea "sin mesa"
      // (branchId viene del perfil afiliado; el POS la vincula después).
      let table: typeof tables.$inferSelect | undefined | null = null;
      if (tableId) {
        [table] = await restaurantDb.select().from(tables).where(eq(tables.id, tableId));
        if (!table) return NextResponse.json({ success: false, error: 'Mesa no válida' }, { status: 404 });
      }
      const rawBranchRef = table?.branchId || body.branchId || null;
      const orderBranchId = rawBranchRef ? await resolveBranchId(String(rawBranchRef)) : null;
      if (!orderBranchId) {
        return NextResponse.json(
          { success: false, error: 'Aún no hay sucursal configurada para este negocio en el sistema del local. Avisa al comercio.' },
          { status: 422 }
        );
      }
      if (!orderBranchId) {
        return NextResponse.json({ success: false, error: 'Mesa no válida' }, { status: 404 });
      }

      // Pedidos sin mesa (app para llevar / domicilio) solo dentro del horario.
      if (!tableId) {
        const closed = await businessClosedReason(orderBranchId);
        if (closed) return NextResponse.json({ success: false, error: closed }, { status: 409 });
      }

      interface OrderItemInput {
        id: string;
        price: number;
        quantity: number;
        notes?: string | null;
      }
      const typedItems = items as OrderItemInput[];
      const grandTotal = typedItems.reduce((sum: number, item: OrderItemInput) => sum + (item.price * item.quantity), 0);

      // ── Fase C: ACUMULAR en el Tab abierto del PROPIO Rabbitter ──
      // Si reclamo la mesa (table_session OPEN con mi customerId) y hay una
      // comanda PENDING en ella, los nuevos platillos se SUMAN a ESA orden
      // (un solo tab por mesa) — sin crear órdenes separadas.
      let accumulatedOrderId: string | null = null;
      if (caller && tableId) {
        try {
          const [ownSession] = await restaurantDb
            .select()
            .from(tableSessions)
            .where(and(eq(tableSessions.tableId, tableId), eq(tableSessions.status, 'OPEN')))
            .limit(1);
          if (ownSession && ownSession.customerId === caller.id) {
            const [pendingOrder] = await restaurantDb
              .select()
              .from(orders)
              .where(and(eq(orders.tableId, tableId), eq(orders.status, 'PENDING')))
              .orderBy(desc(orders.createdAt))
              .limit(1);
            if (pendingOrder) accumulatedOrderId = pendingOrder.id;
          }
        } catch (tabErr) {
          console.warn('[POS_CHECKOUT] detección de tab falló, se crea orden nueva:', tabErr);
        }
      }

      if (accumulatedOrderId) {
        const orderItemsData = typedItems.map((i) => ({
          orderId: accumulatedOrderId,
          menuItemId: i.id,
          quantity: i.quantity,
          unitPrice: i.price,
          totalPrice: r2(i.price * i.quantity),
          notes: i.notes || null,
        }));
        await restaurantDb.insert(orderItems).values(orderItemsData);

        // Recalcular totales desde order_items (fuente de verdad)
        const allItems = await restaurantDb.select().from(orderItems).where(eq(orderItems.orderId, accumulatedOrderId!));
        const itemsSum = r2(allItems.reduce((s: number, it: any) => s + Number(it.totalPrice || 0), 0));
        const newTotal = r2(itemsSum);
        await restaurantDb
          .update(orders)
          .set({
            subtotal: r2(newTotal / (1 + TAX_RATE)),
            tax: r2(newTotal - newTotal / (1 + TAX_RATE)),
            total: newTotal,
            updatedAt: new Date(),
          })
          .where(eq(orders.id, accumulatedOrderId!));

        targetOrderId = accumulatedOrderId;
        totalToPay = newTotal;

        // Notificar al staff: la mesa siguió pidiendo
        try {
          const { sendEcosystemNotification } = await import('@/lib/push/notify');
          let customerName = 'Cliente en Mesa';
          if (caller?.id) {
            const u = await db.query.users.findFirst({ where: eq(users.id, caller.id) });
            if (u) customerName = `${u.firstName || 'Cliente'} ${u.lastName || ''}`.trim();
          }
          const [tbl] = await restaurantDb.select({ number: tables.number }).from(tables).where(eq(tables.id, tableId));
          const [orderRow] = await restaurantDb.select({
            branchId: orders.branchId,
          }).from(orders).where(eq(orders.id, accumulatedOrderId!));
          if (orderRow?.branchId) {
            const [brRow] = await restaurantDb.select({ restaurantId: branches.restaurantId }).from(branches).where(eq(branches.id, orderRow.branchId));
            if (brRow) {
              const [rest] = await restaurantDb.select({ businessId: restaurants.businessId }).from(restaurants).where(eq(restaurants.id, brRow.restaurantId));
              if (rest?.businessId) {
                const biz = await db.query.ownedBusinesses.findFirst({ where: eq(ownedBusinesses.id, rest.businessId) });
                if (biz?.ownerId) {
                  await sendEcosystemNotification({
                    userId: biz.ownerId,
                    title: `🍽️ Mesa #${tbl?.number ?? '?'} agregó platillos`,
                    message: `${customerName} añadió ${typedItems.length} platillo(s) a su comanda (total $${grandTotal} MXN).`,
                    type: 'SYSTEM',
                    route: '/business-dashboard',
                    threadId: 'table_orders',
                  });
                }
              }
            }
          }
        } catch (notifErr) {
          console.warn('Could not send tab addition notification:', notifErr);
        }
      } else {
      // 1. Guardar la orden en la BD con estado PENDING
      const [newOrder] = await restaurantDb.insert(orders).values({
        branchId: orderBranchId,
        tableId: tableId || null,
        subtotal: r2(grandTotal / (1 + TAX_RATE)),
        tax: r2(grandTotal - grandTotal / (1 + TAX_RATE)),
        tip: totalTip,
        total: r2(grandTotal + totalTip),
        status: paymentMethod === 'BUNZ' ? 'PAID' : 'PENDING',
        orderType: resolvedOrderType,
        deliveryAddress: normalizedAddress,
        deliveryAddressData: normalizedAddressData,
      }).returning();

      // Fase C: identificar al comensal en la orden (para POS/cuenta/cashback)
      if (caller) {
        await restaurantDb.update(orders).set({ customerId: caller.id }).where(eq(orders.id, newOrder.id));
      }

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
        const branchRowId = table?.branchId || orderBranchId;
        const [branch] = branchRowId ? await restaurantDb.select().from(branches).where(eq(branches.id, branchRowId)) : [];
        if (branch) {
          const [rest] = await restaurantDb.select().from(restaurants).where(eq(restaurants.id, branch.restaurantId));
          if (rest && rest.businessId) {
            const biz = await db.query.ownedBusinesses.findFirst({ where: eq(ownedBusinesses.id, rest.businessId) });
            if (biz?.ownerId) {
              await sendEcosystemNotification({
                userId: biz.ownerId,
                title: table ? `🍽️ Nueva Comanda - Mesa #${table.number}` : '🛍️ Nueva Comanda — Para Llevar',
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
        totalToPay = grandTotal + totalTip;
      }
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
        title: `Pago ${tableId ? `Mesa ${tableId.slice(0, 4)}` : 'Pedido'}`,
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
    // H-ORDEN-UX: los errores de SQL/Drizzle (p. ej. el famoso
    // `Failed query: insert into "orders"…` con la query completa) JAMÁS
    // salen al usuario — el detalle queda solo en el log del server.
    const raw = err instanceof Error ? err.message : String(err ?? 'Error desconocido');
    let friendly = 'No pudimos registrar tu pedido. Revisa tu conexión e intenta de nuevo.';
    if (raw.includes('SALDO_INSUFICIENTE_BUNZ')) {
      friendly = 'No tienes Bunz suficientes para cubrir esta cuenta.';
    } else if (raw.includes('23503') || raw.includes('foreign key')) {
      friendly = 'No pudimos identificar el local de este pedido. Vuelve a entrar al negocio o escanea el QR del local.';
    }
    console.error('[POS_CHECKOUT]', raw);
    return NextResponse.json({ success: false, error: friendly }, { status: 500 });
  }
}
