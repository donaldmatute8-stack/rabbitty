import Stripe from "stripe";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { merchantPaymentAccounts, paymentIntents, orders } from "@rabbitty/database-restaurant/schema";

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

  const account = await stripe.accounts.retrieve(accountRecord.stripeAccountId);

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
