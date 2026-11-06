import Stripe from "stripe";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { merchantPaymentAccounts, paymentIntents, orders } from "@rabbitty/database-restaurant/schema";

// STRIPE_SUPPRESS_NOTICES se configura como variable de entorno en Railway y
// Vercel (silencia solo el aviso de versión de la API, no errores de Stripe).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

let stripeInstance: Stripe | null = null;

export function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "STRIPE_SECRET_KEY no está configurada en las variables de entorno.",
    });
  }
  if (!stripeInstance) {
    stripeInstance = new Stripe(secretKey, {
      apiVersion: "2024-06-20" as any,
      appInfo: {
        name: "Rabbitty Pay",
        version: "1.0.0",
      },
    });
  }
  return stripeInstance;
}

/**
 * Cancela un PaymentIntent en Stripe (idempotente).
 *
 * P0-1: al cancelar un cobro en Rabbitty también hay que anular el intent en
 * Stripe; si no, el `client_secret` sigue vivo y el comensal puede pagar
 * después (doble cobro: efectivo + tarjeta).
 *
 * Devuelve el estado real para que el caller decida:
 *  - "canceled"        → anulado ahora
 *  - "already_canceled"→ ya estaba anulado (reintento seguro)
 *  - "succeeded"       → ya se cobró: NO se puede cancelar
 *  - "not_found"       → no existe en Stripe (nada que anular)
 */
export type StripeCancelResult = "canceled" | "already_canceled" | "succeeded" | "not_found";

export async function cancelStripePaymentIntent(
  externalIntentId: string
): Promise<StripeCancelResult> {
  const stripe = getStripeClient();

  try {
    const pi = await stripe.paymentIntents.cancel(externalIntentId, {
      cancellation_reason: "abandoned",
    });
    return pi.status === "canceled" ? "canceled" : "already_canceled";
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "resource_missing") return "not_found";

    // Si no se pudo cancelar, consultar el estado real (idempotencia).
    try {
      const pi = await stripe.paymentIntents.retrieve(externalIntentId);
      if (pi.status === "canceled") return "already_canceled";
      if (pi.status === "succeeded") return "succeeded";
    } catch {
      /* cae al throw original */
    }

    throw err;
  }
}

/**
 * Lee el estado real de un PaymentIntent en Stripe (para reconciliar cuando
 * el polling detecta que el intent local expiró pero Stripe ya cobró).
 */
export async function retrieveStripePaymentIntent(externalIntentId: string): Promise<{
  id: string;
  status: string;
  amount: number;
  currency: string;
  latestCharge?: string;
  destination?: string;
  succeededAt?: Date;
}> {
  const stripe = getStripeClient();
  const pi = await stripe.paymentIntents.retrieve(externalIntentId);
  const charge = pi.latest_charge;
  const destination = pi.transfer_data?.destination;
  const transitions = (pi as unknown as {
    status_transitions?: { succeeded_at?: number | null };
  }).status_transitions;
  return {
    id: pi.id,
    status: pi.status,
    amount: pi.amount,
    currency: pi.currency,
    latestCharge: typeof charge === "string" ? charge : charge?.id,
    destination: typeof destination === "string" ? destination : destination?.id,
    succeededAt: transitions?.succeeded_at
      ? new Date(transitions.succeeded_at * 1000)
      : undefined,
  };
}

/**
 * Obtiene la cuenta conectada activa para una sucursal dada.
 */
export async function getMerchantPaymentAccount(db: Db, branchId: string) {
  const [account] = await db
    .select()
    .from(merchantPaymentAccounts)
    .where(eq(merchantPaymentAccounts.branchId, branchId))
    .limit(1);

  return account ?? null;
}

/**
 * Inicia el proceso de Onboarding de Stripe Connect Express para una sucursal.
 * Crea una cuenta conectada si aún no existe y genera el enlace del Account Link.
 */
export async function createStripeConnectOnboardingLink(params: {
  db: Db;
  branchId: string;
  refreshUrl: string;
  returnUrl: string;
  email?: string;
  businessName?: string;
}): Promise<{ url: string; stripeAccountId: string }> {
  const stripe = getStripeClient();
  let accountRecord = await getMerchantPaymentAccount(params.db, params.branchId);

  let stripeAccountId = accountRecord?.stripeAccountId;

  // H24: al pasar de test a live los `acct_...` de prueba NO existen en live
  // (y una cuenta puede haberse eliminado en Stripe). Sin esto, el link de
  // onboarding fallaría con "No such account" y el afiliado no podría cobrar.
  if (stripeAccountId) {
    try {
      await stripe.accounts.retrieve(stripeAccountId);
    } catch {
      console.warn(
        `[StripeConnect] cuenta ${stripeAccountId} no existe en este modo (test→live o eliminada) — se recrea`
      );
      stripeAccountId = undefined;
    }
  }

  if (!stripeAccountId) {
    // Crear cuenta Stripe Express para México (MXN)
    const account = await stripe.accounts.create({
      type: "express",
      country: "MX",
      email: params.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: "individual",
      business_profile: {
        name: params.businessName ?? "Comercio Rabbitty",
        mcc: "5812", // Restaurantes y locales de comida
      },
      metadata: {
        branchId: params.branchId,
        platform: "Rabbitty",
      },
    });

    stripeAccountId = account.id;

    if (accountRecord) {
      // Reutilizamos la fila (conserva platformFeePercent y metadata)
      await params.db
        .update(merchantPaymentAccounts)
        .set({
          stripeAccountId: account.id,
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled,
          updatedAt: new Date(),
        })
        .where(eq(merchantPaymentAccounts.id, accountRecord.id));
    } else {
      const [created] = await params.db
        .insert(merchantPaymentAccounts)
        .values({
          branchId: params.branchId,
          stripeAccountId: account.id,
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled,
          defaultCurrency: "MXN",
          platformFeePercent: 0.01, // 1% comisión plataforma por defecto
        })
        .returning();

      accountRecord = created;
    }
  }

  // Generar link de onboarding
  const accountLink = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: params.refreshUrl,
    return_url: params.returnUrl,
    type: "account_onboarding",
  });

  return {
    url: accountLink.url,
    stripeAccountId,
  };
}

