import { pgTable, text, integer, real, numeric, timestamp, boolean, jsonb, check, uniqueIndex, index, bigint } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import crypto from "crypto";

function genId(): string {
  return crypto.randomUUID();
}

const id = () => text("id").primaryKey().$defaultFn(() => genId());
const fkId = (field: string) => text(field).notNull();
const fkIdOpt = (field: string) => text(field);
// Dinero exacto (sin errores de coma flotante): numeric(12,2) leído como number
const money = (name: string) => numeric(name, { precision: 12, scale: 2, mode: "number" });
const timestamps = {
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
};

export const restaurants = pgTable("restaurants", {
  id: id(),
  businessId: text("businessId").notNull().unique(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  currency: text("currency").default("MXN").notNull(),
  taxRate: real("taxRate").default(0.16).notNull(),
  timezone: text("timezone").default("America/Mexico_City").notNull(),
  defaultRewardRate: integer("defaultRewardRate").default(20).notNull(),
  /** Perfil de negocio elegido en el admin (restaurant, cafe, bar, etc.) */
  businessType: text("businessType").default("restaurant").notNull(),
  /** Módulos activos del sidebar, JSON array. Antes vivía solo en localStorage. */
  activeModules: text("activeModules").default("[]").notNull(),
  acceptsBunz: boolean("acceptsBunz").default(true).notNull(),
  happyHourStart: text("happyHourStart"), // e.g. "14:00"
  happyHourEnd: text("happyHourEnd"), // e.g. "18:00"
  happyHourRewardRate: integer("happyHourRewardRate"), // e.g. 40 for 2X if default is 20
  // ── Tipo de cambio USD/MXN (elegido por el admin; manual o auto-API) ──
  usdRateMode: text("usdRateMode").default("AUTO").notNull(), // 'AUTO' | 'MANUAL'
  usdRate: real("usdRate"), // MXN por USD; AUTO = cache de la API, MANUAL = fija
  usdRateUpdatedAt: timestamp("usdRateUpdatedAt"),
  // ── Tabs/comandas huérfanas: horas hasta expirar órdenes sin ejecutar ──
  staleOrderHours: integer("staleOrderHours").default(12).notNull(),
  // ── USD en POS/ticket: SOLO si el admin lo activa ──
  showUsdTicket: boolean("showUsdTicket").default(false).notNull(),
  // ── Plan "Analíticas Pro" (vendible): conversión checkout, tips, clientela ──
  analyticsProEnabled: boolean("analyticsProEnabled").default(false).notNull(),
  // ── Propinas: se pagan con el ticket y se reparten en caja (opcional) ──
  tipPayoutEnabled: boolean("tipPayoutEnabled").default(false).notNull(),
  // ── Pagos con Bunz: reglas comerciales del afiliado (H16 Nivel B) ──
  // Rabbitty gobierna el nivel global (gratuityRules/bunzPaymentsPolicy server).
  bunzAvailabilityMode: text("bunzAvailabilityMode").default("ALWAYS").notNull(), // ALWAYS | SCHEDULE
  bunzSchedule: text("bunzSchedule").default("{}").notNull(), // {days:[0..6],start:"HH:MM",end:"HH:MM"}
  bunzMinOrderAmount: real("bunzMinOrderAmount").default(0).notNull(), // 0 = sin mínimo
  bunzMaxOrderAmount: real("bunzMaxOrderAmount").default(0).notNull(), // 0 = sin máximo
  bunzDailyLimit: integer("bunzDailyLimit").default(0).notNull(), // Bunz/día; 0 = sin límite
  // H16-2: % máximo de la factura pagable con Bunz (100 = sin límite) + catálogo
  // de productos admisibles (JSON de menuIds; vacío = todos)
  bunzMaxPctOfBill: integer("bunzMaxPctOfBill").default(100).notNull(),
  bunzAllowedProducts: text("bunzAllowedProducts").default("[]").notNull(),
  // ── Gratificaciones voluntarias (D-11) ── Catálogo controlado por Rabbitty:
  // mode OFF|POS|DIGITAL|BOTH; pcts JSON subset de [5,10,15] (nunca custom);
  // server guard en gratuityRules. Nada condicionado al método de pago.
  gratuityMode: text("gratuityMode").default("OFF").notNull(),
  gratuityPcts: text("gratuityPcts").default("[]").notNull(),
  printerType: text("printerType"),
  printerConfig: jsonb("printerConfig"),
  legalName: text("legalName"),
  rfc: text("rfc"),
  taxRegime: text("taxRegime"),
  logoUrl: text("logoUrl"),
  email: text("email"),
  phone: text("phone"),
  ticketFooter: text("ticketFooter"),
  isActive: boolean("isActive").default(true).notNull(),
  ...timestamps,
});

export const branches = pgTable("branches", {
  id: id(),
  restaurantId: fkId("restaurantId").references(() => restaurants.id),
  name: text("name").notNull(),
  address: text("address").notNull(),
  phone: text("phone"),
  lat: real("lat"),
  lng: real("lng"),
  cashDropEnabled: boolean("cashDropEnabled").default(false).notNull(),
  cashDropThreshold: real("cashDropThreshold").default(3000).notNull(),
  // Retiros mayores a este monto exigen PIN de manager/admin
  cashDropManagerThreshold: real("cashDropManagerThreshold").default(1000).notNull(),
  // H16-2: override de pagos con Bunz por sucursal (JSON: {enabled, mode, schedule, minOrderAmount, maxOrderAmount, dailyLimit, maxPctOfBill, allowedProducts}) — {} = heredado del negocio
  bunzOverride: text("bunzOverride").default("{}").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  ...timestamps,
});

/**
 * 🍳 Estaciones de preparación (ADR-023, migración 0039).
 * Sin configuración, la sucursal tiene una estación "Cocina" por defecto y todo
 * cae ahí: el POS se comporta igual que antes de existir estaciones.
 */
export const stations = pgTable("stations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  branchId: text("branchId").notNull().references(() => branches.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** KITCHEN | BAR | EXPO | COLD */
  type: text("type").default("KITCHEN").notNull(),
  printerId: text("printerId"),
  isActive: boolean("isActive").default(true).notNull(),
  isDefault: boolean("isDefault").default(false).notNull(),
  sortOrder: integer("sortOrder").default(0).notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex("stations_branch_name_uidx").on(t.branchId, sql`lower(${t.name})`),
  uniqueIndex("stations_branch_default_uidx").on(t.branchId).where(sql`${t.isDefault} = true`),
]);

export const menuCategories = pgTable("menu_categories", {
  id: id(),
  branchId: fkId("branchId").references(() => branches.id),
  name: text("name").notNull(),
  description: text("description"),
  sortOrder: integer("sortOrder").default(0).notNull(),
  printerZone: text("printerZone").default("MAIN").notNull(),
  /** Estación heredada por sus productos (ADR-023). */
  stationId: text("stationId").references(() => stations.id, { onDelete: "set null" }),
  isActive: boolean("isActive").default(true).notNull(),
  ...timestamps,
});

