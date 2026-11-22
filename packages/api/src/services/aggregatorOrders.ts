/**
 * ── Ingesta de pedidos de marketplaces (Uber Eats y futuros) ───────────────
 *
 * Un pedido de marketplace llega YA PAGADO por la plataforma. Si lo metiéramos
 * como `PENDING` el cajero lo cobraría otra vez (doble cobro). Aquí:
 *   · se normaliza el payload del proveedor a una orden canónica,
 *   · se resuelve el catálogo (mapeo por item, luego por nombre, luego un
 *     placeholder del negocio) para que cocina y ticket tengan nombres reales,
 *   · se marca `channel` + `externalProvider/externalId` (idempotente),
 *   · se registra el pago como cobrado por la plataforma.
 */

import crypto from "node:crypto";
import { and, eq, ilike, sql } from "drizzle-orm";
import {
  aggregatorMenuMap,
  menuCategories,
  menuItems,
  orderItems,
  orders,
  payments,
} from "@rabbitty/database-restaurant/schema";
import { bus, EventTypes } from "@rabbitty/events";
import { withOrderCreate } from "./orderIntegrity";

export type AggregatorProvider = "UBER_EATS" | "RAPPI" | "DIDIFOOD";

export interface CanonicalAggregatorOrder {
  externalId: string;
  storeId?: string | null;
  orderType: "DELIVERY" | "TO_GO";
  status: "PAID" | "PENDING";
  customerName?: string | null;
  customerPhone?: string | null;
  deliveryAddress?: string | null;
  deliveryAddressData?: Record<string, unknown> | null;
  notes?: string | null;
  subtotal: number;
  tax: number;
  deliveryFee: number;
  total: number;
  currency: string;
  items: Array<{
    providerItemId?: string | null;
    name: string;
    quantity: number;
    unitPrice: number;
  }>;
}

const cents = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) / 100 : null;
};

const money = (node: any): number | null => {
  if (!node) return null;
  if (typeof node === "number") return Number(node);
  const amount = node.amount ?? node.value ?? node.total;
  return amount == null ? null : cents(amount);
};

/**
 * Payload de Uber Eats (amounts en centavos) y también el formato simple que
 * usaba el webhook anterior (`{ id, subtotal, total, items:[{mappedId,...}] }`).
 */
