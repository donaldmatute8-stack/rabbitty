import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getRestaurantDb } from "@rabbitty/api/db";
import { miniappClient } from "@rabbitty/api/services/miniapp-client";
import { mapUberStatus } from "@rabbitty/api/services/uberDirect";
import { deliveries, orders } from "@rabbitty/database-restaurant/schema";

export const runtime = "nodejs";

/**
 * ── Webhook de Uber Direct ──────────────────────────────────────────────
 *
 * Uber envía eventos de entrega (delivery_status, courier_update, refund).
 * Seguridad: solo aceptamos `delivery_id` que existan en nuestras entregas
 * (creadas por nosotros) y, si está configurado, un token en la URL.
 *
 * Idempotente: si el estado calculado es el mismo, no se re-notifica.
 */

function authorized(req: Request): boolean {
  const expected = process.env.UBER_DIRECT_WEBHOOK_TOKEN;
  if (!expected) return true; // validación por pertenencia (delivery_id)
  const url = new URL(req.url);
  return url.searchParams.get("token") === expected;
}

type UberEvent = {
  kind?: string;
  id?: string;
  delivery_id?: string;
  status?: string;
  courier?: { name?: string; phone_number?: string } | null;
  /** ETA ISO que Uber recalcula (llega en delivery_status y courier_update). */
  dropoff_eta?: string;
  eta?: string;
};

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let event: UberEvent;
  try {
    event = (await req.json()) as UberEvent;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const deliveryId = event.delivery_id;
  if (!deliveryId) {
    // Eventos sin entrega (p. ej. billing) se aceptan y se ignoran.
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    const db = getRestaurantDb();
    const [delivery] = await db
      .select({
        id: deliveries.id,
        orderId: deliveries.orderId,
        status: deliveries.status,
        provider: deliveries.provider,
        externalPayload: deliveries.externalPayload,
      })
      .from(deliveries)
      .where(eq(deliveries.providerDeliveryId, deliveryId))
      .limit(1);

    if (!delivery) {
      // No es una entrega nuestra: se ignora (no se revela nada).
      return NextResponse.json({ ok: true, ignored: true });
    }

    // ETA recalculado por Uber → se refleja en el pedido y en /track.
    const rawEta = event.dropoff_eta || event.eta;
    if (typeof rawEta === "string") {
      const etaAt = new Date(rawEta);
      if (!Number.isNaN(etaAt.getTime())) {
        const etaMinutes = Math.max(1, Math.round((etaAt.getTime() - Date.now()) / 60000));
        await db
          .update(orders)
          .set({ etaAt, etaMinutes, updatedAt: new Date() })
          .where(eq(orders.id, delivery.orderId));
      }
    }

    // Datos del courier (Uber los manda cuando asigna).
    if (event.courier?.name || event.courier?.phone_number) {
      await db
        .update(deliveries)
        .set({
          courierName: event.courier?.name ?? null,
          courierPhone: event.courier?.phone_number ?? null,
          updatedAt: new Date(),
        })
        .where(eq(deliveries.id, delivery.id));
    }

    const isStatusEvent = (event.kind || "").includes("delivery_status");
    if (!isStatusEvent || !event.status) {
      // courier_update/refund: guardamos el último payload sin tocar el estado.
      await db
        .update(deliveries)
        .set({ externalPayload: event as unknown as Record<string, unknown>, updatedAt: new Date() })
        .where(eq(deliveries.id, delivery.id));
      return NextResponse.json({ ok: true, updated: false });
    }

    const nextStatus = mapUberStatus(event.status);
    if (nextStatus === delivery.status) {
      return NextResponse.json({ ok: true, unchanged: true });
    }

    await db
      .update(deliveries)
      .set({
        status: nextStatus,
        externalPayload: event as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(deliveries.id, delivery.id));

    // Aviso al cliente con el mismo lenguaje que el flujo manual.
    const [order] = await db
      .select({ customerId: orders.customerId, etaAt: orders.etaAt })
      .from(orders)
      .where(eq(orders.id, delivery.orderId))
      .limit(1);

    if (order?.customerId) {
      const copy: Record<string, { title: string; message: string }> = {
        ASSIGNED: {
          title: "🛵 Repartidor asignado",
          message: "Uber ya asignó a tu repartidor. Puedes seguir tu pedido en tiempo real.",
        },
        PICKED_UP: {
          title: "🛵 Tu pedido va en camino",
          message: order?.etaAt
            ? `El repartidor ya recogió tu pedido y llega aproximadamente a las ${new Date(order.etaAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}.`
            : "El repartidor ya recogió tu pedido y va hacia tu dirección.",
        },
        DELIVERED: {
          title: "✅ Pedido entregado",
          message: "¡Buen provecho! Tu pedido se entregó. Tu cashback Bunz se acredita con la venta.",
        },
        CANCELLED: {
          title: "❌ Entrega cancelada",
          message: "La entrega se canceló. El local se pondrá en contacto contigo.",
        },
        FAILED: {
          title: "⚠️ Problema con la entrega",
          message: "La entrega no se pudo completar. El local revisará tu pedido.",
        },
      };
      const notice = copy[nextStatus];
      if (notice) {
        try {
          await miniappClient.sendNotification({
            userId: order.customerId,
            title: notice.title,
            message: notice.message,
            type: "SYSTEM",
            route: `/track/${delivery.orderId}`,
            dedupeKey: `delivery:${delivery.orderId}:${nextStatus}`,
            priority: "high",
          });
        } catch (notifyErr) {
          console.warn("[UBER_WEBHOOK] notificación falló (no fatal):", notifyErr);
        }
      }
    }

    return NextResponse.json({ ok: true, status: nextStatus });
  } catch (error) {
    console.error("[UBER_WEBHOOK]", error);
    // 200 para que Uber no reintente en bucle por un fallo nuestro de datos.
    return NextResponse.json({ ok: true, error: "processed_with_errors" });
  }
}
