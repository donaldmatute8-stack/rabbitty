/**
 * ── Proveedores de entrega (última milla) ────────────────────────────────
 *
 * La UI nunca promete una capacidad que el proveedor no tenga. Cada proveedor
 * declara qué sabe hacer y si está habilitado en este entorno.
 *
 * Fase 0: MANUAL (asignación a mano desde el POS) siempre disponible.
 * Fase 1: UBER_DIRECT se habilita cuando existan credenciales aprobadas.
 * Futuro: RABBITTY_RIDE entra como un adapter más, sin tocar la orden.
 */

export type DeliveryProviderId = "MANUAL" | "UBER_DIRECT" | "RABBITTY_RIDE";

export interface DeliveryCapabilities {
  /** Puede dar precio antes de pedir. */
  quote: boolean;
  /** Puede crear la solicitud de reparto. */
  createDelivery: boolean;
  /** Devuelve seguimiento en vivo. */
  tracking: boolean;
  /** Permite cancelar desde Rabbitty. */
  cancel: boolean;
}

export interface DeliveryProviderInfo {
  id: DeliveryProviderId;
  name: string;
  description: string;
  capabilities: DeliveryCapabilities;
  /** Habilitado en este entorno (credenciales/config). */
  available: boolean;
  /** Motivo legible cuando no está disponible. */
  unavailableReason?: string;
}

function uberDirectConfigured(): boolean {
  return Boolean(
    process.env.UBER_DIRECT_CLIENT_ID &&
      process.env.UBER_DIRECT_CLIENT_SECRET &&
      process.env.UBER_DIRECT_CUSTOMER_ID,
  );
}

export const DELIVERY_PROVIDERS: DeliveryProviderInfo[] = [
  {
    id: "MANUAL",
    name: "Asignación manual",
    description: "Registra al repartidor del local o a un tercero con nombre y teléfono.",
    capabilities: { quote: false, createDelivery: true, tracking: false, cancel: true },
    available: true,
  },
  {
    id: "UBER_DIRECT",
    name: "Uber Direct",
    description: "Cotiza, solicita y sigue la entrega con un repartidor de Uber.",
    capabilities: { quote: true, createDelivery: true, tracking: true, cancel: true },
    available: uberDirectConfigured(),
    unavailableReason: uberDirectConfigured()
      ? undefined
      : "Requiere credenciales de Uber Direct (UBER_DIRECT_CLIENT_ID / SECRET / CUSTOMER_ID).",
  },
  {
    id: "RABBITTY_RIDE",
    name: "Rabbitty Ride",
    description: "Reparto propio de Rabbitty. Se integrará como un proveedor más.",
    capabilities: { quote: true, createDelivery: true, tracking: true, cancel: true },
    available: false,
    unavailableReason: "En construcción (fase posterior).",
  },
];

export function getProvider(id: string): DeliveryProviderInfo | undefined {
  return DELIVERY_PROVIDERS.find((p) => p.id === id);
}

export const DELIVERY_STATUSES = [
  "REQUESTED",
  "ASSIGNED",
  "PICKED_UP",
  "DELIVERED",
  "CANCELLED",
  "FAILED",
  "NEEDS_MANUAL_ACTION",
] as const;

export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

/** Transiciones válidas; evita saltos y estados zombis. */
const TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  REQUESTED: ["ASSIGNED", "CANCELLED", "FAILED", "NEEDS_MANUAL_ACTION"],
  ASSIGNED: ["PICKED_UP", "CANCELLED", "FAILED", "NEEDS_MANUAL_ACTION"],
  PICKED_UP: ["DELIVERED", "FAILED", "NEEDS_MANUAL_ACTION"],
  DELIVERED: [],
  CANCELLED: [],
  FAILED: ["NEEDS_MANUAL_ACTION"],
  NEEDS_MANUAL_ACTION: ["ASSIGNED", "CANCELLED"],
};

export function canTransition(from: string, to: DeliveryStatus): boolean {
  const allowed = TRANSITIONS[from as DeliveryStatus];
  if (!allowed) return false;
  return allowed.includes(to);
}