/**
 * Sincroniza el estado de la cuenta Stripe Connect (charges_enabled, payouts_enabled)
 */
export async function syncStripeAccountStatus(params: {
  db: Db;
  branchId: string;
}): Promise<{
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  stripeAccountId?: string;
}> {
  const stripe = getStripeClient();
  const accountRecord = await getMerchantPaymentAccount(params.db, params.branchId);
  if (!accountRecord?.stripeAccountId) {
    return { chargesEnabled: false, payoutsEnabled: false };
  }

  // H24: si la cuenta es de test (o fue eliminada), `retrieve` truena en live.
  // Devolvemos "no habilitado" en vez de romper el panel del afiliado; el
  // onboarding se auto-repara al pedir el link (createStripeConnectOnboardingLink).
  let account: Awaited<ReturnType<typeof stripe.accounts.retrieve>>;
  try {
    account = await stripe.accounts.retrieve(accountRecord.stripeAccountId);
  } catch (err: any) {
    console.warn(
      `[StripeConnect] no se pudo leer ${accountRecord.stripeAccountId}: ${err?.message ?? err}`
    );
    return {
      chargesEnabled: false,
      payoutsEnabled: false,
      stripeAccountId: accountRecord.stripeAccountId,
    };
  }

  await params.db
    .update(merchantPaymentAccounts)
    .set({
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      updatedAt: new Date(),
    })
    .where(eq(merchantPaymentAccounts.id, accountRecord.id));

  return {
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    stripeAccountId: accountRecord.stripeAccountId,
  };
}

/**
 * Crea o sincroniza un Stripe PaymentIntent para un intento interno de Rabbitty Pay.
 * Aplica Destination Charges o Direct Charges con Application Fee hacia la cuenta conectada.
 */
export async function createStripePaymentIntent(params: {
  db: Db;
  intentId: string;
}): Promise<{
  clientSecret: string;
  stripePaymentIntentId: string;
}> {
  const stripe = getStripeClient();

  const [intent] = await params.db
    .select()
    .from(paymentIntents)
    .where(eq(paymentIntents.id, params.intentId))
    .limit(1);

  if (!intent) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Intento de pago no encontrado en el sistema.",
    });
  }

  if (intent.netFiatCents <= 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "El monto fiat en centavos debe ser mayor a 0 para cobrar con tarjeta.",
    });
  }

  const accountRecord = await getMerchantPaymentAccount(params.db, intent.merchantId);
  if (!accountRecord || !accountRecord.chargesEnabled) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "La sucursal no tiene una cuenta de cobros Stripe habilitada y verificada.",
    });
  }

  // Si ya existía un externalIntentId en Stripe, lo recuperamos
  if (intent.externalIntentId) {
    try {
      const existingPi = await stripe.paymentIntents.retrieve(intent.externalIntentId);
      if (existingPi && existingPi.client_secret) {
        return {
          clientSecret: existingPi.client_secret,
          stripePaymentIntentId: existingPi.id,
        };
      }
    } catch (e) {
      // Si fue cancelado o expirado en Stripe, procedemos a crear uno nuevo
    }
  }

  // Comisión de plataforma en centavos
  const applicationFeeAmount = Math.max(0, intent.platformFeeCents);

  // Crear PaymentIntent con Destination Charge hacia la cuenta conectada e Idempotency Key de Stripe
  const pi = await stripe.paymentIntents.create(
    {
      amount: intent.netFiatCents,
      currency: (intent.currency || "MXN").toLowerCase(),
      automatic_payment_methods: { enabled: true },
      application_fee_amount: applicationFeeAmount > 0 ? applicationFeeAmount : undefined,
      transfer_data: {
        destination: accountRecord.stripeAccountId,
      },
      metadata: {
        rabbittyIntentId: intent.id,
        orderId: intent.orderId ?? "",
        branchId: intent.merchantId,
        payerSubjectId: intent.payerSubjectId ?? "",
      },
    },
    {
      idempotencyKey: intent.idempotencyKey ? `stripe_pi_${intent.idempotencyKey}` : undefined,
    }
  );

  if (!pi.client_secret) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Stripe no retornó client_secret.",
    });
  }

  // Guardar externalIntentId en el intento interno
  await params.db
    .update(paymentIntents)
    .set({
      externalIntentId: pi.id,
      provider: "STRIPE",
      updatedAt: new Date(),
    })
    .where(eq(paymentIntents.id, intent.id));

  return {
    clientSecret: pi.client_secret,
    stripePaymentIntentId: pi.id,
  };
}
