export { bus } from "./bus";

export const EventTypes = {
  KDS_ITEM_UPDATED: "kds.item.updated",
  ORDER_CREATED: "order.created",
  ORDER_PAID: "order.paid",
  ORDER_VOIDED: "order.voided",
  PAYMENT_PROCESSED: "payment.processed",
  TABLE_OPENED: "table.opened",
  TABLE_CLOSED: "table.closed",
  STAFF_SHIFT_START: "staff.shift.start",
  STAFF_SHIFT_END: "staff.shift.end",
  INVENTORY_LOW: "inventory.low",
  INVENTORY_ADJUSTMENT: "inventory.adjustment",
  BUNZ_REWARD: "bunz.reward",
  BUNZ_PAYMENT: "bunz.payment",
} as const;

export type EventType = (typeof EventTypes)[keyof typeof EventTypes];
