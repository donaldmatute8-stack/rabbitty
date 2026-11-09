import crypto from "crypto";
import { NextResponse } from "next/server";
import { getRestaurantDb } from "@rabbitty/api/db";
import { handleMercadoPagoPayment } from "@rabbitty/api/services/mercadopago";

export const runtime = "nodejs";

/**
 * ── Webhook de Mercado Pago (Checkout Pro) ──
 * Mercado Pago no firma con un secreto por tenant de forma simple, así que la
 * fuente de verdad es SIEMPRE la API de Mercado Pago: con el access token del
 * tenant consultamos el pago y validamos monto/moneda/sucursal antes de liquidar.
 *
 * `notification_url` se registra por preferencia con `?branchId=<sucursal>`,
 * porque el pago todavía no existe en nuestra DB cuando llega la notificación.
 *
 * Si MERCADO_PAGO_WEBHOOK_SECRET está configurado, además se valida la firma
 * `x-signature` (ts + v1) de la app de Mercado Pago.
 */
function verifySignature(req: Request, dataId: string): boolean {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  if (!secret) return true; // sin secreto configurado: se valida contra la API

  const signature = req.headers.get("x-signature") || "";
  const requestId = req.headers.get("x-request-id") || "";
  const parts = Object.fromEntries(
    signature.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k?.trim(), v?.trim()];
    })
  ) as Record<string, string>;
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const branchId = url.searchParams.get("branchId") || "";
  const body = await req.json().catch(() => null);

  const type = String(body?.type || url.searchParams.get("type") || body?.topic || "");
  const dataId = String(
    body?.data?.id || url.searchParams.get("data.id") || url.searchParams.get("id") || ""
  );

  // Solo procesamos pagos; el resto se acusa recibo para que MP no reintente.
  if (!dataId || (type && type !== "payment")) {
    return NextResponse.json({ received: true, ignored: type || "unknown" });
  }
  if (!branchId) {
    console.warn("[MP Webhook] notificación sin branchId:", dataId);
    return NextResponse.json({ received: true, ignored: "no_branch" });
  }
  if (!verifySignature(req, dataId)) {
    console.warn("[MP Webhook] firma inválida para pago", dataId);
    return NextResponse.json({ error: "Firma inválida." }, { status: 401 });
  }

  try {
    const db = getRestaurantDb();
    const result = await handleMercadoPagoPayment({ db, branchId, paymentId: dataId });
    console.log("[MP Webhook]", dataId, JSON.stringify(result));
    return NextResponse.json({ received: true, ...result });
  } catch (err) {
    // 500 → Mercado Pago reintenta. La liquidación es idempotente.
    console.error("[MP Webhook] error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Error procesando el pago." }, { status: 500 });
  }
}

export async function GET(req: Request) {
  // Salud del endpoint (MP a veces hace un GET de verificación).
  const url = new URL(req.url);
  return NextResponse.json({ ok: true, branchId: url.searchParams.get("branchId") || null });
}
