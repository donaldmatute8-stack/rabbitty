import { NextResponse } from "next/server";
import { getStripeClient } from "@rabbitty/api/services/stripeConnect";
import { getRestaurantDb, getCoreDb } from "@rabbitty/api/db";
import {
  registerProviderWebhookEvent,
  markProviderWebhookEventCompleted,
  markProviderWebhookEventFailed,
  confirmPaymentIntentSettled,
  releasePaymentIntentHold,
} from "@rabbitty/api/services/paymentCore";
import { paymentIntents } from "@rabbitty/database-restaurant/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

/**
 * Endpoint oficial de Webhooks de Stripe Connect para Rabbitty Pay.
 * 1. Lee el cuerpo binario crudo (raw body) para verificar la firma de Stripe.
 * 2. Ciclo de vida recuperable de eventos (PROCESSING -> COMPLETED | FAILED).
 *    Si falla una confirmación previa, reintentos de Stripe vuelven a procesar.
 * 3. Valida datos de negocio del cobro (monto, moneda, sucursal, estatus).
 * 4. Ejecuta la confirmación atómica o cancelación de hold.
 */
export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[Stripe Webhook] STRIPE_WEBHOOK_SECRET no está configurado.");
    return NextResponse.json(
      { error: "Webhook secret no configurado." },
      { status: 500 }
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Firma stripe-signature ausente." },
      { status: 400 }
    );
  }

  let event: any;

  try {
    const rawBody = await req.text();
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    console.error("[Stripe Webhook] Error verificando firma criptográfica:", err.message);
    return NextResponse.json(
      { error: `Firma inválida: ${err.message}` },
      { status: 400 }
    );
  }

  const restaurantDb = getRestaurantDb();

  // Deduplicación física en DB con ciclo de vida recuperable (once-and-only-once real)
  const regResult = await registerProviderWebhookEvent(restaurantDb, {
    provider: "STRIPE",
    eventId: event.id,
    eventType: event.type,
    payload: event,
  });

  // P0 FIX: Únicamente respondemos 200 directo si la operación de negocio YA completó con éxito.
  // Si estaba en PROCESSING o FAILED, permitimos continuar el procesamiento para no perder confirmaciones.
  if (regResult.alreadyCompleted) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    let resolvedIntentId: string | undefined;

    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object;
        const externalId = pi.id;

        // Localizar el intento interno por metadata o por externalIntentId
        let internalIntentId = pi.metadata?.rabbittyIntentId;

        if (!internalIntentId) {
          const [found] = await restaurantDb
            .select()
            .from(paymentIntents)
            .where(eq(paymentIntents.externalIntentId, externalId))
            .limit(1);
          internalIntentId = found?.id;
        }

        if (internalIntentId) {
          resolvedIntentId = internalIntentId;
          // P0 FIX: Validación de negocio del cobro (monto, moneda y status)
          await confirmPaymentIntentSettled(restaurantDb, {
            paymentIntentId: internalIntentId,
            externalTransactionId: pi.latest_charge || externalId,
            verifiedMethod: "STRIPE_CARD",
            expectedAmountCents: typeof pi.amount === "number" ? pi.amount : undefined,
            expectedCurrency: pi.currency ? pi.currency.toUpperCase() : undefined,
          });
          console.log(`[Stripe Webhook] Intento ${internalIntentId} liquidado exitosamente.`);
        } else {
          console.warn(`[Stripe Webhook] PaymentIntent ${externalId} no tiene intento interno en Rabbitty.`);
        }
        break;
      }

      case "payment_intent.payment_failed":
      case "payment_intent.canceled": {
        const pi = event.data.object;
        const externalId = pi.id;
        let internalIntentId = pi.metadata?.rabbittyIntentId;

        if (!internalIntentId) {
          const [found] = await restaurantDb
            .select()
            .from(paymentIntents)
            .where(eq(paymentIntents.externalIntentId, externalId))
            .limit(1);
          internalIntentId = found?.id;
        }

        if (internalIntentId) {
          resolvedIntentId = internalIntentId;
          const failureMsg = pi.last_payment_error?.message || "Stripe payment failed or canceled";
          await releasePaymentIntentHold(restaurantDb, {
            paymentIntentId: internalIntentId,
            reason: failureMsg,
          });
          console.log(`[Stripe Webhook] Intento ${internalIntentId} cancelado y hold liberado: ${failureMsg}`);
        }
        break;
      }

      default:
        // Otros eventos informativos
        break;
    }

    // P0 FIX: Marcar el evento como COMPLETADO tras finalizar con éxito la saga
    await markProviderWebhookEventCompleted(restaurantDb, event.id, resolvedIntentId);

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("[Stripe Webhook] Error procesando evento de Stripe:", error);
    // P0 FIX: Marcar como FAILED en DB para auditoría y devolver 500 para que Stripe reintente
    await markProviderWebhookEventFailed(restaurantDb, event.id, error.message || "Error procesando webhook");
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
