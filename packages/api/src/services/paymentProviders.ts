/**
 * ── Proveedores de cobro (riel de pago) ─────────────────────────────────────
 *
 * Mismo patrón que `deliveryProviders.ts`: cada riel declara qué sabe hacer y si
 * está disponible en este entorno. La UI (POS y panel) debe preguntar por
 * capacidades, no asumir Stripe.
 *
 * Por qué existe: el objetivo es **Rabbitty Pay** con rieles propios algún día.
 * Si el POS pregunta "¿este riel cobra con lector?", cambiar de adquirente es
 * una implementación nueva de esta lista, no una reescritura.
 *
 * Reglas:
 * - Este archivo NO cobra ni mueve dinero: solo declara capacidades.
 * - El dominio sigue en `paymentCore.ts` (intents, idempotencia, liquidación).
 * - Las implementaciones viven en `stripeConnect.ts` / `mercadopago.ts`.
 */

export type PaymentProviderId =
  | "STRIPE"
  | "MERCADO_PAGO"
  | "CASH"
  | "BUNZ"
  | "RABBITTY_PAY";

export interface PaymentCapabilities {
  /** Cobro presencial con lector físico controlado por el POS. */
  cardTerminal: boolean;
  /** Cobro acercando tarjeta al teléfono/tablet (sin lector externo). */
  tapToPhone: boolean;
  /** Link/QR alojado: el cliente paga en su dispositivo. */
  hostedCheckout: boolean;
  /** Lectores de terceros vía SDK MPOS (p. ej. hardware propio con marca). */
  mposSdk: boolean;
  /** Cobro desde la app del cliente (Rabbitty Pay / wallet). */
  inAppPayment: boolean;
  /** Reembolsos totales. */
  refunds: boolean;
  /** Reembolsos parciales. */
  partialRefunds: boolean;
  /** División del pago en varias patas (efectivo + tarjeta + Bunz). */
  splitPayments: boolean;
  /** Requiere verificación (KYC) del comercio antes de cobrar. */
  requiresKyc: boolean;
}

export interface PaymentProviderInfo {
  id: PaymentProviderId;
  name: string;
  description: string;
  capabilities: PaymentCapabilities;
  /** Habilitado en este entorno (credenciales/config). */
  available: boolean;
  /** Motivo legible cuando no está disponible. */
  unavailableReason?: string;
}

function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function mercadoPagoConfigured(): boolean {
  // La credencial real vive cifrada por sucursal; aquí solo se declara que el
  // riel existe como opción. La disponibilidad efectiva la resuelve el POS con
  // `getMercadoPagoAvailability` (por sucursal).
  return true;
}

export const PAYMENT_PROVIDERS: PaymentProviderInfo[] = [
  {
    id: "CASH",
    name: "Efectivo",
    description: "Cobro en caja. No depende de red ni de proveedor.",
    capabilities: {
      cardTerminal: false,
      tapToPhone: false,
      hostedCheckout: false,
      mposSdk: false,
      inAppPayment: false,
      refunds: true,
      partialRefunds: false,
      splitPayments: true,
      requiresKyc: false,
    },
    available: true,
  },
  {
    id: "BUNZ",
    name: "Bunz",
    description: "Canje de puntos de lealtad. Libro interno de Rabbitty.",
    capabilities: {
      cardTerminal: false,
      tapToPhone: false,
      hostedCheckout: false,
      mposSdk: false,
      inAppPayment: true,
      refunds: true,
      partialRefunds: true,
      splitPayments: true,
      requiresKyc: false,
    },
    available: true,
  },
  {
    id: "STRIPE",
    name: "Rabbitty Pay (con Stripe)",
    description:
      "Cobro con tarjeta. Link/QR al cliente y, cuando esté habilitado, lector Stripe Terminal.",
    capabilities: {
      cardTerminal: false, // se activa al integrar Terminal (S710)
      tapToPhone: false,
      hostedCheckout: true,
      mposSdk: false, // Stripe no acepta lectores de terceros
      inAppPayment: true,
      refunds: true,
      partialRefunds: true,
      splitPayments: true,
      requiresKyc: true,
    },
    available: stripeConfigured(),
    unavailableReason: stripeConfigured()
      ? undefined
      : "Requiere STRIPE_SECRET_KEY.",
  },
  {
    id: "MERCADO_PAGO",
    name: "Mercado Pago",
    description: "Checkout alojado de Mercado Pago con credenciales del comercio.",
    capabilities: {
      cardTerminal: false,
      tapToPhone: false,
      hostedCheckout: true,
      mposSdk: false,
      inAppPayment: false,
      refunds: true,
      partialRefunds: false,
      splitPayments: false,
      requiresKyc: true,
    },
    available: mercadoPagoConfigured(),
  },
  {
    id: "RABBITTY_PAY",
    name: "Rabbitty Pay (riel propio)",
    description:
      "Riel propio con adquirente en México y hardware de marca. Se habilita cuando exista PSP que certifique el lector.",
    capabilities: {
      cardTerminal: true,
      tapToPhone: false,
      hostedCheckout: false,
      mposSdk: true,
      inAppPayment: true,
      refunds: true,
      partialRefunds: true,
      splitPayments: true,
      requiresKyc: true,
    },
    // No hay adquirente confirmado en México: se deja explícitamente apagado.
    available: false,
    unavailableReason:
      "Sin adquirente que certifique el hardware. Ver Docs/PAYMENTS/CUESTIONARIO-PSP-MEXICO.md.",
  },
];

/** Rieles disponibles en este entorno (lo que la UI puede ofrecer). */
export function availablePaymentProviders(): PaymentProviderInfo[] {
  return PAYMENT_PROVIDERS.filter((p) => p.available);
}

export function getPaymentProvider(id: string): PaymentProviderInfo | undefined {
  return PAYMENT_PROVIDERS.find((p) => p.id === id.toUpperCase());
}

/** ¿Este riel puede cobrar con lector físico? (lo pregunta el POS antes de ofrecerlo). */
export function canChargeWithTerminal(id: string): boolean {
  return Boolean(getPaymentProvider(id)?.capabilities.cardTerminal && getPaymentProvider(id)?.available);
}
