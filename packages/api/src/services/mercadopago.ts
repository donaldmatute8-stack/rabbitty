import crypto from "crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  merchantPaymentProviderConfigs,
  paymentIntents,
  payments,
  orders,
} from "@rabbitty/database-restaurant/schema";
import { confirmPaymentIntentSettled } from "./paymentCore";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

const MP_API = "https://api.mercadopago.com";
const PROVIDER = "MERCADO_PAGO";
const ADMIN_URL = process.env.ADMIN_PUBLIC_URL || "https://admin.rabbitty.me";
const APP_URL = process.env.MINIAPP_PUBLIC_URL || "https://app.rabbitty.me";
const INTENT_TTL_MS = 2 * 60 * 60 * 1000; // 2 h para pagar un link de Mercado Pago

/* ────────────────────────────────────────────────────────────────────────────
 * Cifrado de credenciales (AES-256-GCM)
 * La llave se deriva de PAYMENTS_ENCRYPTION_KEY o, si no existe, del secreto
 * de Stripe que ya vive en el mismo servicio. Nunca se devuelve al cliente.
 * ──────────────────────────────────────────────────────────────────────────── */
function encryptionKey(): Buffer {
  const base =
    process.env.PAYMENTS_ENCRYPTION_KEY ||
    process.env.STRIPE_SECRET_KEY ||
    "rabbitty-pay-local";
  return crypto.createHash("sha256").update(`rabbitty-pay:${base}`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  if (!payload.startsWith("v1:")) return payload; // compat: texto plano legado
  const [, ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("MP_CREDENTIALS_CORRUPT");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/* ────────────────────────────────────────────────────────────────────────────
 * Cliente HTTP de Mercado Pago
 * ──────────────────────────────────────────────────────────────────────────── */
async function mpFetch(
  path: string,
  accessToken: string,
  init: RequestInit = {}
): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(`${MP_API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
      signal: controller.signal,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const msg =
        (json as any)?.message ||
        (json as any)?.error ||
        `Mercado Pago respondió ${res.status}`;
      throw new Error(msg);
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Configuración por sucursal
 * ──────────────────────────────────────────────────────────────────────────── */
export interface MercadoPagoConfig {
  row: any;
  accessToken: string | null;
  metadata: Record<string, any>;
}

export async function getMercadoPagoConfig(
  db: Db,
  branchId: string
): Promise<MercadoPagoConfig | null> {
  const [row] = await db
    .select()
    .from(merchantPaymentProviderConfigs)
    .where(
      and(
        eq(merchantPaymentProviderConfigs.branchId, branchId),
        eq(merchantPaymentProviderConfigs.provider, PROVIDER)
      )
    )
    .limit(1);
  if (!row) return null;

  const creds = (row.credentials || {}) as { accessToken?: string };
  let accessToken: string | null = null;
  if (creds.accessToken) {
    try {
      accessToken = decryptSecret(creds.accessToken);
    } catch {
      accessToken = null;
    }
  }
  return { row, accessToken, metadata: (row.metadata || {}) as Record<string, any> };
}

/** Estado público (sin credenciales) para admin y app. */
export async function getMercadoPagoStatus(db: Db, branchId: string) {
  const config = await getMercadoPagoConfig(db, branchId);
  if (!config) {
    return {
      connected: false,
      available: false,
      mode: "test" as "test" | "live",
      mpUserId: null,
      nickname: null,
      terminalConfigured: false,
      status: "DISCONNECTED",
      lastCheckedAt: null,
    };
  }
  return {
    connected: Boolean(config.accessToken) && config.row.status === "ACTIVE",
    available: Boolean(config.accessToken) && config.row.status === "ACTIVE",
    mode: (config.row.mode || "test") as "test" | "live",
    mpUserId: config.metadata.mpUserId ?? null,
    nickname: config.metadata.nickname ?? null,
    terminalConfigured: Boolean(config.metadata.terminalId),
    status: config.row.status,
    lastCheckedAt: config.metadata.lastCheckedAt ?? null,
  };
}

export async function saveMercadoPagoConfig(params: {
  db: Db;
  branchId: string;
  accessToken: string;
  terminalId?: string | null;
}) {
  const token = params.accessToken.trim();
  if (!token) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "El access token de Mercado Pago es obligatorio." });
  }

  let me: any;
  try {
    me = await mpFetch("/users/me", token);
  } catch (err) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Mercado Pago rechazó las credenciales: ${err instanceof Error ? err.message : "token inválido"}`,
    });
  }

  const mode = token.startsWith("TEST-") ? "test" : "live";
  const metadata = {
    mpUserId: me?.id ? String(me.id) : null,
    nickname: me?.nickname ?? null,
    email: me?.email ?? null,
    siteId: me?.site_id ?? null,
    terminalId: params.terminalId?.trim() || null,
    lastCheckedAt: new Date().toISOString(),
  };

  const values = {
    branchId: params.branchId,
    provider: PROVIDER,
    status: "ACTIVE",
    mode,
    credentials: { accessToken: encryptSecret(token) },
    metadata,
    updatedAt: new Date(),
  };

  await params.db
    .insert(merchantPaymentProviderConfigs)
    .values(values)
    .onConflictDoUpdate({
      target: [merchantPaymentProviderConfigs.branchId, merchantPaymentProviderConfigs.provider],
      set: {
        status: values.status,
        mode: values.mode,
        credentials: values.credentials,
        metadata: values.metadata,
        updatedAt: values.updatedAt,
      },
    });

  return { connected: true, mode, ...metadata };
}

