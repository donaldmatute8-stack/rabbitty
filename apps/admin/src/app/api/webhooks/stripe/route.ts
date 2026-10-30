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
import {
  membershipPlans,
  membershipPlanVersions,
  membershipSubscriptions,
} from "@rabbitty/database-core/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

// ── Notificación in-app para el dueño de la membresía (webhook no tiene acceso al
//    push de la miniapp; insert directo en core notifications, con deep-link) ──
async function notifyMembershipUser(
  coreDb: ReturnType<typeof getCoreDb>,
  userId: string,
  title: string,
  message: string,
  route = "/memberships"
) {
  try {
    await coreDb.execute(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (await import("drizzle-orm")).sql`INSERT INTO "notifications" ("id", "userId", "title", "message", "type", "route") VALUES (gen_random_uuid()::text, ${userId}, ${title}, ${message}, 'REWARD', ${route})`
    );
  } catch (e) {
    console.error("[Stripe Webhook] notificación membresía falló:", e);
  }
}



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

      case "checkout.session.completed": {
        // ── Membresías: alta de suscripción tras el pago (Stripe Connect) ──
        const session = event.data.object;
        const meta = session.metadata || {};
        if (meta.kind === "MEMBERSHIP_SUBSCRIPTION" && session.mode === "subscription" && session.subscription) {
          const coreDb = getCoreDb();
          const stripe = getStripeClient();
          const acct = meta.stripeAccount || event.account;
          // Recuperar la suscripción de Stripe (en la cuenta conectada) para el periodo real
          const stripeSub = acct
            ? await stripe.subscriptions.retrieve(session.subscription, {} as any, { stripeAccount: acct })
            : await stripe.subscriptions.retrieve(session.subscription);

          const periodStart = new Date((stripeSub as any).current_period_start * 1000);
          const periodEnd = new Date((stripeSub as any).current_period_end * 1000);

          // Idempotente: si ya existe por paymentProviderSubId, no duplicar
          const [dup] = await coreDb.select({ id: membershipSubscriptions.id })
            .from(membershipSubscriptions)
            .where(eq(membershipSubscriptions.paymentProviderSubId, String(session.subscription)))
            .limit(1);
          if (!dup) {
            await coreDb.insert(membershipSubscriptions).values({
              userId: meta.userId,
              businessId: meta.businessId,
              planVersionId: meta.planVersionId,
              status: "ACTIVE",
              currentPeriodStart: periodStart,
              currentPeriodEnd: periodEnd,
              paymentProvider: "STRIPE",
              membershipOrigin: "PURCHASED",
              paymentProviderSubId: String(session.subscription),
              qrPassSecret: (await import("crypto")).randomBytes(32).toString("hex"),
            });
            console.log(`[Stripe Webhook] Membresía activada: user=${meta.userId} plan=${meta.planVersionId}`);
            await notifyMembershipUser(coreDb, meta.userId, "🎟️ ¡Membresía activada!", "Tu pago fue confirmado y tu membresía ya está activa. Muéstrala en caja con su QR dorado.", "/memberships");
            // Bidireccional: avisa al DUEÑO del negocio la venta
            try {
              const [bizRow] = await coreDb.select({ ownerId: (await import("@rabbitty/database-core/schema")).ownedBusinesses.ownerId, name: (await import("@rabbitty/database-core/schema")).ownedBusinesses.name })
                .from((await import("@rabbitty/database-core/schema")).ownedBusinesses)
                .where((await import("drizzle-orm")).eq((await import("@rabbitty/database-core/schema")).ownedBusinesses.id, meta.businessId))
                .limit(1);
              if (bizRow?.ownerId) await notifyMembershipUser(coreDb, bizRow.ownerId, "💸 Vendiste una membresía", `Nuevo miembro activo en ${bizRow.name} — la cuota llega por Stripe.`, "/memberships");
            } catch (ownErr) { console.error("[Stripe Webhook] notify owner falló:", ownErr); }
          }
        }
        break;
      }

      case "invoice.paid":
      case "invoice.payment_succeeded": {
        // ── Membresías: renovación del ciclo → extender currentPeriodEnd ──
        const invoice = event.data.object;
        const stripeSubId = invoice.subscription;
        if (stripeSubId) {
          const coreDb = getCoreDb();
          const [sub] = await coreDb.select({ sub: membershipSubscriptions, version: membershipPlanVersions })
            .from(membershipSubscriptions)
            .innerJoin(membershipPlanVersions, eq(membershipPlanVersions.id, membershipSubscriptions.planVersionId))
            .where(eq(membershipSubscriptions.paymentProviderSubId, String(stripeSubId)))
            .limit(1);
          if (sub) {
            const interval = sub.version.billingInterval;
            const months = { MONTHLY: 1, QUARTERLY: 3, SEMIANNUAL: 6, ANNUAL: 12, ONE_TIME: 0 }[interval] ?? 1;
            const base = sub.sub.currentPeriodEnd && sub.sub.currentPeriodEnd > new Date() ? sub.sub.currentPeriodEnd : new Date();
            const newEnd = new Date(base);
            newEnd.setMonth(newEnd.getMonth() + months);
            await coreDb.update(membershipSubscriptions)
              .set({ currentPeriodEnd: newEnd, status: "ACTIVE", updatedAt: new Date() })
              .where(eq(membershipSubscriptions.id, sub.sub.id));
            console.log(`[Stripe Webhook] Renovación aplicada: sub=${sub.sub.id} → ${newEnd.toISOString()}`);
            await notifyMembershipUser(coreDb, sub.sub.userId, "🔄 Membresía renovada", `Tu cuota se pagó correctamente — membresía vigente hasta ${newEnd.toLocaleDateString("es-MX")}.`, "/memberships");
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        // ── Membresías: Stripe canceló la suscripción → EXPIRED ──
        const stripeSub = event.data.object;
        const coreDb = getCoreDb();
        const [expiredSub] = await coreDb.select({ userId: membershipSubscriptions.userId })
          .from(membershipSubscriptions)
          .where(eq(membershipSubscriptions.paymentProviderSubId, String(stripeSub.id)))
          .limit(1);
        await coreDb.update(membershipSubscriptions)
          .set({ status: "EXPIRED", updatedAt: new Date() })
          .where(eq(membershipSubscriptions.paymentProviderSubId, String(stripeSub.id)));
        if (expiredSub?.userId) {
          await notifyMembershipUser(coreDb, expiredSub.userId, "⚠️ Tu membresía expiró", "El periodo pagado terminó. Renuévate desde el perfil del negocio para seguir disfrutando tus beneficios.", "/memberships");
        }
        break;
      }

      case "customer.subscription.updated": {
        // ── Membresías: cancel_at_period_end o pausa → reflejar estado ──
        const stripeSubUpd = event.data.object;
        const coreDb = getCoreDb();
        const cancelAtEnd = !!stripeSubUpd.cancel_at_period_end;
        await coreDb.update(membershipSubscriptions)
          .set({ cancelAtPeriodEnd: cancelAtEnd, updatedAt: new Date() })
          .where(eq(membershipSubscriptions.paymentProviderSubId, String(stripeSubUpd.id)));
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
