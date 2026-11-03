/**
 * ── orderStages ── Contrato compartido de seguimiento de pedidos móviles
 * (plan H-TRACK: tarjeta bidireccional mobile ↔ POS).
 *
 * Deriva el ESTADO del pedido a partir de lo que ya existe en DB — sin
 * columnas nuevas: `orders.status` + estatus de `order_items` (KDS los
 * usa para cocinar). Una sola función derivadora para todas las apps:
 * POS muestra en qué está, móvil pinta la barra de progreso.
 */

export type OrderStage =
  | "RECEIVED"        // Pedido recibido (la comanda siete lista ya la ve el POS)
  | "PREPARING"       // En preparación (algún item IN_PROGRESS en KDS)
  | "READY"           // Listo (todo el items READY/SERVED, sin entregar)
  | "PAYMENT_PENDING" // Listo + cobro pendiente (cuenta enviada / efectivo solicitado)
  | "DONE";           // Entregado/Completado (pagado y servido)

export const ORDER_FIRST_STEPS: OrderStage[] = ["RECEIVED", "PREPARING", "READY", "DONE"];

/** Meta para pintar barra de progreso y labels (es-MX por defecto). */
export const ORDER_STAGE_META: Record<OrderStage, { label: string; short: string; step: number }> = {
  RECEIVED: { label: "Pedido recibido", short: "Recibido", step: 1 },
  PREPARING: { label: "En preparación", short: "Preparando", step: 2 },
  READY: { label: "Listo", short: "Listo", step: 3 },
  PAYMENT_PENDING: { label: "Listo — falta pagar", short: "Pagar", step: 3 },
  DONE: { label: "Entregado", short: "Entregado", step: 4 },
};

export interface OrderStageInput {
  order: { status: string | null };
  items: Array<{ status: string | null }>;
}

/** Deriva la etapa con lo que existe hoy en la DB (orders + order_items). */
export function deriveOrderStage({ order, items }: OrderStageInput): OrderStage {
  const status = String(order.status ?? "");
  // COMPLETED = entrega confirmada por el personal en el POS → la tarjeta muere.
  if (status === "COMPLETED") return "DONE";
  if (status === "EXPIRED" || status === "CANCELLED" || status === "VOIDED") return "DONE";

  // PAID NO es terminal: el Rabbitter puede pagar antes de que le entreguen
  // (botón "Pagar ahora" en la tarjeta) y el pedido sigue su curso en cocina.

  // Item-stage: KDS/kitchen mueve PENDING → IN_PROGRESS → READY/SERVED
  const itemStatuses = items.map((i) => String(i.status ?? "PENDING"));
  if (itemStatuses.length > 0) {
    if (itemStatuses.some((s) => s === "IN_PROGRESS")) return "PREPARING";
    if (itemStatuses.every((s) => s === "SERVED" || s === "READY")) return "READY";
  }

  if (status === "CASH_PAYMENT_REQUESTED") return "PAYMENT_PENDING";
  return "RECEIVED";
}

/**
 * Etapas visibles en la barra (0..3 índices). PAYMENT_PENDING comparte el
 * step de READY (3) — la barra mide progreso de PREPARACIÓN; el cobro es
 * overlay, no parte de la cocina.
 */
export function orderStageStepIndex(stage: OrderStage): number {
  if (stage === "PAYMENT_PENDING") return ORDER_FIRST_STEPS.indexOf("READY");
  return ORDER_FIRST_STEPS.indexOf(stage);
}

/** ¿El pedido merece la tarjeta de seguimiento? (activo = cocinándose o por pagar) */
export function orderIsActive(stage: OrderStage): boolean {
  return stage !== "DONE";
}