export async function disconnectMercadoPago(db: Db, branchId: string) {
  await db
    .update(merchantPaymentProviderConfigs)
    .set({
      status: "DISCONNECTED",
      credentials: null,
      metadata: { lastCheckedAt: new Date().toISOString() },
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(merchantPaymentProviderConfigs.branchId, branchId),
        eq(merchantPaymentProviderConfigs.provider, PROVIDER)
      )
    );
  return { connected: false };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Checkout (Checkout Pro: link/QR hospedado por Mercado Pago)
 * ──────────────────────────────────────────────────────────────────────────── */
export async function createMercadoPagoCheckout(params: {
  db: Db;
  branchId: string;
  orderId: string;
  payerUserId?: string | null;
  tipMxn?: number;
}) {
  const config = await getMercadoPagoConfig(params.db, params.branchId);
  if (!config?.accessToken || config.row.status !== "ACTIVE") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "MERCADO_PAGO_NOT_READY: este negocio aún no tiene Mercado Pago configurado.",
    });
  }

  const [order] = await params.db
    .select()
    .from(orders)
    .where(eq(orders.id, params.orderId))
    .limit(1);
  if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Orden no encontrada." });
  if (String(order.branchId) !== String(params.branchId)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "La orden no pertenece a esta sucursal." });
  }

  const paidRows = await params.db
    .select({ amount: payments.amount })
    .from(payments)
    .where(and(eq(payments.orderId, params.orderId), eq(payments.status, "COMPLETED")));
  const paid = paidRows.reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0);
  const tip = Math.max(0, Number(params.tipMxn || 0));
  const amount = Math.max(0, Number(order.total || 0) + tip - paid);
  if (amount <= 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Esta cuenta ya está liquidada." });
  }

  const amountCents = Math.round(amount * 100);

  // Reutiliza el intent MP vigente por el mismo monto; si cambió (propina),
  // lo cancela y crea uno nuevo para no cobrar un monto viejo.
  const [live] = await params.db
    .select()
    .from(paymentIntents)
    .where(
      and(
        eq(paymentIntents.orderId, params.orderId),
        eq(paymentIntents.provider, PROVIDER),
        eq(paymentIntents.status, "PENDING_PAYMENT")
      )
    )
    .orderBy(desc(paymentIntents.createdAt))
    .limit(1);

  let intent = live;
  if (intent && Number(intent.netFiatCents) !== amountCents) {
    await params.db
      .update(paymentIntents)
      .set({ status: "CANCELLED" })
      .where(eq(paymentIntents.id, intent.id));
    intent = undefined;
  }

  if (!intent) {
    const [created] = await params.db
      .insert(paymentIntents)
      .values({
        orderId: params.orderId,
        merchantId: params.branchId,
        creatorSubjectId: PROVIDER,
        payerSubjectId: params.payerUserId || null,
        amountCents,
        netFiatCents: amountCents,
        platformFeeCents: Math.round(amountCents * 0.01),
        amountMxn: amount,
        bunzAmount: 0,
        tipMxn: tip,
        currency: "MXN",
        provider: PROVIDER,
        status: "PENDING_PAYMENT",
        idempotencyKey: `mp_${params.orderId}_${Date.now()}`,
        expiresAt: new Date(Date.now() + INTENT_TTL_MS),
      })
      .returning();
    intent = created;
  }

  const preference = await mpFetch("/checkout/preferences", config.accessToken, {
    method: "POST",
    headers: { "Idempotency-Key": `pref_${intent.id}` },
    body: JSON.stringify({
      items: [
        {
          id: params.orderId,
          title: `Cuenta #${String(params.orderId).slice(0, 8)}`,
          quantity: 1,
          unit_price: amount,
          currency_id: "MXN",
        },
      ],
      external_reference: intent.id,
      notification_url: `${ADMIN_URL}/api/webhooks/mercadopago?branchId=${encodeURIComponent(params.branchId)}`,
      back_urls: {
        success: `${APP_URL}/pay/${params.orderId}?mp=success`,
        pending: `${APP_URL}/pay/${params.orderId}?mp=pending`,
        failure: `${APP_URL}/pay/${params.orderId}?mp=failure`,
      },
      auto_return: "approved",
      statement_descriptor: "RABBITTY",
      metadata: {
        orderId: params.orderId,
        branchId: params.branchId,
        intentId: intent.id,
      },
    }),
  });

  await params.db
    .update(paymentIntents)
    .set({ externalIntentId: String(preference.id) })
    .where(eq(paymentIntents.id, intent.id));

  const mode = config.row.mode === "live" ? "live" : "test";
  return {
    intentId: intent.id,
    preferenceId: String(preference.id),
    initPoint: String(
      mode === "test" && preference.sandbox_init_point
        ? preference.sandbox_init_point
        : preference.init_point
    ),
    amount,
    mode,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Verificación y liquidación
 * ──────────────────────────────────────────────────────────────────────────── */
async function settleFromMpPayment(db: Db, intent: any, payment: any) {
  const status = String(payment?.status || "");
  if (status !== "approved") {
    return { settled: false, status };
  }

  const amountCents = Math.round(Number(payment?.transaction_amount || 0) * 100);
  if (amountCents !== Number(intent.netFiatCents)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Monto de Mercado Pago no coincide. Esperado: ${intent.netFiatCents} centavos, recibido: ${amountCents}.`,
    });
  }

  const result = await confirmPaymentIntentSettled(db, {
    paymentIntentId: intent.id,
    externalTransactionId: String(payment.id),
    verifiedMethod: "MERCADO_PAGO",
    expectedAmountCents: amountCents,
    expectedCurrency: String(payment.currency_id || "MXN"),
    expectedBranchId: intent.merchantId,
    paidAtExternal: payment.date_approved ? new Date(payment.date_approved) : new Date(),
  });

  return { settled: result.success, status: result.status, orderId: result.orderId };
}

/** Pago por id (webhook): resuelve token por sucursal y liquida si aplica. */
export async function handleMercadoPagoPayment(params: {
  db: Db;
  branchId: string;
  paymentId: string;
}) {
  const config = await getMercadoPagoConfig(params.db, params.branchId);
  if (!config?.accessToken) {
    return { handled: false, reason: "MERCADO_PAGO_NOT_CONFIGURED" };
  }

  const payment = await mpFetch(`/v1/payments/${encodeURIComponent(params.paymentId)}`, config.accessToken);
  const intentId = String(payment?.external_reference || "");
  if (!intentId) return { handled: false, reason: "NO_EXTERNAL_REFERENCE" };

  const [intent] = await params.db
    .select()
    .from(paymentIntents)
    .where(eq(paymentIntents.id, intentId))
    .limit(1);
  if (!intent) return { handled: false, reason: "INTENT_NOT_FOUND" };
  if (String(intent.merchantId) !== String(params.branchId)) {
    return { handled: false, reason: "BRANCH_MISMATCH" };
  }

  if (intent.status === "SUCCEEDED") {
    return { handled: true, settled: true, status: "SUCCEEDED" };
  }

  const result = await settleFromMpPayment(params.db, intent, payment);
  return { handled: true, ...result };
}

/**
 * Verificación desde la app ("Ya pagué" / al volver del checkout).
 * Busca por external_reference los pagos del intent MP vigente.
 */
export async function verifyMercadoPagoForOrder(params: {
  db: Db;
  orderId: string;
}) {
  const [order] = await params.db
    .select()
    .from(orders)
    .where(eq(orders.id, params.orderId))
    .limit(1);
  if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Orden no encontrada." });

  const config = await getMercadoPagoConfig(params.db, String(order.branchId));
  if (!config?.accessToken) {
    return { settled: false, reason: "MERCADO_PAGO_NOT_CONFIGURED" };
  }

  const intents = await params.db
    .select()
    .from(paymentIntents)
    .where(
      and(
        eq(paymentIntents.orderId, params.orderId),
        eq(paymentIntents.provider, PROVIDER),
        inArray(paymentIntents.status, ["PENDING_PAYMENT", "PROCESSING", "REQUIRES_ACTION", "SUCCEEDED"])
      )
    )
    .orderBy(desc(paymentIntents.createdAt))
    .limit(3);

  if (intents.length === 0) return { settled: false, reason: "NO_MP_INTENT" };

  for (const intent of intents) {
    if (intent.status === "SUCCEEDED") return { settled: true, status: "SUCCEEDED" };
    try {
      const search = await mpFetch(
        `/v1/payments/search?external_reference=${encodeURIComponent(intent.id)}&sort=date_created&criteria=desc`,
        config.accessToken
      );
      const results: any[] = Array.isArray(search?.results) ? search.results : [];
      const approved = results.find((p) => String(p?.status) === "approved");
      if (approved) {
        const result = await settleFromMpPayment(params.db, intent, approved);
        return { ...result, paymentId: String(approved.id) };
      }
      const pending = results.find((p) => ["pending", "in_process", "authorized"].includes(String(p?.status)));
      if (pending) return { settled: false, status: String(pending.status) };
    } catch (err) {
      console.error("[MP_VERIFY]", err instanceof Error ? err.message : err);
    }
  }

  return { settled: false, status: "PENDING" };
}