export const menuItems = pgTable("menu_items", {
  id: id(),
  categoryId: fkId("categoryId").references(() => menuCategories.id),
  branchId: fkId("branchId").references(() => branches.id),
  name: text("name").notNull(),
  description: text("description"),
  price: real("price").notNull(),
  cost: real("cost").default(0),
  imageUrl: text("imageUrl"),
  sku: text("sku"),
  /** Override por producto; si es NULL hereda la estación de su categoría. */
  stationId: text("stationId").references(() => stations.id, { onDelete: "set null" }),
  isActive: boolean("isActive").default(true).notNull(),
  isAvailable: boolean("isAvailable").default(true).notNull(),
  sortOrder: integer("sortOrder").default(0).notNull(),
  ...timestamps,
});

export const menuItemModifiers = pgTable("menu_item_modifiers", {
  id: id(),
  itemId: fkId("itemId").references(() => menuItems.id),
  name: text("name").notNull(),
  type: text("type").default("SELECT").notNull(),
  priceAdjust: real("priceAdjust").default(0).notNull(),
  maxSelect: integer("maxSelect").default(1).notNull(),
  sortOrder: integer("sortOrder").default(0).notNull(),
});

export const tables = pgTable("tables", {
  id: id(),
  branchId: fkId("branchId").references(() => branches.id),
  number: integer("number").notNull(),
  capacity: integer("capacity").default(4).notNull(),
  location: text("location"),
  qrCode: text("qrCode"),
  isActive: boolean("isActive").default(true).notNull(),
  ...timestamps,
});

