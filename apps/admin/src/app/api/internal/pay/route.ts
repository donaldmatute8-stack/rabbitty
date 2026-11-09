import crypto from "crypto";
import { NextResponse } from "next/server";
import { getRestaurantDb } from "@rabbitty/api/db";
import { orders, payments } from "@rabbitty/database-restaurant/schema";
import { and, eq } from "drizzle-orm";

export const runtime = "nodejs";

/**
 * ── Canal interno de pagos (app nativa/miniapp → admin) ──
 * La sesión del Rabbitter vive en la app (Bearer webSessions), que el admin NO
 * reconoce como cookie de NextAuth. Por eso, cuando el pago se origina en la
 * app, esta autentica al usuario y firma la petición con un secreto compartido.
 *
 * Reglas:
 *  · El secreto nunca sale al cliente: solo viaja entre servidores.
 *  · El monto SIEMPRE se re-valida contra la orden (nunca se confía en el body).
 *  · La identidad del pagador viene del servidor de la app (userId verificado).
 *  · Idempotente por orden/intent.
 */
const SECRET = (() => {
  if (process.env.PAY_INTERNAL_SECRET) return process.env.PAY_INTERNAL_SECRET;
  if (process.env.RATING_INTERNAL_SECRET) return process.env.RATING_INTERNAL_SECRET;
  const url = process.env.CORE_DATABASE_URL || process.env.DATABASE_URL || "";
  return url
    ? crypto.createHash("sha256").update(`rabbitty-internal-pay:${url}`).digest("hex")
    : "";
})();

function authorized(req: Request): boolean {
  if (!SECRET) return false;
  const provided = req.headers.get("x-pay-secret") || "";
  try {
    return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(SECRET));
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "");
  const orderId = String(body?.orderId || "");
  const userId = body?.userId ? String(body.userId) : "";

  if (!orderId) return NextResponse.json({ ok: false, error: "orderId requerido." }, { status: 400 });

  const db = getRestaurantDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return NextResponse.json({ ok: false, error: "Orden no encontrada." }, { status: 404 });

  try {
    /* ── Disponibilidad de Mercado Pago (sin credenciales) ── */
    if (action === "mp-availability") {
      const { getMercadoPagoStatus } = await import("@rabbitty/api/services/mercadopago");
      const status = await getMercadoPagoStatus(db, String(order.branchId));
      return NextResponse.json({
        ok: true,
        available: status.available,
        connected: status.connected,
        mode: status.mode,
      });
    }

    /* ── Liquidar cuenta 100% con Bunz ── */
    if (action === "bunz-settle") {
      if (!userId) return NextResponse.json({ ok: false, error: "userId requerido." }, { status: 400 });
      if (order.customerId && String(order.customerId) !== userId) {
        return NextResponse.json({ ok: false, error: "No puedes pagar una cuenta que no es tuya." }, { status: 403 });
      }

      // Monto real pendiente (server-side), sin confiar en el cliente.
      const paidRows = await db
        .select({ amount: payments.amount })
        .from(payments)
        .where(and(eq(payments.orderId, orderId), eq(payments.status, "COMPLETED")));
      const paid = paidRows.reduce((acc, p) => acc + Number(p.amount || 0), 0);
      const owed = Math.max(0, Number(order.total || 0) - paid);
      const requested = Math.max(0, Number(body?.amountMxn || 0));
      const amount = Math.min(requested > 0 ? requested : owed, owed);
      if (amount <= 0) {
        return NextResponse.json({ ok: false, error: "Esta cuenta ya está liquidada." }, { status: 409 });
      }

      const engine = String(body?.engine || "legacy");
      if (engine === "v2") {
        const { createOrGetPaymentIntent, confirmPaymentIntentSettled } = await import(
          "@rabbitty/api/services/paymentCore"
        );
        const created = await createOrGetPaymentIntent(db, {
          branchId: String(order.branchId),
          orderId,
          payerUserId: userId,
          bunzToApply: amount,
          tipMxn: 0,
          provider: "BUNZ_ONLY",
        });
        if (created.netFiatCents > 0) {
          throw new Error("BUNZ_COVERAGE_INSUFFICIENT");
        }
        const settled = await confirmPaymentIntentSettled(db, {
          paymentIntentId: created.intentId,
          verifiedMethod: "BUNZ_ONLY",
          expectedAmountCents: 0,
          expectedCurrency: "MXN",
          expectedBranchId: String(order.branchId),
          paidAtExternal: new Date(),
        });
        return NextResponse.json({
          ok: true,
          intentId: created.intentId,
          approved: { amountMxn: amount, status: settled.status },
          recoveryHold: settled.recoveryHold ?? false,
        });
      }

      const { PaymentIntentService } = await import("@rabbitty/api/services/paymentIntentDomain");
      const intent = await PaymentIntentService.createIntent({
        tenantId: String(order.branchId),
        creatorSubjectId: userId,
        amountMxn: amount,
        orderId,
        idempotencyKey: `bill_bunz_${orderId}`,
      });
      const approved = await PaymentIntentService.approveIntent(intent.id, userId);
      return NextResponse.json({ ok: true, intentId: intent.id, approved });
    }

    /* ── Mercado Pago: crear checkout ── */
    if (action === "mp-checkout") {
      if (order.customerId && userId && String(order.customerId) !== userId) {
        return NextResponse.json({ ok: false, error: "No puedes pagar una cuenta que no es tuya." }, { status: 403 });
      }
      const { createMercadoPagoCheckout } = await import("@rabbitty/api/services/mercadopago");
      const checkout = await createMercadoPagoCheckout({
        db,
        branchId: String(order.branchId),
        orderId,
        payerUserId: userId || null,
        tipMxn: Math.max(0, Number(body?.tipAmount || 0)),
      });
      return NextResponse.json({ ok: true, ...checkout });
    }

    /* ── Mercado Pago: verificar y liquidar ── */
    if (action === "mp-verify") {
      const { verifyMercadoPagoForOrder } = await import("@rabbitty/api/services/mercadopago");
      const result = await verifyMercadoPagoForOrder({ db, orderId });
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ ok: false, error: `Acción no soportada: ${action}` }, { status: 400 });
  } catch (err: unknown) {
    const raw = err instanceof Error ? err.message : String(err);
    console.error(`[INTERNAL PAY] ${action} ${orderId}:`, raw);
    return NextResponse.json({ ok: false, error: raw.slice(0, 220) }, { status: 500 });
  }
}