export function normalizeAggregatorOrder(provider: AggregatorProvider, payload: any): CanonicalAggregatorOrder {
  if (provider !== "UBER_EATS") {
    // Formato legacy/simple (Rappi, pruebas internas).
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const subtotal = Number(payload?.subtotal ?? 0);
    const total = Number(payload?.total ?? subtotal);
    return {
      externalId: String(payload?.id ?? crypto.randomUUID()),
      storeId: payload?.storeId ?? payload?.store?.id ?? null,
      orderType: String(payload?.orderType ?? "DELIVERY").toUpperCase() === "PICKUP" ? "TO_GO" : "DELIVERY",
      status: "PENDING",
      customerName: payload?.customerName ?? null,
      customerPhone: payload?.customerPhone ?? null,
      deliveryAddress: payload?.deliveryAddress ?? null,
      subtotal,
      tax: Math.max(0, Math.round((total - subtotal) * 100) / 100),
      deliveryFee: Number(payload?.deliveryFee ?? 0),
      total,
      currency: String(payload?.currency ?? "MXN"),
      items: items.map((i: any) => ({
        providerItemId: i.mappedId ?? i.id ?? null,
        name: String(i.name ?? "Artículo"),
        quantity: Math.max(1, Number(i.quantity ?? 1)),
        unitPrice: Number(i.price ?? i.unitPrice ?? 0),
      })),
    };
  }

  const cartItems: any[] = payload?.cart?.items ?? payload?.items ?? [];
  const items = cartItems.map((i: any) => {
    const quantity = Math.max(1, Number(i.quantity ?? 1));
    const totalPrice = money(i?.price?.total_price) ?? money(i?.price?.unit_price) ?? money(i?.price) ?? 0;
    const unitPrice = quantity > 0 ? Math.round((totalPrice / quantity) * 100) / 100 : totalPrice;
    return {
      providerItemId: i?.id ?? i?.item_id ?? null,
      name: String(i?.title ?? i?.name ?? "Artículo"),
      quantity,
      unitPrice,
    };
  });

  const subtotal =
    money(payload?.totals?.sub_total) ??
    money(payload?.subtotal) ??
    Math.round(items.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0) * 100) / 100;
  const tax = money(payload?.totals?.tax) ?? 0;
  const deliveryFee = money(payload?.totals?.delivery_fee) ?? money(payload?.delivery_fee) ?? 0;
  const total = money(payload?.totals?.total) ?? Math.round((subtotal + tax + deliveryFee) * 100) / 100;

  const lat = payload?.delivery?.location?.latitude ?? payload?.delivery?.location?.lat ?? null;
  const lng = payload?.delivery?.location?.longitude ?? payload?.delivery?.location?.lng ?? null;
  const addressText =
    payload?.delivery?.location?.address ??
    payload?.delivery?.location?.formatted_address ??
    null;

  const isPickup = String(payload?.type ?? payload?.order_type ?? "DELIVERY").toUpperCase() === "PICKUP";

  return {
    externalId: String(payload?.id ?? payload?.order_id ?? crypto.randomUUID()),
    storeId: payload?.store?.id ?? payload?.store_id ?? null,
    orderType: isPickup ? "TO_GO" : "DELIVERY",
    // Uber cobra al comensal: la orden entra pagada.
    status: "PAID",
    customerName:
      payload?.eater?.first_name || payload?.eater?.last_name
        ? [payload?.eater?.first_name, payload?.eater?.last_name].filter(Boolean).join(" ")
        : payload?.customer?.name ?? null,
    customerPhone:
      payload?.eater?.phone
        ? `${payload?.eater?.phone_code ?? ""}${payload?.eater?.phone}`.trim()
        : payload?.customer?.phone ?? null,
    deliveryAddress: addressText,
    deliveryAddressData: isPickup
      ? null
      : {
          street1: addressText,
          city: payload?.delivery?.location?.city ?? null,
          state: payload?.delivery?.location?.state ?? null,
          zip: payload?.delivery?.location?.zip_code ?? null,
          country: payload?.delivery?.location?.country ?? "MX",
          lat,
          lng,
          name: payload?.eater?.first_name ?? null,
          phone: payload?.eater?.phone ?? null,
          notes: payload?.delivery?.notes ?? null,
        },
    notes: payload?.special_instructions ?? payload?.notes ?? null,
    subtotal,
    tax,
    deliveryFee,
    total,
    currency: String(payload?.totals?.total?.currency_code ?? payload?.currency ?? "MXN"),
    items,
  };
}

/** Item/categoría placeholder del negocio para catálogo no mapeado. */
async function ensurePlaceholderItem(tx: any, branchId: string): Promise<string> {
  const [existing] = await tx
    .select({ id: menuItems.id })
    .from(menuItems)
    .where(and(eq(menuItems.branchId, branchId), eq(menuItems.name, "Pedido de marketplace")))
    .limit(1);
  if (existing?.id) return existing.id as string;

  let [category] = await tx
    .select({ id: menuCategories.id })
    .from(menuCategories)
    .where(and(eq(menuCategories.branchId, branchId), eq(menuCategories.name, "Marketplace")))
    .limit(1);
  if (!category?.id) {
    const [created] = await tx
      .insert(menuCategories)
      .values({ branchId, name: "Marketplace", sortOrder: 999, isActive: false })
      .returning({ id: menuCategories.id });
    category = created;
  }

  const [createdItem] = await tx
    .insert(menuItems)
    .values({
      branchId,
      categoryId: category.id,
      name: "Pedido de marketplace",
      description: "Renglón de pedidos externos sin mapeo de catálogo",
      price: 0,
      kind: "DISH",
      isActive: false,
      isAvailable: false,
    })
    .returning({ id: menuItems.id });
  return createdItem.id as string;
}

