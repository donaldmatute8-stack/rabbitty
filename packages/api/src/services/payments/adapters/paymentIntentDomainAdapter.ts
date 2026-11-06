/**
 * ── Adapter: paymentIntentDomain → contratos canónicos (RP-0.1) ────────────
 *
 * Traduce el motor existente (PaymentIntentService) al lenguaje canónico.
 * **No cambia el comportamiento**: crea/consulta/aprueba exactamente igual que
 * hoy, solo mapea la forma de los datos.
 *
 * No está cableado a ninguna ruta todavía.
 */

import { PaymentIntentService } from "../../paymentIntentDomain";
import type { PaymentIntent as DomainPaymentIntent } from "../../paymentIntentDomain";
import {
  buildAmounts,
  toCanonicalIntentStatus,
  toMinorUnits,
  normalizeBunz,
  fromMinorUnits,
  type CanonicalPaymentIntent,
  type CreatePaymentIntentInput,
  type PaymentCurrency,
  type PaymentEngine,
  type PaymentResult,
} from "../contracts";

export function toCanonicalIntent(intent: DomainPaymentIntent): CanonicalPaymentIntent {
  const currency = (intent.currency || "MXN") as PaymentCurrency;
  const totalMinor = toMinorUnits(Number(intent.amountMxn || 0), currency);
  const bunz = normalizeBunz(Number(intent.bunzAmount || 0));
  const amounts = buildAmounts({ totalMinor, bunz, currency });

  return {
    id: intent.id,
    ids: {
      branchId: intent.tenantId,
      orderId: intent.orderId,
      customerId: intent.payerSubjectId,
      creatorId: intent.creatorSubjectId,
      intentId: intent.id,
    },
    status: toCanonicalIntentStatus(intent.status),
    method: "BUNZ",
    amounts,
    reference: { provider: "INTERNAL" },
    idempotencyKey: intent.idempotencyKey,
    expiresAt: intent.expiresAt,
    paidAt: intent.paidAt,
    createdAt: intent.createdAt,
  };
}

/**
 * Adapter del motor legacy. Delega en PaymentIntentService (misma autoridad),
 * por lo que no introduce una segunda escritura financiera.
 */
export function createPaymentIntentDomainAdapter(): PaymentEngine {
  return {
    async createIntent(input: CreatePaymentIntentInput): Promise<CanonicalPaymentIntent> {
      if (input.amounts.total.currency !== "MXN") {
        throw new Error("PAYMENT_ENGINE_UNSUPPORTED: paymentIntentDomain solo opera en MXN.");
      }
      const intent = await PaymentIntentService.createIntent({
        tenantId: input.ids.branchId,
        creatorSubjectId: input.creatorId,
        amountMxn: fromMinorUnits(input.amounts.total.amountMinor, "MXN"),
        orderId: input.ids.orderId,
        idempotencyKey: input.idempotencyKey,
      });
      return toCanonicalIntent(intent);
    },

    async getIntent(intentId: string): Promise<CanonicalPaymentIntent | null> {
      const intent = await PaymentIntentService.getIntent(intentId);
      return intent ? toCanonicalIntent(intent) : null;
    },

    async settleIntent(intentId: string, payerId: string): Promise<PaymentResult> {
      const intent = await PaymentIntentService.approveIntent(intentId, payerId);
      const canonical = toCanonicalIntent(intent);
      return {
        ok: canonical.status === "SUCCEEDED",
        status: canonical.status,
        orderState: canonical.status === "SUCCEEDED" ? "PAID" : "PARTIALLY_PAID",
        intentId: canonical.id,
        amounts: canonical.amounts,
      };
    },

    async cancelIntent(): Promise<PaymentResult> {
      // El motor legacy no expone cancelación: se mantiene explícito.
      throw new Error("PAYMENT_ENGINE_UNSUPPORTED: paymentIntentDomain no soporta cancelIntent.");
    },
  };
}
