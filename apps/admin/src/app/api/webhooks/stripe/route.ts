import { NextResponse } from "next/server";
import { getStripeClient } from "@rabbitty/api/services/stripeConnect";
import { getRestaurantDb, getCoreDb } from "@rabbitty/api/db";
import {
  registerProviderWebhookEvent,
  markProviderWebhookEventCompleted,
  markProviderWebhookEventFailed,
  markProviderWebhookEventDiscrepancy,
  confirmPaymentIntentSettled,
  releasePaymentIntentHold,
} from "@rabbitty/api/services/paymentCore";
import { paymentIntents } from "@rabbitty/database-restaurant/schema";
import {
  membershipPlans,
  membershipPlanVersions,
  membershipSubscriptions,
  membershipEntitlements,
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

  // H24: en Stripe cada "event destination" tiene SU propio signing secret.
  // Como necesitamos dos destinos (Your account + Connected accounts) para
  // cubrir cobros del POS y membresías de afiliados, STRIPE_WEBHOOK_SECRET
  // acepta una lista separada por comas y validamos contra cada una.
  const webhookSecrets = webhookSecret.split(",").map((s) => s.trim()).filter(Boolean);
  const rawBody = await req.text();

  let event: any;
  let lastErr: any = null;
  for (const secret of webhookSecrets) {
    try {
      event = getStripeClient().webhooks.constructEvent(rawBody, signature, secret);
      break;
    } catch (err: any) {
      lastErr = err;
    }
  }
  if (!event) {
    console.error("[Stripe Webhook] Error verificando firma criptográfica:", lastErr?.message);
    return NextResponse.json(
      { error: `Firma inválida: ${lastErr?.message ?? "sin secretos configurados"}` },
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

  let resolvedIntentId: string | undefined;

  try {
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
          const destination = pi.transfer_data?.destination;
          const destinationId =
            typeof destination === "string" ? destination : destination?.id;
          const transitions = (pi as {
            status_transitions?: { succeeded_at?: number | null };
          }).status_transitions;

          await confirmPaymentIntentSettled(restaurantDb, {
            paymentIntentId: internalIntentId,
            externalTransactionId: pi.latest_charge || externalId,
            verifiedMethod: "STRIPE_CARD",
            expectedAmountCents: typeof pi.amount === "number" ? pi.amount : undefined,
            expectedCurrency: pi.currency ? pi.currency.toUpperCase() : undefined,
            expectedBranchId:
              typeof pi.metadata?.branchId === "string" ? pi.metadata.branchId : undefined,
            expectedStripeAccountId: destinationId,
            paidAtExternal: transitions?.succeeded_at
              ? new Date(transitions.succeeded_at * 1000)
              : event.created
                ? new Date(event.created * 1000)
                : undefined,
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

          // H24: en versiones nuevas el periodo vive en el subscription item.
          const subAny = stripeSub as any;
          const item = subAny.items?.data?.[0];
          const periodStart = new Date((subAny.current_period_start ?? item?.current_period_start) * 1000);
          const periodEnd = new Date((subAny.current_period_end ?? item?.current_period_end) * 1000);

          // Idempotente: si ya existe por paymentProviderSubId, no duplicar
          const [dup] = await coreDb.select({ id: membershipSubscriptions.id })
            .from(membershipSubscriptions)
            .where(eq(membershipSubscriptions.paymentProviderSubId, String(session.subscription)))
            .limit(1);
          if (!dup) {
            const [newSub] = await coreDb.insert(membershipSubscriptions).values({
              userId: meta.userId,
              businessId: meta.businessId,
              planVersionId: meta.planVersionId,
              status: "ACTIVE",
              currentPeriodStart: periodStart,
              currentPeriodEnd: periodEnd,
              paymentProvider: "STRIPE",
              membershipOrigin: "PURCHASED",
              paymentProviderSubId: String(session.subscription),
              acquisitionSource: meta.acquisitionSource ?? "MARKETPLACE",
              checkoutSessionId: session.id,
              qrPassSecret: (await import("crypto")).randomBytes(32).toString("hex"),
            }).returning();
            // Entitlements: sin estas filas el pase no tiene beneficios que
            // canjear — mismas reglas que crea `subscribe` en caja.
            try {
              const [versionRow] = await coreDb.select({ version: membershipPlanVersions })
                .from(membershipPlanVersions)
                .where(eq(membershipPlanVersions.id, meta.planVersionId))
                .limit(1);
              const rules = (versionRow?.version?.benefitRules ?? []) as Array<{
                type: string; targetRefId?: string | null; quotaPerCycle?: number | null;
                cycleResetType?: string | null; discountPct?: number | null; creditBalance?: number | null;
              }>;
              // Réplica de addCycle (memberships.ts) al webhook no puede importar routers
              const addCycleWeb = (from: Date, reset: string | null | undefined, hardEnd: Date): Date => {
                if (reset === "MONTHLY") { const d = new Date(from); d.setUTCMonth(d.getUTCMonth() + 1); return d > hardEnd ? hardEnd : d; }
                if (reset === "WEEKLY") { const d = new Date(from); d.setUTCDate(d.getUTCDate() + 7); return d > hardEnd ? hardEnd : d; }
                if (reset === "DAILY") { const d = new Date(from); d.setUTCDate(d.getUTCDate() + 1); return d > hardEnd ? hardEnd : d; }
                return hardEnd; // FIXED / indefinido
              };
              const rows = rules.map((r) => ({
                subscriptionId: newSub.id,
                benefitType: r.type,
                targetRefId: r.targetRefId ?? null,
                quotaPerCycle: r.quotaPerCycle ?? 1,
                cycleResetType: r.cycleResetType ?? "FIXED",
                currentUsageInCycle: 0,
                cycleStartDate: periodStart,
                cycleEndDate: addCycleWeb(periodStart, r.cycleResetType, periodEnd),
                discountPct: r.discountPct ?? null,
                creditBalance: r.creditBalance ?? null,
              }));
              if (rows.length > 0) await coreDb.insert(membershipEntitlements).values(rows);
            } catch (entErr) {
              console.error("[Stripe Webhook] crear entitlements falló:", entErr);
            }
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

        // ── Membresías one-time: pago único, vigencia de 12 meses ──
        if (meta.kind === "MEMBERSHIP_ONE_TIME" && session.mode === "payment") {
          const coreDb = getCoreDb();
          const [dup] = await coreDb
            .select({ id: membershipSubscriptions.id })
            .from(membershipSubscriptions)
            .where(eq(membershipSubscriptions.checkoutSessionId, session.id))
            .limit(1);
          if (!dup) {
            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setFullYear(periodEnd.getFullYear() + 1);
            const [newSub] = await coreDb.insert(membershipSubscriptions).values({
              userId: meta.userId,
              businessId: meta.businessId,
              planVersionId: meta.planVersionId,
              status: "ACTIVE",
              currentPeriodStart: now,
              currentPeriodEnd: periodEnd,
              paymentProvider: "STRIPE",
              membershipOrigin: "PURCHASED",
              paymentProviderSubId: session.payment_intent ? String(session.payment_intent) : null,
              acquisitionSource: meta.acquisitionSource ?? "MARKETPLACE",
              checkoutSessionId: session.id,
              qrPassSecret: (await import("crypto")).randomBytes(32).toString("hex"),
            }).returning();

            try {
              const [versionRow] = await coreDb.select({ version: membershipPlanVersions })
                .from(membershipPlanVersions)
                .where(eq(membershipPlanVersions.id, meta.planVersionId))
                .limit(1);
              const rules = (versionRow?.version?.benefitRules ?? []) as Array<{
                type: string; targetRefId?: string | null; quotaPerCycle?: number | null;
                cycleResetType?: string | null; discountPct?: number | null; creditBalance?: number | null;
              }>;
              const addCycle = (from: Date, reset: string | null | undefined): Date => {
                const d = new Date(from);
                if (reset === "MONTHLY") d.setUTCMonth(d.getUTCMonth() + 1);
                else if (reset === "WEEKLY") d.setUTCDate(d.getUTCDate() + 7);
                else if (reset === "DAILY") d.setUTCDate(d.getUTCDate() + 1);
                else return periodEnd;
                return d > periodEnd ? periodEnd : d;
              };
              const rows = rules.map((r) => ({
                subscriptionId: newSub.id,
                benefitType: r.type,
                targetRefId: r.targetRefId ?? null,
                quotaPerCycle: r.quotaPerCycle ?? 1,
                cycleResetType: r.cycleResetType ?? "FIXED",
                currentUsageInCycle: 0,
                cycleStartDate: now,
                cycleEndDate: addCycle(now, r.cycleResetType),
                discountPct: r.discountPct ?? null,
                creditBalance: r.creditBalance ?? null,
              }));
              if (rows.length > 0) await coreDb.insert(membershipEntitlements).values(rows);
            } catch (entErr) {
              console.error("[Stripe Webhook] one-time entitlements falló:", entErr);
            }

            await notifyMembershipUser(coreDb, meta.userId, "🎟️ ¡Membresía activada!", "Tu pago fue confirmado y tu membresía ya está activa por 12 meses.", "/memberships");
          }
        }
        break;
      }

      case "invoice.paid":
      case "invoice.payment_succeeded": {
        // ── Membresías: renovación del ciclo → extender currentPeriodEnd ──
        const invoice = event.data.object;
        // H24: desde la API 2025-03-31 (basil) `invoice.subscription` se movió a
        // `invoice.parent.subscription_details.subscription`. Soportamos ambas
        // formas para que la renovación no se pierda si cambias la versión del
        // payload del webhook.
        const stripeSubId =
          invoice.subscription ||
          invoice.parent?.subscription_details?.subscription ||
          null;
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
    const message = error?.message || "Error procesando webhook";
    console.error("[Stripe Webhook] Error procesando evento de Stripe:", error);

    // ── P0-2: discrepancia de liquidación (no reintentable) ─────────────
    // Stripe ya cobró, pero el intent/orden ya no admite liquidación.
    // Se registra con ciclo de vida (DISCREPANCY) para reverso/conciliación.
    if (String(message).includes("SETTLEMENT_NOT_ALLOWED")) {
      console.error("[Stripe Webhook] DISCREPANCIA DE LIQUIDACIÓN:", message);
      await markProviderWebhookEventDiscrepancy(restaurantDb, {
        eventId: event.id,
        paymentIntentId: resolvedIntentId,
        code: "SETTLEMENT_NOT_ALLOWED",
        message,
      });
      return NextResponse.json(
        { received: true, discrepancy: true, message },
        { status: 200 }
      );
    }

    // Errores transitorios: marcar FAILED y 500 para que Stripe reintente
    await markProviderWebhookEventFailed(restaurantDb, event.id, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
