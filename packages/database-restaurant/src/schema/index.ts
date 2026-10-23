import { pgTable, text, integer, real, numeric, timestamp, boolean, jsonb, check, uniqueIndex, index } from "drizzle-orm/pg-core";
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
  acceptsBunz: boolean("acceptsBunz").default(true).notNull(),
  happyHourStart: text("happyHourStart"), // e.g. "14:00"
  happyHourEnd: text("happyHourEnd"), // e.g. "18:00"
  happyHourRewardRate: integer("happyHourRewardRate"), // e.g. 40 for 2X if default is 20
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
  isActive: boolean("isActive").default(true).notNull(),
  ...timestamps,
});

export const menuCategories = pgTable("menu_categories", {
  id: id(),
  branchId: fkId("branchId").references(() => branches.id),
  name: text("name").notNull(),
  description: text("description"),
  sortOrder: integer("sortOrder").default(0).notNull(),
  printerZone: text("printerZone").default("MAIN").notNull(),
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
  subtotal: real("subtotal").notNull(),
  tax: real("tax").default(0).notNull(),
  discount: real("discount").default(0).notNull(),
  tip: real("tip").default(0).notNull(),
  total: real("total").notNull(),
  bunzReward: integer("bunzReward").default(0),
  bunzPaid: integer("bunzPaid").default(0),
  notes: text("notes"),
  voidReason: text("voidReason"),
  cfdiStatus: text("cfdiStatus").default("NONE").notNull(),
  cfdiUrl: text("cfdiUrl"),
  ...timestamps,
});

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
  voidReason: text("voidReason"),
  voidedAt: timestamp("voidedAt"),
  authorizedById: fkIdOpt("authorizedById").references(() => staff.id),
});

export const payments = pgTable("payments", {
  id: id(),
  orderId: fkId("orderId").references(() => orders.id),
  method: text("method").notNull(),
  amount: real("amount").notNull(),
  reference: text("reference"),
  status: text("status").default("COMPLETED").notNull(),
  verificationMethod: text("verificationMethod").default("CASHIER_CONFIRMED").notNull(),
  ...timestamps,
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
  ...timestamps,
});

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

export const paymentIntents = pgTable("payment_intents", {
  id: id(),
  orderId: fkIdOpt("orderId").references(() => orders.id),
  merchantId: fkId("merchantId").references(() => branches.id),
  creatorSubjectId: text("creatorSubjectId"),
  payerSubjectId: text("payerSubjectId"),
  amountMxn: real("amountMxn").notNull(),
  bunzAmount: real("bunzAmount").notNull(),
  currency: text("currency").default("MXN").notNull(),
  status: text("status").default("PENDING_PAYMENT").notNull(),
  idempotencyKey: text("idempotencyKey").unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  paidAt: timestamp("paidAt"),
  ...timestamps,
});

export const cashDrops = pgTable("cash_drops", {
  id: id(),
  branchId: fkId("branchId").references(() => branches.id),
  staffId: fkIdOpt("staffId").references(() => staff.id),
  shiftId: fkIdOpt("shiftId").references(() => cashShifts.id),
  amount: money("amount").notNull(),
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