async function resolveMenuItemId(
  tx: any,
  branchId: string,
  connectionId: string | null,
  item: { providerItemId?: string | null; name: string },
  placeholderId: string,
): Promise<string> {
  if (connectionId && item.providerItemId) {
    const [mapped] = await tx
      .select({ menuItemId: aggregatorMenuMap.menuItemId })
      .from(aggregatorMenuMap)
      .where(
        and(
          eq(aggregatorMenuMap.connectionId, connectionId),
          eq(aggregatorMenuMap.providerItemId, item.providerItemId),
        ),
      )
      .limit(1);
    if (mapped?.menuItemId) return mapped.menuItemId as string;
  }

  const [byName] = await tx
    .select({ id: menuItems.id })
    .from(menuItems)
    .where(and(eq(menuItems.branchId, branchId), ilike(menuItems.name, item.name)))
    .limit(1);
  if (byName?.id) return byName.id as string;

  return placeholderId;
}

export interface IngestResult {
  orderId: string;
  duplicated: boolean;
}

/**
 * Inserta el pedido del marketplace de forma idempotente.
 * `connectionId` es opcional: sin conexión (webhook legacy) se resuelve por nombre.
 */
export async function ingestAggregatorOrder(
  db: any,
  params: {
    provider: AggregatorProvider;
    branchId: string;
    connectionId?: string | null;
    order: CanonicalAggregatorOrder;
    actor?: { staffId?: string | null; terminalId?: string | null };
  },
): Promise<IngestResult> {
  const { provider, branchId, connectionId = null, order } = params;

  return db.transaction(async (tx: any) => {
    const placeholderId = await ensurePlaceholderItem(tx, branchId);

    let created: { id: string } | undefined;
    try {
      // Frontera de escritura (ADR-018): toda creación de orden pasa por el helper.
      created = await withOrderCreate(tx, { actor: params.actor ?? {} }, async () => {
        const [row] = await tx
          .insert(orders)
          .values({
            branchId,
            orderType: order.orderType,
            status: order.status,
            channel: provider,
            externalProvider: provider,
            externalId: order.externalId,
            customerName: order.customerName ?? null,
            customerPhone: order.customerPhone ?? null,
            deliveryAddress: order.deliveryAddress ?? null,
            deliveryAddressData: order.deliveryAddressData ?? null,
            notes: order.notes ?? `Pedido ${provider} #${order.externalId}`,
            subtotal: order.subtotal,
            tax: order.tax,
            deliveryFee: order.deliveryFee,
            total: order.total,
            version: 1,
          })
          .returning({ id: orders.id });
        return row;
      });
    } catch (err: any) {
      // 23505 = unique_violation del índice (provider, externalId): reintento.
      if (String(err?.code) === "23505") {
        const [existing] = await tx
          .select({ id: orders.id })
          .from(orders)
          .where(
            and(
              eq(orders.externalProvider, provider),
              eq(orders.externalId, order.externalId),
            ),
          )
          .limit(1);
        if (existing?.id) return { orderId: existing.id as string, duplicated: true };
      }
      throw err;
    }

    if (!created?.id) throw new Error("AGGREGATOR_ORDER_NOT_CREATED");
    const orderRowId = created.id;

    for (let index = 0; index < order.items.length; index++) {
      const item = order.items[index];
      if (!item) continue;
      const menuItemId = await resolveMenuItemId(tx, branchId, connectionId, item, placeholderId);
      await tx.insert(orderItems).values({
        orderId: orderRowId,
        menuItemId,
        nameSnapshot: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: Math.round(item.unitPrice * item.quantity * 100) / 100,
        sortOrder: index,
        status: "PENDING",
      });
    }

    // Pedido prepagado por la plataforma: queda el rastro del cobro, pero no se
    // vuelve a cobrar en caja.
    if (order.status === "PAID" && order.total > 0) {
      await tx.insert(payments).values({
        orderId: orderRowId,
        method: provider,
        amount: order.total,
        status: "COMPLETED",
        reference: order.externalId,
        verificationMethod: "PROVIDER_WEBHOOK",
      });
    }

    bus.emit(EventTypes.ORDER_CREATED, {
      branchId,
      orderId: orderRowId,
      source: provider,
    });
    if (order.status === "PAID") {
      bus.emit(EventTypes.ORDER_PAID, { orderId: orderRowId, source: provider });
    }

    return { orderId: orderRowId, duplicated: false };
  });
}
