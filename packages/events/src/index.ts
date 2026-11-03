export { bus } from "./bus";

export const EventTypes = {
  KDS_ITEM_UPDATED: "kds.item.updated",
  ORDER_CREATED: "order.created",
  ORDER_PAID: "order.paid",
  ORDER_VOIDED: "order.voided",
  PAYMENT_PROCESSED: "payment.processed",
  CASH_PAYMENT_REQUESTED: "cash.payment.requested",
  TABLE_OPENED: "table.opened",
  TABLE_CLOSED: "table.closed",
  STAFF_SHIFT_START: "staff.shift.start",
  STAFF_SHIFT_END: "staff.shift.end",
  INVENTORY_LOW: "inventory.low",
  INVENTORY_ADJUSTMENT: "inventory.adjustment",
  BUNZ_REWARD: "bunz.reward",
  BUNZ_PAYMENT: "bunz.payment",
  WAITLIST_ADDED: "waitlist.added",
  WAITLIST_CALLED: "waitlist.called",
  WAITLIST_SEATED: "waitlist.seated",
  WAITLIST_CANCELLED: "waitlist.cancelled",
} as const;

export type EventType = (typeof EventTypes)[keyof typeof EventTypes];

// ─────────────────────────────────────────────────────────────────────────────
// P0 · Contrato de eventos Rabbitty (Docs/PUSH-NOTIFICATIONS-PLAN.md §3)
// El MISMO contrato alimenta: outbox→push, realtime in-app (fase P2) y las
// señales de scores (Rabbitty Score F2/F3). Ningún evento viaja directo al
// proveedor de push: entra al outbox con su intent explícito.
// ─────────────────────────────────────────────────────────────────────────────

export type NotificationEventType =
  | "ORDER_COMPLETED"
  | "ORDER_VOIDED"
  | "ACCOUNT_BILL_SENT"
  | "BUNZ_MINTED"
  | "BUNZ_REDEEMED"
  | "BUNZ_TRANSFER_RECEIVED"
  | "TIP_PAYOUT"
  | "CHAT_MESSAGE"
  | "ARRIVAL"
  | "CHECKIN_PROMPT"
  | "OFFER_FLASH"
  | "MEMBERSHIP_GRANTED"
  | "MEMBERSHIP_RENEWED"
  | "MEMBERSHIP_REVOKED"
  | "RATING_REPORTED"
  | "SHIFT_EVENT"
  | "SYSTEM";

export interface RabbittyEventSubject {
  userId?: string;
  businessId?: string;
  branchId?: string;
  orderId?: string;
  conversationId?: string;
}

export interface RabbittyEvent {
  name: NotificationEventType | (string & {});
  subject: RabbittyEventSubject;
  payload: Record<string, string | number | boolean | null>;
}

export const EventClass = {
  CRITICAL: "critical",
  COMMUNICATION: "communication",
  ENGAGEMENT: "engagement",
  MARKETING: "marketing",
  SYSTEM: "system",
} as const;

/** Clase por tipo: define tratamiento del worker (quiet hours / rate-limit). */
export const EVENT_CLASS_BY_TYPE: Record<string, string> = {
  ORDER_COMPLETED: EventClass.CRITICAL,
  ACCOUNT_BILL_SENT: EventClass.CRITICAL,
  TIP_PAYOUT: EventClass.CRITICAL,
  CHAT_MESSAGE: EventClass.COMMUNICATION,
  BUNZ_MINTED: EventClass.ENGAGEMENT,
  BUNZ_REDEEMED: EventClass.ENGAGEMENT,
  BUNZ_TRANSFER_RECEIVED: EventClass.ENGAGEMENT,
  RATING_REPORTED: EventClass.ENGAGEMENT,
  ARRIVAL: EventClass.MARKETING,
  CHECKIN_PROMPT: EventClass.MARKETING,
  OFFER_FLASH: EventClass.MARKETING,
  MEMBERSHIP_GRANTED: EventClass.CRITICAL,
  MEMBERSHIP_RENEWED: EventClass.CRITICAL,
  MEMBERSHIP_REVOKED: EventClass.CRITICAL,
  SYSTEM: EventClass.SYSTEM,
};

// ─────────────────────────────────────────────────────────────────────────────
// P2.1 · Categorías de push (preferencias por tipo — plan v2.1 §2.2/§2.3)
// El usuario silencia CATEGORÍAS (no tipos individuales). CRITICAL y SYSTEM
// jamás se silencian: pagos, cuentas y seguridad siempre pasan (§2.3).
// ─────────────────────────────────────────────────────────────────────────────

export const PushCategory = {
  CHAT: "chat",               // mensajes y comunicación
  REWARDS: "rewards",         // bunz mint/redeem/transfer
  ORDERS: "orders",           // órdenes, cuenta enviada, propinas
  PROXIMITY: "proximity",     // llegada al local, prompt de check-in
  MEMBERSHIPS: "memberships", // altas/renovaciones/revocaciones
  MARKETING: "marketing",     // ofertas flash y campañas
} as const;

export type PushCategoryKey = (typeof PushCategory)[keyof typeof PushCategory];

/** Tipos NO silenciables (críticos/sistema): siempre notifican. */
export const UNMUTABLE_TYPES = new Set(["TIP_PAYOUT", "SYSTEM"]);

export function categoryForType(type: string): PushCategoryKey {
  switch (type) {
    case "CHAT_MESSAGE":
      return PushCategory.CHAT;
    case "BUNZ_MINTED":
    case "BUNZ_REDEEMED":
    case "BUNZ_TRANSFER_RECEIVED":
    case "RATING_REPORTED":
      return PushCategory.REWARDS;
    case "ORDER_COMPLETED":
    case "ORDER_VOIDED":
    case "ACCOUNT_BILL_SENT":
    case "TIP_PAYOUT":
      return PushCategory.ORDERS;
    case "ARRIVAL":
    case "CHECKIN_PROMPT":
      return PushCategory.PROXIMITY;
    case "MEMBERSHIP_GRANTED":
    case "MEMBERSHIP_RENEWED":
    case "MEMBERSHIP_REVOKED":
      return PushCategory.MEMBERSHIPS;
    case "OFFER_FLASH":
    default:
      return PushCategory.MARKETING;
  }
}

/** ¿Este tipo está silenciado por los prefs del usuario (array JSON de PushCategoryKey)? */
export function typeMuted(mutedCategories: string[], type: string): boolean {
  if (UNMUTABLE_TYPES.has(type)) return false;
  return mutedCategories.includes(categoryForType(type));
}
export {
  encodeChatCursor,
  decodeChatCursor,
  cursorFromMessage,
  type ChatCursor,
} from "./chatCursor";
export {
  deriveOrderStage,
  orderStageStepIndex,
  orderIsActive,
  ORDER_FIRST_STEPS,
  ORDER_STAGE_META,
  type OrderStage,
  type OrderStageInput,
} from "./orderStages";