export const staff = pgTable("staff", {
  id: id(),
  userId: text("userId").notNull(),
  branchId: fkId("branchId").references(() => branches.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role").default("WAITER").notNull(),
  pinCode: text("pinCode"),
  isActive: boolean("isActive").default(true).notNull(),
  ...timestamps,
});

export const staffShifts = pgTable("staff_shifts", {
  id: id(),
  staffId: fkId("staffId").references(() => staff.id),
  branchId: fkId("branchId").references(() => branches.id),
  checkIn: timestamp("checkIn").defaultNow().notNull(),
  checkOut: timestamp("checkOut"),
  status: text("status").default("ACTIVE").notNull(),
});

export const tableSessions = pgTable("table_sessions", {
  id: id(),
  tableId: fkId("tableId").references(() => tables.id),
  branchId: fkId("branchId").references(() => branches.id),
  staffId: fkIdOpt("staffId").references(() => staff.id),
  customerCount: integer("customerCount").default(1),
  customerId: text("customerId"),
  status: text("status").default("OPEN").notNull(),
  openedAt: timestamp("openedAt").defaultNow().notNull(),
  closedAt: timestamp("closedAt"),
});

export const orders = pgTable("orders", {
  id: id(),
  branchId: fkId("branchId").references(() => branches.id),
  tableId: fkIdOpt("tableId").references(() => tables.id),
  tableSessionId: fkIdOpt("tableSessionId").references(() => tableSessions.id),
  staffId: fkIdOpt("staffId").references(() => staff.id),
  customerId: text("customerId"),
  customerName: text("customerName"),
  customerPhone: text("customerPhone"),
  orderType: text("orderType").default("DINE_IN").notNull(),
  status: text("status").default("PENDING").notNull(),
  /**
   * Cuenta enviada al móvil para cobro (sin pedido): no va a KDS ni al
   * seguimiento de pedidos del Rabbitter. Solo existe para cobrar y emitir
   * comprobante. Las órdenes normales quedan en false.
   */
  billOnly: boolean("billOnly").default(false).notNull(),
  subtotal: real("subtotal").notNull(),
  tax: real("tax").default(0).notNull(),
  discount: real("discount").default(0).notNull(),
  tip: real("tip").default(0).notNull(),
  total: real("total").notNull(),
  bunzReward: integer("bunzReward").default(0),
  bunzPaid: integer("bunzPaid").default(0),
  notes: text("notes"),
  /** Dirección de entrega (solo pedidos DELIVERY). */
  deliveryAddress: text("deliveryAddress"),
  /** Dirección estructurada para proveedores (Uber Direct): street1/2, city, state, zip, country, phone, lat/lng. */
  deliveryAddressData: jsonb("deliveryAddressData"),
  /** Costo de entrega cobrado al cliente (0 si lo absorbe el negocio). */
  deliveryFee: real("deliveryFee").default(0).notNull(),
  /** Origen externo: RABBITTY | UBER_EATS | UBER_DIRECT | RABBITTY_RIDE… */
  externalProvider: text("externalProvider"),
  /** Id de la orden/entrega en el proveedor externo. */
  externalId: text("externalId"),
  /** ETA efectivo que ve el cliente (cocina mientras no hay entrega; luego el del proveedor). */
  etaMinutes: integer("etaMinutes"),
  etaAt: timestamp("etaAt"),
  /** ETA de cocina, separado para no pisar el de entrega (Uber Direct). */
  prepEtaMinutes: integer("prepEtaMinutes"),
  prepEtaAt: timestamp("prepEtaAt"),
  voidReason: text("voidReason"),
  cfdiStatus: text("cfdiStatus").default("NONE").notNull(),
  cfdiUrl: text("cfdiUrl"),
  /** RP-2A: clave de idempotencia del cobro. Única cuando existe. */
  idempotencyKey: text("idempotencyKey"),
  // ── Integridad de órdenes (ADR-018, migración 0038) ──
  /** Versión optimista: toda mutación la incrementa. */
  version: integer("version").default(1).notNull(),
  updatedByStaffId: text("updatedByStaffId"),
  updatedByTerminalId: text("updatedByTerminalId"),
  ...timestamps,
}, (t) => [
  uniqueIndex("orders_idempotency_key_idx").on(t.idempotencyKey),
  index("orders_version_idx").on(t.version),
]);

/**
 * Bitácora append-only de mutaciones de una orden (ADR-018 §6.2).
 * `versionBefore/After` permiten reconstruir qué pasó y detectar escrituras
 * fuera del helper `withOrderMutation`.
 */
export const orderEvents = pgTable("order_events", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderId: text("orderId").notNull().references(() => orders.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  versionBefore: integer("versionBefore").notNull(),
  versionAfter: integer("versionAfter").notNull(),
  staffId: text("staffId"),
  terminalId: text("terminalId"),
  idempotencyKey: text("idempotencyKey"),
  payload: jsonb("payload"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("order_events_idempotency_uidx")
    .on(t.idempotencyKey)
    .where(sql`${t.idempotencyKey} IS NOT NULL`),
  index("order_events_order_idx").on(t.orderId, t.createdAt),
]);

/**
 * 🛵 Entregas (última milla) — capa proveedor-agnóstica.
 *
 * Una entrega por pedido. `provider` identifica quién la ejecuta:
 * MANUAL (asignación a mano), UBER_DIRECT, RABBITTY_RIDE (futuro).
 * Los estados son de Rabbitty, no del proveedor, para no acoplar la UI.
 */
export const deliveries = pgTable("deliveries", {
  id: id(),
  orderId: fkId("orderId").references(() => orders.id, { onDelete: "cascade" }),
  branchId: fkId("branchId").references(() => branches.id),
  /** MANUAL | UBER_DIRECT | RABBITTY_RIDE */
  provider: text("provider").notNull(),
  /** Id de la entrega en el proveedor (null en MANUAL). */
  providerDeliveryId: text("providerDeliveryId"),
  /** REQUESTED | ASSIGNED | PICKED_UP | DELIVERED | CANCELLED | FAILED | NEEDS_MANUAL_ACTION */
  status: text("status").default("REQUESTED").notNull(),
  courierName: text("courierName"),
  courierPhone: text("courierPhone"),
  trackingUrl: text("trackingUrl"),
  /** Costo de la entrega en centavos (MXN) para conciliar. */
  feeCents: integer("feeCents"),
  /** Quién paga la entrega: BUSINESS (absorbe) o CUSTOMER (se suma al total). */
  feePaidBy: text("feePaidBy").default("BUSINESS").notNull(),
  currency: text("currency").default("MXN").notNull(),
  notes: text("notes"),
  externalPayload: jsonb("externalPayload"),
  ...timestamps,
}, (table) => [
  uniqueIndex("deliveries_order_uidx").on(table.orderId),
  index("deliveries_status_idx").on(table.status),
]);

export const orderItems = pgTable("order_items", {
  id: id(),
  orderId: fkId("orderId").references(() => orders.id),
  menuItemId: fkId("menuItemId").references(() => menuItems.id),
  quantity: integer("quantity").notNull(),
  unitPrice: real("unitPrice").notNull(),
  totalPrice: real("totalPrice").notNull(),
  modifiers: jsonb("modifiers"),
  notes: text("notes"),
  status: text("status").default("PENDING").notNull(),
  sortOrder: integer("sortOrder").default(0).notNull(),
  /** Alergias del comensal (catálogo + nota libre) — ADR-025. */
  allergies: text("allergies"),
  /** Nombre del comensal: el mesero entrega por nombre, no por platillo. */
  guestName: text("guestName"),
  /** Snapshot de destino al enviar la comanda; nunca se recalcula (ADR-023). */
  stationId: text("stationId"),
  printerId: text("printerId"),
  sentToStationAt: timestamp("sentToStationAt"),
  voidReason: text("voidReason"),
  voidedAt: timestamp("voidedAt"),
  authorizedById: fkIdOpt("authorizedById").references(() => staff.id),
});

export const payments = pgTable("payments", {
  id: id(),
  orderId: fkId("orderId").references(() => orders.id),
  method: text("method").notNull(),
  amount: real("amount").notNull(),
  /** Propina embebida en este pago (para separar cuenta vs propina en admin). */
  tipAmount: real("tipAmount").default(0).notNull(),
  reference: text("reference"),
  status: text("status").default("COMPLETED").notNull(),
  verificationMethod: text("verificationMethod").default("CASHIER_CONFIRMED").notNull(),
  ...timestamps,
});

// ─────────────────────────────────────────────────────────────────────────────
// RABBITTY SCORE — Fase 1 (ver Docs/RABBITTY-SCORE-PLAN.md)
// ─────────────────────────────────────────────────────────────────────────────

/** Rating post-pago: 1 evaluación por orden (UNIQUE orderId), anónima al comercio. */
/**
 * 📡 Outbox de eventos POS/KDS (ADR-017, migración 0040).
 * Se escribe en la misma transacción que la orden y lo publica un worker.
 */
export const realtimeOutbox = pgTable("realtime_outbox", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  businessId: text("businessId"),
  branchId: text("branchId").notNull(),
  channel: text("channel").notNull(),
  eventType: text("eventType").notNull(),
  eventId: text("eventId").notNull().unique(),
  payload: jsonb("payload").notNull(),
  seq: bigint("seq", { mode: "number" }),
  status: text("status").default("QUEUED").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  runAfter: timestamp("runAfter").defaultNow().notNull(),
  lockedUntil: timestamp("lockedUntil"),
  sentAt: timestamp("sentAt"),
  ...timestamps,
}, (t) => [
  index("realtime_outbox_pending_idx").on(t.status, t.runAfter),
  index("realtime_outbox_channel_idx").on(t.channel, t.seq),
]);

export const orderRatings = pgTable("order_ratings", {
  id: id(),
  orderId: fkId("orderId").references(() => orders.id).notNull().unique(),
  branchId: fkId("branchId").references(() => branches.id).notNull(),
  customerUserId: text("customerUserId").notNull(),
  stars: integer("stars").notNull(),
  attributes: jsonb("attributes"), // chips neutrales: atención/comida/tiempo/ambiente
  comment: text("comment"),
  isEligible: boolean("isEligible").default(true).notNull(),
  ineligibleReason: text("ineligibleReason"),
  // VISIBLE | PENDING_REVIEW | HIDDEN
  moderationStatus: text("moderationStatus").default("VISIBLE").notNull(),
  reviewFlag: boolean("reviewFlag").default(false).notNull(),
  editedAt: timestamp("editedAt"),
  reportedAt: timestamp("reportedAt"),
  reportedBy: text("reportedBy"),
  reportReason: text("reportReason"),
  ...timestamps,
});

/** Append-only: creación, edición, anulación, reporte y moderación (auditoría completa). */
export const orderRatingEvents = pgTable("order_rating_events", {
  id: id(),
  ratingId: fkId("ratingId").references(() => orderRatings.id, { onDelete: "cascade" }).notNull(),
  // CREATED | EDITED | VOIDED | REPORTED | MODERATED_HIDDEN | RESTORED
  eventType: text("eventType").notNull(),
  actorUserId: text("actorUserId"),
  actorRole: text("actorRole"), // AUTHOR | STAFF | GOD | SYSTEM
  previousStars: integer("previousStars"),
  newStars: integer("newStars"),
  previousComment: text("previousComment"),
  newComment: text("newComment"),
  reason: text("reason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Registro de moderación (terceros): motivo obligatorio + estado antes/después. */
export const moderationLog = pgTable("moderation_log", {
  id: id(),
  entityType: text("entityType").notNull(), // ORDER_RATING
  entityId: text("entityId").notNull(),
  action: text("action").notNull(), // HIDDEN | RESTORED | REVIEW_FLAGGED | IDENTITY_REVEALED
  actorUserId: text("actorUserId").notNull(),
  reason: text("reason").notNull(),
  previousState: text("previousState"),
  newState: text("newState"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Score interno (shadow) del servicio por sucursal — jamás visible al comercio en F1. */
export const merchantScoreShadow = pgTable("merchant_score_shadow", {
  id: id(),
  branchId: fkId("branchId").references(() => branches.id).notNull(),
  score: real("score").notNull(),
  sampleN: integer("sampleN").notNull(),
  coverage: real("coverage").notNull(),
  components: jsonb("components"),
  computedAt: timestamp("computedAt").defaultNow().notNull(),
});

/**
 * ── Rabbitter Trust & Engagement (F2, SHADOW) ── snapshot del score de
 * confiabilidad por sujeto (subjectId = payerSubjectId / user id de core).
 * Jamás se expone al cliente ni modifica economía/ledger (Reglas de oro §3).
 * Ver Docs/RABBITTY-SCORE-PLAN.md §F2.
 */
export const rabbitterScoreShadow = pgTable("rabbitter_score_shadow", {
  id: id(),
  subjectId: text("subjectId").notNull(),
  score: real("score"),
  confidence: text("confidence").notNull(),
  sampleN: integer("sampleN").notNull(),
  components: jsonb("components"),
  reviewFlag: boolean("reviewFlag").default(false).notNull(),
  computedAt: timestamp("computedAt").defaultNow().notNull(),
});


export const inventoryItems = pgTable("inventory_items", {
  id: id(),
  branchId: fkId("branchId").references(() => branches.id),
  name: text("name").notNull(),
  sku: text("sku"),
  unit: text("unit").default("pz").notNull(),
  stock: real("stock").default(0).notNull(),
  minStock: real("minStock").default(0).notNull(),
  costPerUnit: real("costPerUnit").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  ...timestamps,
});

export const menuItemIngredients = pgTable("menu_item_ingredients", {
  id: id(),
  menuItemId: fkId("menuItemId").references(() => menuItems.id),
  inventoryItemId: fkIdOpt("inventoryItemId").references(() => inventoryItems.id),
  subRecipeId: fkIdOpt("subRecipeId").references(() => menuItems.id),
  quantityRequired: real("quantityRequired").notNull(),
  unit: text("unit").default("pz").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  ...timestamps,
}, (t) => [
  check("menu_item_ingredients_at_least_one_check", sql`${t.inventoryItemId} IS NOT NULL OR ${t.subRecipeId} IS NOT NULL`),
]);

export const inventoryMovements = pgTable("inventory_movements", {
  id: id(),
  itemId: fkId("itemId").references(() => inventoryItems.id),
  branchId: fkId("branchId").references(() => branches.id),
  type: text("type").notNull(),
  quantity: real("quantity").notNull(),
  reference: text("reference"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const events = pgTable("events", {
  id: id(),
  branchId: fkIdOpt("branchId").references(() => branches.id),
  type: text("type").notNull(),
  payload: jsonb("payload").notNull(),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const reservations = pgTable("reservations", {
  id: id(),
  branchId: fkId("branchId").references(() => branches.id),
  tableId: fkIdOpt("tableId").references(() => tables.id),
  customerName: text("customerName").notNull(),
  customerPhone: text("customerPhone"),
  partySize: integer("partySize").default(1).notNull(),
  reservationTime: timestamp("reservationTime").notNull(),
  status: text("status").default("PENDING").notNull(),
  notes: text("notes"),
  ...timestamps,
});

export const webhooks = pgTable("webhooks", {
  id: id(),
  branchId: fkId("branchId").references(() => branches.id),
  name: text("name").notNull(),
  url: text("url").notNull(),
  events: text("events").array().notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  ...timestamps,
});

export const customers = pgTable("customers", {
  id: id(),
  restaurantId: fkId("restaurantId").references(() => restaurants.id),
  phone: text("phone").notNull(),
  name: text("name"),
  totalVisits: integer("totalVisits").default(0).notNull(),
  totalSpent: real("totalSpent").default(0).notNull(),
  lastVisitAt: timestamp("lastVisitAt"),
  birthDate: timestamp("birthDate"),
  segment: text("segment").default("NEW").notNull(), // VIP, RECURRENT, NEW, CHURN_RISK
  marketingConsent: boolean("marketingConsent").default(true).notNull(),
  ...timestamps,
});

export const campaigns = pgTable("campaigns", {
  id: id(),
  branchId: fkId("branchId").references(() => branches.id),
  name: text("name").notNull(),
  targetSegment: text("targetSegment").notNull(), // VIP, RECURRENT, NEW, ALL, CHURN_RISK
  message: text("message").notNull(),
  status: text("status").default("DRAFT").notNull(), // DRAFT, SENT
  sentAt: timestamp("sentAt"),
  deliveredCount: integer("deliveredCount").default(0).notNull(),
  failedCount: integer("failedCount").default(0).notNull(),
  ...timestamps,
});

export const suppliers = pgTable("suppliers", {
  id: id(),
  branchId: fkId("branchId").references(() => branches.id),
  name: text("name").notNull(),
  contactName: text("contactName"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  notes: text("notes"),
  isActive: boolean("isActive").default(true).notNull(),
  ...timestamps,
});

export const purchaseOrders = pgTable("purchase_orders", {
  id: id(),
  branchId: fkId("branchId").references(() => branches.id),
  supplierId: fkId("supplierId").references(() => suppliers.id),
  status: text("status").default("PENDING").notNull(), // PENDING, APPROVED, RECEIVED, CANCELLED
  total: real("total").default(0).notNull(),
  notes: text("notes"),
  orderedAt: timestamp("orderedAt").defaultNow(),
  receivedAt: timestamp("receivedAt"),
  ...timestamps,
});

export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: id(),
  purchaseOrderId: fkId("purchaseOrderId").references(() => purchaseOrders.id),
  inventoryItemId: fkId("inventoryItemId").references(() => inventoryItems.id),
  quantity: real("quantity").notNull(),
  unitCost: real("unitCost").default(0).notNull(),
  totalCost: real("totalCost").default(0).notNull(),
});

export const dynamicPricingRules = pgTable("dynamic_pricing_rules", {
  id: id(),
  branchId: fkId("branchId").references(() => branches.id),
  menuItemId: fkIdOpt("menuItemId").references(() => menuItems.id),
  name: text("name").notNull(),
  priority: integer("priority").default(0).notNull(),
  dayOfWeek: integer("dayOfWeek"), // 0=Sun, 1=Mon ... 6=Sat, null=all
  startTime: text("startTime"), // "HH:mm"
  endTime: text("endTime"),
  adjustmentType: text("adjustmentType").default("PERCENTAGE").notNull(), // PERCENTAGE, FIXED
  adjustmentValue: real("adjustmentValue").default(0).notNull(),
  minPrice: real("minPrice"),
  maxPrice: real("maxPrice"),
  isActive: boolean("isActive").default(true).notNull(),
  ...timestamps,
});

export const cateringEvents = pgTable("catering_events", {
  id: id(),
  branchId: fkId("branchId").references(() => branches.id),
  eventName: text("eventName").notNull(),
  eventDate: timestamp("eventDate").notNull(),
  partySize: integer("partySize").default(1).notNull(),
  customerName: text("customerName").notNull(),
  customerPhone: text("customerPhone"),
  customerEmail: text("customerEmail"),
  menuDetails: jsonb("menuDetails"),
  deposit: real("deposit").default(0).notNull(),
  totalAmount: real("totalAmount").default(0).notNull(),
  status: text("status").default("PENDING").notNull(),
  notes: text("notes"),
  ...timestamps,
});

export const expenses = pgTable("expenses", {
  id: id(),
  branchId: fkId("branchId").references(() => branches.id),
  category: text("category").notNull(), // RENT, PAYROLL, UTILITIES, SUPPLIES, MAINTENANCE, MARKETING, OTHER
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  expenseDate: timestamp("expenseDate").defaultNow().notNull(),
  reference: text("reference"), // invoice number, receipt, etc.
  paidTo: text("paidTo"),
  notes: text("notes"),
  ...timestamps,
});

export const invoices = pgTable("invoices", {
  id: id(),
  branchId: fkId("branchId").references(() => branches.id),
  orderId: fkId("orderId").references(() => orders.id),
  billingProfileId: text("billingProfileId").notNull(),
  rfc: text("rfc").notNull(),
  legalName: text("legalName").notNull(),
  taxRegime: text("taxRegime").notNull(),
  cfdiUse: text("cfdiUse").notNull(),
  zipCode: text("zipCode").notNull(),
  billableAmount: real("billableAmount").notNull(),
  tax: real("tax").default(0).notNull(),
  total: real("total").notNull(),
  status: text("status").default("INVOICED").notNull(),
  uuid: text("uuid"),
  pdfUrl: text("pdfUrl"),
  xmlUrl: text("xmlUrl"),
  cancelledAt: timestamp("cancelledAt"),
  // CFDI multi-tenant (migración 0055): quién timbró y con qué.
  businessId: text("businessId"),
  provider: text("provider"),
  environment: text("environment"),
  pacInvoiceId: text("pacInvoiceId"),
  errorMessage: text("errorMessage"),
  issuedAt: timestamp("issuedAt"),
  cancellationMotive: text("cancellationMotive"),
  replacementUuid: text("replacementUuid"),
  ...timestamps,
});

/**
 * 🔐 Credenciales del PAC de cada tenant (ADR-021, migración 0055).
 * El tenant paga sus timbres; Rabbitty solo guarda (cifrado) y llama al PAC.
 */
export const cfdiCredentials = pgTable("cfdi_credentials", {
  id: id(),
  businessId: text("businessId").notNull(),
  provider: text("provider").notNull(),
  environment: text("environment").default("sandbox").notNull(),
  issuerRfc: text("issuerRfc").notNull(),
  issuerName: text("issuerName").notNull(),
  issuerTaxRegime: text("issuerTaxRegime").notNull(),
  issuerZipCode: text("issuerZipCode").notNull(),
  credentials: text("credentials").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  lastTestedAt: timestamp("lastTestedAt"),
  lastTestStatus: text("lastTestStatus"),
  lastTestMessage: text("lastTestMessage"),
  ...timestamps,
}, (t) => [
  uniqueIndex("cfdi_credentials_business_provider_env_uq").on(t.businessId, t.provider, t.environment),
  index("cfdi_credentials_business_idx").on(t.businessId, t.isActive),
]);

export const waitlistEntries = pgTable("waitlist_entries", {
  id: id(),
  branchId: fkId("branchId").references(() => branches.id),
  customerName: text("customerName").notNull(),
  customerPhone: text("customerPhone").notNull(),
  partySize: integer("partySize").default(1).notNull(),
  status: text("status").default("WAITING").notNull(), // WAITING, CALLED, SEATED, CANCELLED
  notes: text("notes"),
  estimatedWaitMinutes: integer("estimatedWaitMinutes"),
  notifiedViaTelegram: boolean("notifiedViaTelegram").default(false),
  notifiedAt: timestamp("notifiedAt"),
  tableId: fkIdOpt("tableId").references(() => tables.id),
  ...timestamps,
});

export const aiStrategies = pgTable("ai_strategies", {
  id: id(),
  branchId: fkId("branchId").references(() => branches.id),
  goal: text("goal").notNull(),
  status: text("status").default("ACTIVE").notNull(),
  memory: jsonb("memory"),
  isActive: boolean("isActive").default(true).notNull(),
  ...timestamps,
});

export const merchantPaymentAccounts = pgTable("merchant_payment_accounts", {
  id: id(),
  branchId: fkId("branchId").references(() => branches.id),
  merchantId: text("merchantId"), // Agrupador matriz (opcional)
  provider: text("provider").default("STRIPE_CONNECT").notNull(),
  stripeAccountId: text("stripeAccountId").notNull().unique(),
  chargesEnabled: boolean("chargesEnabled").default(false).notNull(),
  payoutsEnabled: boolean("payoutsEnabled").default(false).notNull(),
  defaultCurrency: text("defaultCurrency").default("MXN").notNull(),
  platformFeePercent: real("platformFeePercent").default(0.01).notNull(), // 1.0% por defecto
  metadata: jsonb("metadata"),
  ...timestamps,
});

/**
 * ── Proveedores de pago alternativos por sucursal (Mercado Pago, etc.) ──
 * Separado de `merchant_payment_accounts` (Stripe Connect) porque ese modelo
 * exige `stripeAccountId` único y no aplica a otros proveedores.
 * Las credenciales viven cifradas (AES-256-GCM) en `credentials`; `metadata`
 * guarda solo datos no secretos (mpUserId, nickname, terminalId, lastCheckedAt).
 */
export const merchantPaymentProviderConfigs = pgTable("merchant_payment_provider_configs", {
  id: id(),
  branchId: fkId("branchId").references(() => branches.id),
  provider: text("provider").notNull(), // 'MERCADO_PAGO'
  status: text("status").default("DISCONNECTED").notNull(), // DISCONNECTED | ACTIVE | ERROR
  mode: text("mode").default("test").notNull(), // test | live
  credentials: jsonb("credentials"),
  metadata: jsonb("metadata"),
  ...timestamps,
}, (t) => [
  uniqueIndex("merchant_payment_provider_branch_provider_idx").on(t.branchId, t.provider),
]);

/**
 * ── Confirmación de cobro del Rabbitter ──
 * El POS escanea al cliente, arma el cobro y pide autorización a su app antes
 * de ejecutar el cargo. Es una autorización, no el pago: al aprobar, el POS
 * continúa con su flujo normal (Bunz, efectivo, tarjeta o dividida).
 */
export const posChargeRequests = pgTable("pos_charge_requests", {
  id: id(),
  branchId: fkId("branchId").references(() => branches.id),
  customerId: text("customerId").notNull(),
  staffId: text("staffId"),
  method: text("method").notNull(), // BUNZ | CASH | CARD | SPLIT | EXTERNAL_TERMINAL
  amount: real("amount").notNull(),
  tipAmount: real("tipAmount").default(0).notNull(),
  items: jsonb("items").notNull(), // [{ name, quantity, totalPrice }]
  businessName: text("businessName"),
  status: text("status").default("PENDING").notNull(), // PENDING | APPROVED | REJECTED | EXPIRED | CANCELLED
  orderId: text("orderId"),
  respondedAt: timestamp("respondedAt"),
  expiresAt: timestamp("expiresAt").notNull(),
  ...timestamps,
}, (t) => [
  index("pos_charge_requests_customer_idx").on(t.customerId),
  index("pos_charge_requests_status_idx").on(t.status),
]);

export const paymentIntents = pgTable("payment_intents", {
  id: id(),
  orderId: fkIdOpt("orderId").references(() => orders.id),
  merchantId: fkId("merchantId").references(() => branches.id),
  creatorSubjectId: text("creatorSubjectId"),
  payerSubjectId: text("payerSubjectId"),
  // Campos en centavos enteros para precisión monetaria absoluta (sin punto flotante)
  amountCents: integer("amountCents").default(0).notNull(),
  netFiatCents: integer("netFiatCents").default(0).notNull(),
  platformFeeCents: integer("platformFeeCents").default(0).notNull(),
  // Compatibilidad legacy (reflejo de centavos a unidades)
  amountMxn: real("amountMxn").notNull(),
  bunzAmount: real("bunzAmount").notNull(),
  /** Propina MXN incluida en el cobro (persistida para administración/caja). */
  tipMxn: real("tipMxn").default(0).notNull(),
  currency: text("currency").default("MXN").notNull(),
  provider: text("provider").default("STRIPE").notNull(), // 'STRIPE' | 'CASH' | 'BUNZ_ONLY'
  externalIntentId: text("externalIntentId"), // ej: pi_xxx de Stripe
  status: text("status").default("PENDING_PAYMENT").notNull(),
  // Estados: PENDING_PAYMENT, REQUIRES_ACTION, PROCESSING, SUCCEEDED, CANCELLED, EXPIRED, FAILED
  idempotencyKey: text("idempotencyKey").unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  paidAt: timestamp("paidAt"),
  ...timestamps,
});

export const bunzReserves = pgTable("bunz_reserves", {
  id: id(),
  paymentIntentId: fkId("paymentIntentId").references(() => paymentIntents.id),
  orderId: fkIdOpt("orderId").references(() => orders.id),
  branchId: fkId("branchId").references(() => branches.id),
  userId: text("userId").notNull(), // Customer Subject / Wallet
  amount: real("amount").notNull(), // Cantidad de Bunz reservados
  status: text("status").default("RESERVED").notNull(),
  // Estados: RESERVED, CAPTURED, RELEASED, EXPIRED, RECOVERY_HOLD
  expiresAt: timestamp("expiresAt").notNull(),
  capturedAt: timestamp("capturedAt"),
  releasedAt: timestamp("releasedAt"),
  failureReason: text("failureReason"),
  ...timestamps,
}, (t) => [
  index("bunz_reserves_intent_idx").on(t.paymentIntentId),
  index("bunz_reserves_user_idx").on(t.userId),
]);

export const paymentProviderEvents = pgTable("payment_provider_events", {
  id: id(),
  provider: text("provider").notNull(), // 'STRIPE'
  eventId: text("eventId").notNull(), // evt_xxx de Stripe
  eventType: text("eventType").notNull(), // ej: payment_intent.succeeded
  paymentIntentId: fkIdOpt("paymentIntentId").references(() => paymentIntents.id),
  payload: jsonb("payload").notNull(),
  status: text("status").default("PROCESSING").notNull(), // 'PROCESSING' | 'COMPLETED' | 'FAILED'
  errorMessage: text("errorMessage"),
  processedAt: timestamp("processedAt").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("payment_provider_events_idx").on(t.provider, t.eventId),
]);

export const cashDrops = pgTable("cash_drops", {
  id: id(),
  branchId: fkId("branchId").references(() => branches.id),
  staffId: fkIdOpt("staffId").references(() => staff.id),
  shiftId: fkIdOpt("shiftId").references(() => cashShifts.id),
  amount: money("amount").notNull(),
  category: text("category").default("SAFE").notNull(), // 'EXPENSE' | 'SAFE' — gasto operativo vs sangría a caja fuerte
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow(),
}, (t) => [index("cash_drops_shift_idx").on(t.shiftId)]);

// Sesión de caja/gaveta (contable). NO confundir con staff_shifts (asistencia/RRHH).
export const cashShifts = pgTable(
  "cash_shifts",
  {
    id: id(),
    branchId: fkId("branchId").references(() => branches.id),
    registerId: text("registerId").default("MAIN").notNull(),
    status: text("status").default("OPEN").notNull(), // OPEN | CLOSED
    openedByStaffId: fkId("openedByStaffId").references(() => staff.id),
    currentStaffId: fkId("currentStaffId").references(() => staff.id), // cajero que tiene la gaveta ahora
    openingFloat: money("openingFloat").notNull(),
    openedAt: timestamp("openedAt").defaultNow().notNull(),
    closedAt: timestamp("closedAt"),
    closedByStaffId: fkIdOpt("closedByStaffId").references(() => staff.id),
    authorizedByStaffId: fkIdOpt("authorizedByStaffId").references(() => staff.id),
    expectedCash: money("expectedCash"),
    countedCash: money("countedCash"),
    difference: money("difference"),
    closeNotes: text("closeNotes"),
  },
  (t) => [
    // Un solo turno OPEN por caja
    uniqueIndex("cash_shifts_one_open_per_register")
      .on(t.branchId, t.registerId)
      .where(sql`${t.status} = 'OPEN'`),
    index("cash_shifts_branch_opened_idx").on(t.branchId, t.openedAt),
  ]
);

// Bitácora inmutable: solo INSERT, nunca UPDATE/DELETE.
export const cashShiftEvents = pgTable(
  "cash_shift_events",
  {
    id: id(),
    shiftId: fkId("shiftId").references(() => cashShifts.id),
    branchId: fkId("branchId").references(() => branches.id),
    type: text("type").notNull(), // OPEN | WITHDRAWAL | PARTIAL_CLOSE | HANDOVER | CLOSE
    staffId: fkIdOpt("staffId").references(() => staff.id),
    toStaffId: fkIdOpt("toStaffId").references(() => staff.id),
    authorizedById: fkIdOpt("authorizedById").references(() => staff.id),
    amount: money("amount"),
    expectedAmount: money("expectedAmount"),
    countedAmount: money("countedAmount"),
    difference: money("difference"),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("cash_shift_events_shift_idx").on(t.shiftId, t.createdAt)]
);

export const ledgerEntries = pgTable("ledger_entries", {
  id: id(),
  branchId: fkIdOpt("branchId").references(() => branches.id),
  payerSubjectId: text("payerSubjectId").notNull(),
  payeeSubjectId: text("payeeSubjectId").notNull(),
  amount: real("amount").notNull(),
  /** Unidades enteras (1 = 1 Bunz). El DDL la rellena con trigger. */
  amountUnits: bigint("amountUnits", { mode: "number" }),
  /** Orden real para el anclaje; NULL en filas sandbox. */
  seq: bigint("seq", { mode: "number" }),
  /** Demo/App Review: no entra al epoch ni consume seq. */
  sandbox: boolean("sandbox").default(false).notNull(),
  currency: text("currency").default("BUNZ").notNull(),
  type: text("type").notNull(), // EARN, SPEND, TRANSFER, MINT, BURN, REFUND, ALLOCATION
  referenceId: text("referenceId"), // e.g. PaymentIntent ID or Order ID
  idempotencyKey: text("idempotencyKey").notNull().unique(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const distributionDestinations = pgTable("distribution_destinations", {
  id: id(),
  branchId: fkIdOpt("branchId").references(() => branches.id),
  name: text("name").notNull(),
  type: text("type").default("FOUNDATION").notNull(), // FOUNDATION, SAVINGS, PARTNER, EXTERNAL_WALLET, INTERNAL_ACCOUNT
  accountIdentifier: text("accountIdentifier"),
  description: text("description"),
  isActive: boolean("isActive").default(true).notNull(),
  ...timestamps,
});

export const distributionRules = pgTable("distribution_rules", {
  id: id(),
  branchId: fkId("branchId").references(() => branches.id),
  destinationId: fkId("destinationId").references(() => distributionDestinations.id),
  name: text("name").notNull(),
  allocationType: text("allocationType").default("PERCENTAGE").notNull(), // PERCENTAGE, FIXED_PER_TX, FIXED_PER_ITEM
  allocationValue: real("allocationValue").notNull(),
  triggerEvent: text("triggerEvent").default("PAYMENT_SETTLED").notNull(),
  priority: integer("priority").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  ...timestamps,
});

export const distributionAllocations = pgTable("distribution_allocations", {
  id: id(),
  paymentIntentId: fkIdOpt("paymentIntentId").references(() => paymentIntents.id),
  orderId: fkIdOpt("orderId").references(() => orders.id),
  branchId: fkId("branchId").references(() => branches.id),
  ruleId: fkId("ruleId").references(() => distributionRules.id),
  destinationId: fkId("destinationId").references(() => distributionDestinations.id),
  amountMxn: real("amountMxn").notNull(),
  status: text("status").default("ALLOCATED").notNull(),
  ...timestamps,
});

export const settlementOperations = pgTable("settlement_operations", {
  id: id(),
  allocationId: fkIdOpt("allocationId").references(() => distributionAllocations.id),
  ledgerEntryId: fkIdOpt("ledgerEntryId").references(() => ledgerEntries.id),
  destinationId: fkId("destinationId").references(() => distributionDestinations.id),
  amount: real("amount").notNull(),
  currency: text("currency").default("MXN").notNull(),
  provider: text("provider").default("INTERNAL").notNull(), // INTERNAL, BLOCKCHAIN, SPEI
  status: text("status").default("PENDING").notNull(), // PENDING, PROCESSING, SETTLED, FAILED
  txHash: text("txHash"),
  failureReason: text("failureReason"),
  retryCount: integer("retryCount").default(0).notNull(),
  settledAt: timestamp("settledAt"),
  createdAt: timestamp("createdAt").defaultNow(),
});

// Intentos fallidos de PIN por sucursal (persistente: sobrevive deploys y es compartido entre instancias)
export const pinAttempts = pgTable("pin_attempts", {
  scopeKey: text("scopeKey").primaryKey(),
  failCount: integer("failCount").default(0).notNull(),
  lastFailAt: timestamp("lastFailAt").defaultNow().notNull(),
  lockedUntil: timestamp("lockedUntil"),
});

// ─────────────────────────────────────────────────────────────────────────────
// 📈 OBSERVABILIDAD ECONÓMICA — OT-1 / OT-4
// Captura para el pipeline de validación. Append-only, sin lógica de negocio.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * OT-1 · Intentos de redención (append-only).
 *
 * Un intento por fila, **también cuando se cumple**: si solo se registraran los
 * fallos no se podría reconstruir la demanda. `reasons` es un JSON array con el
 * catálogo cerrado (ver BUNZ-REAL-DATA-SPEC: capacity_exhausted, out_of_stock,
 * affiliate_refused, closed, inactive_branch, tech_failure, user_cancelled,
 * duplicate, fraud, unknown).
 *
 * `userHash` nunca contiene PII. `idempotencyKey` evita duplicados por reintento.
 */
export const bunzRedemptionAttempts = pgTable(
  "bunz_redemption_attempts",
  {
    id: id(),
    userHash: text("userHash").notNull(),
    branchId: fkIdOpt("branchId").references(() => branches.id),
    orderId: text("orderId"),
    rewardId: text("rewardId"),
    requestedAt: timestamp("requestedAt").defaultNow().notNull(),
    bunzRequested: real("bunzRequested").notNull(),
    bunzFulfilled: real("bunzFulfilled").default(0).notNull(),
    status: text("status").default("unfulfilled").notNull(), // fulfilled | partial | unfulfilled | cancelled | fraud | duplicate
    reasons: text("reasons").default("[]").notNull(), // JSON array del catálogo
    waitSeconds: integer("waitSeconds"),
    fulfilledAt: timestamp("fulfilledAt"),
    fulfilledBranchId: text("fulfilledBranchId"),
    idempotencyKey: text("idempotencyKey").notNull().unique(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [
    index("bunz_attempts_requested_idx").on(t.requestedAt),
    index("bunz_attempts_user_idx").on(t.userHash),
  ]
);

/**
 * OT-4 · Snapshot diario de capacidad por afiliado.
 *
 * Autorizado vs consumido. `bunzCapacityDaily` es una foto: se escribe una vez al
 * día con un upsert idempotente por `(affiliateId, date)`. No hay histórico que
 * reconstruir antes de existir la tabla, y eso se declara como hueco.
 */
export const bunzCapacityDaily = pgTable(
  "bunz_capacity_daily",
  {
    id: id(),
    affiliateId: text("affiliateId").notNull(),
    date: text("date").notNull(), // YYYY-MM-DD
    authorizedBunz: real("authorizedBunz").default(0).notNull(),
    consumedBunz: real("consumedBunz").default(0).notNull(),
    source: text("source").default("snapshot").notNull(), // credit_limit | package | campaign | snapshot
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("bunz_capacity_daily_pk").on(t.affiliateId, t.date)]
);

// ─────────────────────────────────────────────────────────────────────────────
// 📚 OT-2 / OT-3 — Obligaciones y libro de doble entrada
// Registro contable para el pipeline. Append-only; sin lógica de negocio.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * OT-2 · Obligación (devengo) con ciclo de vida.
 * Estados (contrato v1.0): OPEN → PARTIALLY_PAID → PAID; la mora se deriva de dueAt.
 * `amountBunz` es la denominación; `settledFiatMxn` es MXN y solo se compara con
 * Bunz si `unit_policy.approved` (ver R24/R26).
 */
export const bunzObligations = pgTable(
  "bunz_obligations",
  {
    id: id(),
    affiliateId: text("affiliateId").notNull(),
    origin: text("origin").notNull(), // fiat_sale | redeem_fee
    accruedAt: timestamp("accruedAt").defaultNow().notNull(),
    dueAt: timestamp("dueAt").notNull(),
    amountBunz: real("amountBunz").notNull(),
    state: text("state").default("OPEN").notNull(),
    settledAt: timestamp("settledAt"),
    instrument: text("instrument"), // bunz | fiat | mixed
    settledBunz: real("settledBunz").default(0).notNull(),
    settledFiatMxn: real("settledFiatMxn").default(0).notNull(),
    /** Suma de Bunz movidos + fiat convertido a Bunz con la tasa de cada operación. */
    settledEquivalentBunz: real("settledEquivalentBunz").default(0).notNull(),
    writtenOffAt: timestamp("writtenOffAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [
    index("bunz_obligations_affiliate_idx").on(t.affiliateId),
    index("bunz_obligations_state_idx").on(t.state),
    index("bunz_obligations_due_idx").on(t.dueAt),
  ]
);

/** OT-2 · Historial de transiciones (append-only). Una fila por cambio de estado. */
export const bunzObligationEvents = pgTable(
  "bunz_obligation_events",
  {
    id: id(),
    obligationId: fkId("obligationId").references(() => bunzObligations.id, { onDelete: "cascade" }),
    at: timestamp("at").defaultNow().notNull(),
    fromState: text("fromState").notNull(),
    toState: text("toState").notNull(),
    actor: text("actor").default("system").notNull(),
    note: text("note"),
  },
  (t) => [index("bunz_obligation_events_obligation_idx").on(t.obligationId)]
);

/**
 * OT-3 · Libro Bunz de doble entrada.
 * Invariante: Σ débitos = Σ créditos por `groupId`.
 * Cuentas: emission_budget, user_wallet, redemption_capacity,
 *          commission_reserved, treasury_bunz, written_off, external.
 */
export const bunzLedgerEntries = pgTable(
  "bunz_ledger_entries",
  {
    id: id(),
    groupId: text("groupId").notNull(),
    ts: timestamp("ts").defaultNow().notNull(),
    account: text("account").notNull(),
    direction: text("direction").notNull(), // debit | credit
    amount: real("amount").notNull(),
    /** Demo/App Review: se excluye del check por cuenta del gate. */
    sandbox: boolean("sandbox").default(false).notNull(),
    refType: text("refType").notNull(), // reward | redemption | obligation | reversal | funding
    refId: text("refId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [
    index("bunz_ledger_group_idx").on(t.groupId),
    index("bunz_ledger_ref_idx").on(t.refType, t.refId),
    index("bunz_ledger_ts_idx").on(t.ts),
  ]
);

/** RP-2B · Resultado de cada pasada de conciliación (append-only). */
export const bunzReconciliationRuns = pgTable(
  "bunz_reconciliation_runs",
  {
    id: text("id").primaryKey(),
    startedAt: timestamp("startedAt").defaultNow().notNull(),
    finishedAt: timestamp("finishedAt"),
    status: text("status").default("RUNNING").notNull(), // OK | ALERTS | ERROR
    checks: jsonb("checks"),
    alerts: jsonb("alerts"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("bunz_recon_started_idx").on(t.startedAt)]
);

/** RP-2B · Pausa operativa global (una fila, id='global'). */
export const bunzControlState = pgTable("bunz_control_state", {
  id: text("id").primaryKey(),
  emissionPaused: boolean("emissionPaused").default(false).notNull(),
  redemptionPaused: boolean("redemptionPaused").default(false).notNull(),
  settlementPaused: boolean("settlementPaused").default(false).notNull(),
  reason: text("reason"),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

/**
 * RP-2B · Controles del piloto económico por afiliado.
 * Topes por periodo para emisión, redención y liquidación.
 */
export const bunzEconomicLimits = pgTable("bunz_economic_limits", {
  affiliateId: text("affiliateId").primaryKey(),
  pilotEnabled: boolean("pilotEnabled").default(false).notNull(),
  periodDays: integer("periodDays").default(7).notNull(),
  maxEmissionBunz: real("maxEmissionBunz").default(0).notNull(),
  maxRedemptionBunz: real("maxRedemptionBunz").default(0).notNull(),
  maxSettlementBunz: real("maxSettlementBunz").default(0).notNull(),
  notes: text("notes"),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * OT-5 · Señales de abuso (append-only, detección determinista).
 *
 * No bloquea ni sanciona: solo deja rastro para revisión humana y para que la
 * captura semanal pueda declarar el riesgo medido. `user` va hasheado.
 */
export const bunzAbuseSignals = pgTable(
  "bunz_abuse_signals",
  {
    id: text("id").primaryKey(),
    detectedAt: timestamp("detectedAt").defaultNow().notNull(),
    userHash: text("userHash").notNull(),
    type: text("type").notNull(), // rapid_redemption | redemption_burst | discount_streak
    severity: text("severity").notNull(), // low | medium | high
    affiliateId: text("affiliateId"),
    refType: text("refType"),
    refId: text("refId"),
    detail: jsonb("detail"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [
    index("bunz_abuse_detected_idx").on(t.detectedAt),
    index("bunz_abuse_user_idx").on(t.userHash),
    index("bunz_abuse_type_idx").on(t.type),
  ]
);
