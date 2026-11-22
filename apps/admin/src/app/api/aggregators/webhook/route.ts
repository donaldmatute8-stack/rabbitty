import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getRestaurantDb } from "@rabbitty/api/db";
import {
  aggregatorConnections,
  aggregatorWebhookEvents,
  branches,
} from "@rabbitty/database-restaurant/schema";
import {
  ingestAggregatorOrder,
  normalizeAggregatorOrder,
  type AggregatorProvider,
} from "@rabbitty/api/services/aggregatorOrders";
import { verifySharedSecret, verifyUberSignature } from "@rabbitty/api/services/uberEats";

export const runtime = "nodejs";

/**
 * ── Webhook de marketplaces (Uber Eats) ────────────────────────────────────
 *
 * Seguridad:
 *   · Uber firma cada entrega con `X-Uber-Signature` (HMAC-SHA256 del body
 *     crudo con el client secret). Se valida SIEMPRE que exista la firma.
 *   · El bearer estático anterior (`AGGREGATOR_WEBHOOK_SECRET`) queda solo como
 *     compatibilidad para pruebas internas mientras `uberEatsConfigured()` es
 *     falso.
 *
 * Idempotencia: Uber reintenta. El pedido se inserta con índice único
 * (`externalProvider`, `externalId`) y cada entrega queda en
 * `aggregator_webhook_events` para auditoría; un reintento responde 200 con
 * `duplicated: true` en vez de crear otra orden.
 *
 * La sucursal se resuelve por la CONEXIÓN (provider + storeId), no por query:
 * un storeId solo puede pertenecer a un negocio.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("x-uber-signature");
  const bearerHeader = req.headers.get("authorization") || "";
  const bearer = bearerHeader.toLowerCase().startsWith("bearer ")
    ? bearerHeader.slice(7).trim()
    : null;

  const signedByUber = verifyUberSignature(raw, signature);
  const legacyAllowed = !signedByUber && verifySharedSecret(bearer);

  if (!signedByUber && !legacyAllowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const url = new URL(req.url);
  const provider = String(
    signedByUber ? "UBER_EATS" : url.searchParams.get("provider") || "UBER_EATS",
  ).toUpperCase() as AggregatorProvider;

  const storeId = payload?.store?.id ?? payload?.store_id ?? payload?.storeId ?? null;
  const legacyBranchId = url.searchParams.get("branchId");
  const eventType =
    payload?.event_type ?? payload?.meta?.event_type ?? payload?.type ?? "order.notification";
  const externalId = payload?.id ?? payload?.order_id ?? null;

  const db = getRestaurantDb();

  try {
    // ── Resolver la sucursal ──
    let branchId: string | null = null;
    let connectionId: string | null = null;

    if (storeId) {
      const [connection] = await db
        .select({ id: aggregatorConnections.id, branchId: aggregatorConnections.branchId })
        .from(aggregatorConnections)
        .where(
          and(
            eq(aggregatorConnections.provider, provider),
            eq(aggregatorConnections.storeId, String(storeId)),
          ),
        )
        .limit(1);
      if (connection) {
        connectionId = connection.id;
        branchId = connection.branchId;
      }
    }

    if (!branchId && legacyBranchId) {
      const [branch] = await db
        .select({ id: branches.id })
        .from(branches)
        .where(eq(branches.id, legacyBranchId))
        .limit(1);
      if (branch) branchId = branch.id;
    }

    if (!branchId) {
      console.warn("[AGGREGATOR] storeId sin conexión:", provider, storeId ?? "—");
      return NextResponse.json(
        { error: "Tienda no conectada", provider, storeId },
        { status: 404 },
      );
    }

    // ── Bitácora (idempotente por provider + evento + externalId) ──
    if (externalId) {
      try {
        await db.insert(aggregatorWebhookEvents).values({
          provider,
          eventType: String(eventType),
          externalId: String(externalId),
          storeId: storeId ? String(storeId) : null,
          payload,
        });
      } catch (err: any) {
        if (String(err?.code) === "23505") {
          return NextResponse.json({ ok: true, duplicated: true, reason: "evento ya procesado" });
        }
        console.warn("[AGGREGATOR] no se pudo registrar el evento:", err?.message ?? err);
      }
    }

    // Eventos que no son de pedido (estado de tienda, menú): solo se auditan.
    const isOrderEvent = Boolean(
      payload?.cart?.items?.length ||
        payload?.items?.length ||
        String(eventType).toLowerCase().includes("order"),
    );
    if (!isOrderEvent) {
      return NextResponse.json({ ok: true, ignored: true, eventType });
    }

    const order = normalizeAggregatorOrder(provider, payload);
    const result = await ingestAggregatorOrder(db, {
      provider,
      branchId,
      connectionId,
      order,
      actor: { staffId: null, terminalId: null },
    });

    await db
      .update(aggregatorWebhookEvents)
      .set({ processed: true })
      .where(
        and(
          eq(aggregatorWebhookEvents.provider, provider),
          eq(aggregatorWebhookEvents.eventType, String(eventType)),
          eq(aggregatorWebhookEvents.externalId, String(externalId ?? order.externalId)),
        ),
      );

    return NextResponse.json({
      ok: true,
      provider,
      orderId: result.orderId,
      duplicated: result.duplicated,
      storeId,
    });
  } catch (error: any) {
    console.error("[AGGREGATOR] error:", error?.message ?? error);
    return NextResponse.json({ error: "No se pudo procesar el pedido" }, { status: 500 });
  }
}
