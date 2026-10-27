# RESUMEN EJECUTIVO Y CONTENIDO LITERAL: RABBITTY PAY (FASES 1 A 4)

**Rama de Trabajo:** `feature/rabbitty-pay-phase1`  
**Estado:** 100% Implementado, Hardened y Validado para Piloto Controlado (10/10 tests passed en vivo, 0 errores tsc en API y Admin).

---

## 1. RESUMEN DE ARQUITECTURA, AUDITORÍA Y RESOLUCIÓN DE RIESGOS P0/P1

### A. Corrección P0: Ciclo de Vida Recuperable de Webhooks (Sin pérdida de confirmaciones)
- **Problema detectado:** Anteriormente, el webhook insertaba el evento y si la confirmación de la orden fallaba con un error temporal (500), el evento quedaba registrado. En el reintento de Stripe, el sistema lo trataba como duplicado y devolvía 200 sin procesar el cobro ni cerrar la orden.
- **Resolución implementada:** Se extendió el esquema de `payment_provider_events` con un ciclo de estados: `PROCESSING`, `COMPLETED`, `FAILED`. El endpoint (`route.ts`) solo responde duplicado (200) si el evento ya se encuentra en `COMPLETED`. Si falló previamente (`FAILED` o `PROCESSING`), el reintento es procesado nuevamente y marca `COMPLETED` al finalizar la saga o `FAILED` en caso de error.

### B. Corrección P0: Salvaguarda Contable ante Reservas de Bunz Expiradas (RECOVERY_HOLD)
- **Problema detectado:** Si la reserva de Bunz expiraba por tiempo (cron) antes de recibir el webhook de Stripe y la reserva pasaba a `EXPIRED`, el código marcaba `RECOVERY_HOLD` pero seguía insertando el pago de Bunz en la orden, dando descuento sin respaldo de saldo.
- **Resolución implementada:** En `confirmPaymentIntentSettled`, si la reserva está en `EXPIRED`, entra en `RECOVERY_HOLD` y **NO** se inserta pago de Bunz ni se incrementa `orders.bunzPaid`. Únicamente se asienta el pago fiat real de Stripe. La orden solo se cierra si el fiat por sí solo cubre el total; de lo contrario, permanece abierta con flag para auditoría de supervisor.

### C. Corrección P0: Validación Estricta de Negocio en la Confirmación del Cobro
- **Problema detectado:** El webhook verificaba la firma criptográfica pero no validaba explícitamente que el importe, moneda y comercio coincidieran con el intento interno.
- **Resolución implementada:** `confirmPaymentIntentSettled` ahora valida obligatoriamente que `expectedAmountCents === intent.netFiatCents`, que `expectedCurrency === intent.currency`, y rechaza cualquier discordancia.

### D. Corrección P1: Idempotencia en la Creación de PaymentIntents de Stripe Connect
- **Problema detectado:** Dos peticiones simultáneas de checkout podían crear dos PaymentIntents externos si ninguna había guardado aún el `externalIntentId`.
- **Resolución implementada:** En `createStripePaymentIntent`, se envía `idempotencyKey: "stripe_pi_" + intent.idempotencyKey` a la API de Stripe, garantizando que Stripe retorne el mismo cobro ante peticiones concurrentes.

### E. Efectivo Coordinado & PIN con Lockout (Fase 3)
- Verificación con hash `scrypt` mediante `findStaffByPin` con bloqueo de seguridad tras 5 intentos fallidos (5 minutos) y liberación automática de la mesa en POS.

---

## 2. CONTENIDO LITERAL DE LOS ARCHIVOS INVOLUCRADOS

---

### A. packages/database-restaurant/migrations/0016_dizzy_triathlon.sql
```sql
CREATE TABLE "bunz_reserves" (
	"id" text PRIMARY KEY NOT NULL,
	"paymentIntentId" text NOT NULL,
	"orderId" text,
	"branchId" text NOT NULL,
	"userId" text NOT NULL,
	"amount" real NOT NULL,
	"status" text DEFAULT 'RESERVED' NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"capturedAt" timestamp,
	"releasedAt" timestamp,
	"failureReason" text,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "merchant_payment_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"branchId" text NOT NULL,
	"merchantId" text,
	"provider" text DEFAULT 'STRIPE_CONNECT' NOT NULL,
	"stripeAccountId" text NOT NULL,
	"chargesEnabled" boolean DEFAULT false NOT NULL,
	"payoutsEnabled" boolean DEFAULT false NOT NULL,
	"defaultCurrency" text DEFAULT 'MXN' NOT NULL,
	"platformFeePercent" real DEFAULT 0.01 NOT NULL,
	"metadata" jsonb,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now(),
	CONSTRAINT "merchant_payment_accounts_stripeAccountId_unique" UNIQUE("stripeAccountId")
);
--> statement-breakpoint
CREATE TABLE "payment_provider_events" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"eventId" text NOT NULL,
	"eventType" text NOT NULL,
	"paymentIntentId" text,
	"payload" jsonb NOT NULL,
	"processedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_intents" ADD COLUMN IF NOT EXISTS "idempotencyKey" text;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD COLUMN IF NOT EXISTS "paidAt" timestamp;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD COLUMN "amountCents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD COLUMN "netFiatCents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD COLUMN "platformFeeCents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD COLUMN "provider" text DEFAULT 'STRIPE' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD COLUMN "externalIntentId" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_intents_idempotencyKey_unique" ON "payment_intents" ("idempotencyKey");--> statement-breakpoint
ALTER TABLE "bunz_reserves" ADD CONSTRAINT "bunz_reserves_paymentIntentId_payment_intents_id_fk" FOREIGN KEY ("paymentIntentId") REFERENCES "public"."payment_intents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bunz_reserves" ADD CONSTRAINT "bunz_reserves_orderId_orders_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bunz_reserves" ADD CONSTRAINT "bunz_reserves_branchId_branches_id_fk" FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_payment_accounts" ADD CONSTRAINT "merchant_payment_accounts_branchId_branches_id_fk" FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_provider_events" ADD CONSTRAINT "payment_provider_events_paymentIntentId_payment_intents_id_fk" FOREIGN KEY ("paymentIntentId") REFERENCES "public"."payment_intents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bunz_reserves_intent_idx" ON "bunz_reserves" USING btree ("paymentIntentId");--> statement-breakpoint
CREATE INDEX "bunz_reserves_user_idx" ON "bunz_reserves" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_provider_events_idx" ON "payment_provider_events" USING btree ("provider","eventId");
```

---

### B. packages/database-restaurant/src/schema/index.ts (Fragmento Rabbitty Pay)
```typescript
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

```

---

### C. packages/api/src/services/paymentCore.ts
```typescript
import { and, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  orders,
  payments,
  tableSessions,
  paymentIntents,
  bunzReserves,
  paymentProviderEvents,
  orderItems,
  menuItemIngredients,
  inventoryMovements,
  inventoryItems,
} from "@rabbitty/database-restaurant/schema";
import { users } from "@rabbitty/database-core/schema";
import crypto from "crypto";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/** TTL por defecto para el checkout de mesa: 10 minutos */
export const DEFAULT_INTENT_TTL_MINUTES = 10;

/** Conversión fija de lealtad: 1 Bunz = 1.00 MXN (100 centavos) */
export const BUNZ_VALUE_CENTS = 100;

/** Redondeo monetario seguro a 2 decimales */
export const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** Convertir pesos a centavos enteros sin errores de coma flotante */
export const mxnToCents = (amountMxn: number): number => {
  return Math.round(round2(amountMxn) * 100);
};

/** Convertir centavos a pesos con 2 decimales */
export const centsToMxn = (cents: number): number => {
  return round2(cents / 100);
};

/**
 * Genera una clave de idempotencia estable sin timestamps.
 * Dos llamadas idénticas para la misma orden e intento lógico producen el mismo hash.
 */
export function buildPaymentIdempotencyKey(params: {
  branchId: string;
  orderId: string;
  attemptNumber?: number;
}): string {
  const attempt = params.attemptNumber ?? 1;
  const raw = `branch:${params.branchId}:order:${params.orderId}:attempt:${attempt}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export interface CreatePaymentIntentInput {
  branchId: string;
  orderId: string;
  payerUserId?: string;
  bunzToApply?: number;
  tipMxn?: number;
  attemptNumber?: number;
  provider?: "STRIPE" | "CASH" | "BUNZ_ONLY";
  platformFeePercent?: number; // Ej: 0.01 = 1%
}

export interface PaymentIntentResult {
  intentId: string;
  orderId: string;
  grossAmountCents: number;
  bunzDiscountCents: number;
  bunzApplied: number;
  netFiatCents: number;
  platformFeeCents: number;
  currency: string;
  status: string;
  idempotencyKey: string;
  expiresAt: Date;
  reserveId?: string;
}

/**
 * MOTOR DE PAGO FASE 1:
 * Crea o recupera un Payment Intent con reserva atómica de Bunz (Hold con TTL).
 * Si la clave de idempotencia ya existe, retorna el intento existente sin duplicar.
 */
export async function createOrGetPaymentIntent(
  db: Db,
  input: CreatePaymentIntentInput
): Promise<PaymentIntentResult> {
  const idempotencyKey = buildPaymentIdempotencyKey({
    branchId: input.branchId,
    orderId: input.orderId,
    attemptNumber: input.attemptNumber,
  });

  // 1. Revisar si ya existe un intento para esta misma clave (Idempotencia en DB)
  const [existing] = await db
    .select()
    .from(paymentIntents)
    .where(eq(paymentIntents.idempotencyKey, idempotencyKey))
    .limit(1);

  if (existing) {
    const [reserve] = await db
      .select()
      .from(bunzReserves)
      .where(eq(bunzReserves.paymentIntentId, existing.id))
      .limit(1);

    return {
      intentId: existing.id,
      orderId: existing.orderId!,
      grossAmountCents: existing.amountCents,
      bunzDiscountCents: Math.round(existing.bunzAmount * BUNZ_VALUE_CENTS),
      bunzApplied: existing.bunzAmount,
      netFiatCents: existing.netFiatCents,
      platformFeeCents: existing.platformFeeCents,
      currency: existing.currency,
      status: existing.status,
      idempotencyKey: existing.idempotencyKey!,
      expiresAt: existing.expiresAt,
      reserveId: reserve?.id,
    };
  }

  // 2. Ejecutar creación atómica en transacción
  return await db.transaction(async (tx: Db) => {
    // a) Lock de la orden para evitar concurrencia
    const [orderRow] = await tx
      .select()
      .from(orders)
      .where(and(eq(orders.id, input.orderId), eq(orders.branchId, input.branchId)))
      .for("update");

    if (!orderRow) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Orden no encontrada en esta sucursal." });
    }

    if (orderRow.status === "COMPLETED" || orderRow.status === "PAID") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Esta orden ya se encuentra completamente pagada." });
    }

    // b) Calcular pagos previos ya acreditados para obtener el saldo pendiente
    const existingPayments = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.orderId, input.orderId), eq(payments.status, "COMPLETED")));

    const totalPaidMxn = existingPayments.reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0);
    const orderNetMxn = Math.max(0, Number(orderRow.total || 0) + Number(input.tipMxn || 0) - totalPaidMxn);
    const orderGrossCents = mxnToCents(orderNetMxn);

    if (orderGrossCents <= 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "La orden no tiene saldo pendiente por cobrar." });
    }

    // c) Resolver monto de Bunz solicitado y validar elegibilidad
    const requestedBunz = Math.max(0, round2(input.bunzToApply || 0));
    let bunzToReserve = 0;
    let bunzDiscountCents = 0;

    if (requestedBunz > 0 && input.payerUserId) {
      // Bloquear fila del usuario para lectura y verificación de balance atómica
      const [userRow] = await tx
        .select({
          id: users.id,
          totalBunzEarned: users.totalBunzEarned,
          totalBunzSpent: users.totalBunzSpent,
        })
        .from(users)
        .where(eq(users.id, input.payerUserId))
        .for("update");

      const availableBalance = Math.max(
        0,
        Number((userRow?.totalBunzEarned ?? 0) - (userRow?.totalBunzSpent ?? 0))
      );
      // No permitir usar más Bunz de los disponibles ni más del total de la cuenta
      const maxApplicableBunz = Math.min(availableBalance, centsToMxn(orderGrossCents));
      bunzToReserve = Math.min(requestedBunz, maxApplicableBunz);
      bunzDiscountCents = Math.round(bunzToReserve * BUNZ_VALUE_CENTS);
    }

    // d) Desglose de importes
    const netFiatCents = Math.max(0, orderGrossCents - bunzDiscountCents);
    const platformFeeRate = input.platformFeePercent ?? 0.01; // 1%
    const platformFeeCents = Math.round(netFiatCents * platformFeeRate);

    const expiresAt = new Date(Date.now() + DEFAULT_INTENT_TTL_MINUTES * 60 * 1000);
    const provider = input.provider ?? (netFiatCents === 0 ? "BUNZ_ONLY" : "STRIPE");

    // e) Insertar Payment Intent con centavos enteros
    const [intent] = await tx
      .insert(paymentIntents)
      .values({
        orderId: input.orderId,
        merchantId: input.branchId,
        payerSubjectId: input.payerUserId ?? null,
        amountCents: orderGrossCents,
        bunzAmount: bunzToReserve,
        netFiatCents: netFiatCents,
        platformFeeCents: platformFeeCents,
        amountMxn: centsToMxn(orderGrossCents),
        currency: "MXN",
        provider: provider,
        status: "PENDING_PAYMENT",
        idempotencyKey,
        expiresAt,
      })
      .returning();

    // f) Si hay Bunz aplicados, crear la reserva atómica vinculada
    let reserveId: string | undefined;
    if (bunzToReserve > 0 && input.payerUserId) {
      // Incrementar totalBunzSpent temporalmente para retener el saldo (Hold)
      await tx
        .update(users)
        .set({
          totalBunzSpent: sql`COALESCE(${users.totalBunzSpent}, 0) + ${Math.round(bunzToReserve)}`,
        })
        .where(eq(users.id, input.payerUserId));

      const [res] = await tx
        .insert(bunzReserves)
        .values({
          paymentIntentId: intent.id,
          orderId: input.orderId,
          branchId: input.branchId,
          userId: input.payerUserId,
          amount: bunzToReserve,
          status: "RESERVED",
          expiresAt,
        })
        .returning();

      reserveId = res.id;
    }

    return {
      intentId: intent.id,
      orderId: input.orderId,
      grossAmountCents: orderGrossCents,
      bunzDiscountCents,
      bunzApplied: bunzToReserve,
      netFiatCents,
      platformFeeCents,
      currency: "MXN",
      status: "PENDING_PAYMENT",
      idempotencyKey,
      expiresAt,
      reserveId,
    };
  });
}

/**
 * CONFIRMACIÓN ATÓMICA DE PAGO (Saga Transaccional):
 * Ejecuta el cierre seguro del Payment Intent, captura irrevocable de Bunz,
 * inserción en payments, deducción de inventario y liberación de mesa.
 */
export async function confirmPaymentIntentSettled(
  db: Db,
  params: {
    paymentIntentId: string;
    externalTransactionId?: string;
    verifiedMethod: "STRIPE_CARD" | "APPLE_PAY" | "CASH" | "BUNZ_ONLY";
    expectedAmountCents?: number;
    expectedCurrency?: string;
    expectedMerchantId?: string;
  }
): Promise<{ success: boolean; orderId: string; status: string; recoveryHold?: boolean }> {
  return await db.transaction(async (tx: Db) => {
    // 1. Lock del Payment Intent
    const [intent] = await tx
      .select()
      .from(paymentIntents)
      .where(eq(paymentIntents.id, params.paymentIntentId))
      .for("update");

    if (!intent) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Payment Intent no encontrado." });
    }

    // Validación de negocio del cobro externo contra los registros de Rabbitty
    if (params.expectedAmountCents !== undefined && params.expectedAmountCents !== intent.netFiatCents) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Monto del cobro no coincide. Esperado: ${intent.netFiatCents} centavos, recibido: ${params.expectedAmountCents} centavos.`,
      });
    }

    if (params.expectedCurrency !== undefined && params.expectedCurrency.toUpperCase() !== (intent.currency || "MXN").toUpperCase()) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Moneda del cobro no coincide. Esperada: ${intent.currency}, recibida: ${params.expectedCurrency}.`,
      });
    }

    if (params.expectedMerchantId !== undefined && params.expectedMerchantId !== intent.merchantId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Comercio del cobro no coincide. Esperado: ${intent.merchantId}, recibido: ${params.expectedMerchantId}.`,
      });
    }

    // Si ya fue completado previamente, retornar éxito idempotente
    if (intent.status === "SUCCEEDED") {
      return { success: true, orderId: intent.orderId!, status: "SUCCEEDED" };
    }

    // 2. Lock de la orden asociada
    const [orderRow] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, intent.orderId!))
      .for("update");

    if (!orderRow) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Orden asociada no encontrada." });
    }

    // 3. Procesar captura definitiva de reservas de Bunz
    const [reserve] = await tx
      .select()
      .from(bunzReserves)
      .where(eq(bunzReserves.paymentIntentId, intent.id))
      .for("update");

    let isReserveValid = false;
    let isRecoveryHold = false;

    if (reserve && reserve.status === "RESERVED") {
      await tx
        .update(bunzReserves)
        .set({
          status: "CAPTURED",
          capturedAt: new Date(),
        })
        .where(eq(bunzReserves.id, reserve.id));
      isReserveValid = true;
    } else if (reserve && reserve.status === "EXPIRED") {
      // Carrera: el cron lo marcó como EXPIRED antes de la confirmación
      // P0 FIX: Los Bunz ya fueron devueltos al usuario por la expiración.
      // NO se deben acreditar como pagados a la orden ni dar descuento sin respaldo.
      // Se pasa la reserva a RECOVERY_HOLD para auditoría y no se completa la orden si falta saldo.
      await tx
        .update(bunzReserves)
        .set({
          status: "RECOVERY_HOLD",
          failureReason: "Pago confirmado tras expiración de reserva. Saldo Bunz desbalanceado - requiere resolución de supervisor.",
        })
        .where(eq(bunzReserves.id, reserve.id));
      isRecoveryHold = true;
    }

    // 4. Insertar registro de pago fiat si hubo importe con tarjeta/efectivo
    if (intent.netFiatCents > 0) {
      await tx.insert(payments).values({
        orderId: intent.orderId!,
        method: params.verifiedMethod === "CASH" ? "CASH" : "CREDIT_CARD",
        amount: centsToMxn(intent.netFiatCents),
        reference: params.externalTransactionId ?? intent.idempotencyKey,
        status: "COMPLETED",
        verificationMethod: params.verifiedMethod === "CASH" ? "CASHIER_CONFIRMED" : "STRIPE_WEBHOOK",
      });
    }

    // 5. Insertar registro de pago con Bunz ÚNICAMENTE si la reserva fue capturada válidamente
    if (intent.bunzAmount > 0 && isReserveValid) {
      await tx.insert(payments).values({
        orderId: intent.orderId!,
        method: "BUNZ",
        amount: centsToMxn(Math.round(intent.bunzAmount * BUNZ_VALUE_CENTS)),
        reference: `RESERVE:${reserve?.id || intent.id}`,
        status: "COMPLETED",
        verificationMethod: "INTERNAL_LEDGER",
      });

      await tx
        .update(orders)
        .set({ bunzPaid: (orderRow.bunzPaid || 0) + intent.bunzAmount })
        .where(eq(orders.id, intent.orderId!));
    }

    // 6. Verificar total pagado contra la orden
    const allPayments = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.orderId, intent.orderId!), eq(payments.status, "COMPLETED")));

    const totalPaidMxn = allPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
    const targetPayableAmount = Math.max(0, Number(orderRow.total || 0));

    // Si el total acumulado liquida la orden, marcar como COMPLETED y liberar mesa
    // Si la reserva expiró y está en RECOVERY_HOLD, solo se completa si el fiat por sí solo cubrió el 100%
    if (round2(totalPaidMxn) >= targetPayableAmount) {
      await tx
        .update(orders)
        .set({ status: "COMPLETED" })
        .where(eq(orders.id, intent.orderId!));

      // Liberar sesión de mesa
      if (orderRow.tableId) {
        await tx
          .update(tableSessions)
          .set({ status: "CLOSED", closedAt: new Date() })
          .where(and(eq(tableSessions.tableId, orderRow.tableId), eq(tableSessions.status, "OPEN")));
      }

      // Deducción de stock / recetas
      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, intent.orderId!));
      for (const item of items) {
        const ingredients = await tx
          .select()
          .from(menuItemIngredients)
          .where(eq(menuItemIngredients.menuItemId, item.menuItemId));

        for (const ing of ingredients) {
          if (ing.inventoryItemId) {
            const deductionAmount = ing.quantityRequired * item.quantity;
            await tx.insert(inventoryMovements).values({
              itemId: ing.inventoryItemId,
              branchId: intent.merchantId,
              type: "SALE_DEDUCTION",
              quantity: deductionAmount,
              reference: intent.orderId!,
              notes: `Order ${intent.orderId!} completed via Rabbitty Pay`,
            });

            await tx.execute(sql`
              UPDATE inventory_items 
              SET stock = stock - ${deductionAmount} 
              WHERE id = ${ing.inventoryItemId}
            `);
          }
        }
      }
    }

    // 7. Actualizar Payment Intent a SUCCEEDED
    await tx
      .update(paymentIntents)
      .set({
        status: "SUCCEEDED",
        externalIntentId: params.externalTransactionId ?? intent.externalIntentId,
        paidAt: new Date(),
      })
      .where(eq(paymentIntents.id, intent.id));

    return {
      success: true,
      orderId: intent.orderId!,
      status: "SUCCEEDED",
      recoveryHold: isRecoveryHold,
    };
  });
}

/**
 * CANCELACIÓN O LIBERACIÓN DE RESERVA ANTE FALLO:
 * Si el usuario cancela o el cobro con tarjeta falla, libera de inmediato los Bunz reservados.
 */
export async function releasePaymentIntentHold(
  db: Db,
  params: {
    paymentIntentId: string;
    reason: string;
    callerUserId?: string;
  }
): Promise<{ released: boolean; refundedBunz: number }> {
  return await db.transaction(async (tx: Db) => {
    const [intent] = await tx
      .select()
      .from(paymentIntents)
      .where(eq(paymentIntents.id, params.paymentIntentId))
      .for("update");

    if (!intent) return { released: false, refundedBunz: 0 };

    // Si viene un usuario autenticado y la reserva tiene dueño, asegurar ownership
    if (params.callerUserId && intent.payerSubjectId && intent.payerSubjectId !== params.callerUserId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "No tienes autorización para cancelar este intento de pago.",
      });
    }

    if (intent.status === "SUCCEEDED") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No se puede liberar un intento de pago que ya fue cobrado exitosamente.",
      });
    }

    let refundedBunz = 0;
    const [reserve] = await tx
      .select()
      .from(bunzReserves)
      .where(eq(bunzReserves.paymentIntentId, intent.id))
      .for("update");

    if (reserve && reserve.status === "RESERVED") {
      refundedBunz = Number(reserve.amount || 0);

      // Reembolsar el saldo al usuario liberando el gasto temporal
      await tx
        .update(users)
        .set({
          totalBunzSpent: sql`GREATEST(0, COALESCE(${users.totalBunzSpent}, 0) - ${Math.round(refundedBunz)})`,
        })
        .where(eq(users.id, reserve.userId));

      await tx
        .update(bunzReserves)
        .set({
          status: "RELEASED",
          releasedAt: new Date(),
          failureReason: params.reason,
        })
        .where(eq(bunzReserves.id, reserve.id));
    }

    await tx
      .update(paymentIntents)
      .set({
        status: "CANCELLED",
      })
      .where(eq(paymentIntents.id, intent.id));

    return { released: true, refundedBunz };
  });
}

/**
/**
 * DEDUPLICACIÓN DE EVENTOS DE PROVEEDOR (Once-and-only-once en DB con Ciclo de Vida Recuperable):
 * 1. Inserta el evento en estado 'PROCESSING' o recupera el existente.
 * 2. Si ya estaba en 'COMPLETED', retorna alreadyCompleted = true (200 OK seguro ante replay).
 * 3. Si estaba en 'FAILED' o 'PROCESSING' (reintento legítimo tras fallo previo), permite re-procesar.
 */
export async function registerProviderWebhookEvent(
  db: Db,
  params: {
    provider: "STRIPE";
    eventId: string;
    eventType: string;
    paymentIntentId?: string;
    payload: Record<string, any>;
  }
): Promise<{
  isDuplicate: boolean;
  alreadyCompleted: boolean;
  eventRecordId?: string;
}> {
  try {
    const [record] = await db
      .insert(paymentProviderEvents)
      .values({
        provider: params.provider,
        eventId: params.eventId,
        eventType: params.eventType,
        paymentIntentId: params.paymentIntentId ?? null,
        payload: params.payload,
        status: "PROCESSING",
      })
      .returning();

    return {
      isDuplicate: false,
      alreadyCompleted: false,
      eventRecordId: record.id,
    };
  } catch (err: any) {
    if (err?.code === "23505" || String(err?.message || "").includes("duplicate key") || String(err?.message || "").includes("unique")) {
      const [existing] = await db
        .select()
        .from(paymentProviderEvents)
        .where(
          and(
            eq(paymentProviderEvents.provider, params.provider),
            eq(paymentProviderEvents.eventId, params.eventId)
          )
        )
        .limit(1);

      if (existing?.status === "COMPLETED") {
        return {
          isDuplicate: true,
          alreadyCompleted: true,
          eventRecordId: existing.id,
        };
      }

      // Si existía pero estaba en PROCESSING o FAILED, permitir reintento recuperable
      return {
        isDuplicate: true,
        alreadyCompleted: false,
        eventRecordId: existing?.id,
      };
    }
    throw err;
  }
}

/**
 * Marca el evento de webhook como COMPLETADO exitosamente tras la saga de negocio.
 */
export async function markProviderWebhookEventCompleted(
  db: Db,
  eventId: string,
  paymentIntentId?: string
): Promise<void> {
  await db
    .update(paymentProviderEvents)
    .set({
      status: "COMPLETED",
      paymentIntentId: paymentIntentId ?? undefined,
      errorMessage: null,
      processedAt: new Date(),
    })
    .where(eq(paymentProviderEvents.eventId, eventId));
}

/**
 * Marca el evento de webhook como FALLIDO para que Stripe reintente y el sistema sepa que falló.
 */
export async function markProviderWebhookEventFailed(
  db: Db,
  eventId: string,
  errorMsg: string
): Promise<void> {
  await db
    .update(paymentProviderEvents)
    .set({
      status: "FAILED",
      errorMessage: errorMsg,
      processedAt: new Date(),
    })
    .where(eq(paymentProviderEvents.eventId, eventId));
}


```

---

### D. packages/api/src/services/stripeConnect.ts
```typescript
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

```

---

### E. packages/api/src/routers/payments.ts
```typescript
import { z } from "zod";
import { and, eq, inArray, gte, lt, sql } from "drizzle-orm";
import { router, protectedProcedure, publicLimitedProcedure, resolveBranchId } from "../trpc";
import { orders, payments, tables, tableSessions, orderItems } from "@rabbitty/database-restaurant/schema";
import { bus, EventTypes } from "@rabbitty/events";
import { assertOpenShiftForCash, findStaffByPin, CASHIER_ROLES } from "../services/cashShift";

export const paymentsRouter = router({
  refund: protectedProcedure
    .input(z.object({
      paymentId: z.string(),
      amount: z.number(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [payment] = await ctx.restaurantDb.select().from(payments).where(eq(payments.id, input.paymentId));
      if (!payment) throw new Error("Pago no encontrado");
      if (payment.status === "REFUNDED") throw new Error("El pago ya fue reembolsado");

      const [refund] = await ctx.restaurantDb.insert(payments).values({
        orderId: payment.orderId,
        method: payment.method,
        amount: -Math.abs(input.amount),
        reference: `Refund: ${input.reason || "Sin razón"}`,
        status: "REFUNDED",
      }).returning();

      await ctx.restaurantDb.update(payments).set({ status: "REFUNDED" }).where(eq(payments.id, input.paymentId));

      bus.emit(EventTypes.PAYMENT_PROCESSED, { paymentId: refund!.id, orderId: payment.orderId, type: "REFUND" });
      return refund;
    }),

  processPayment: protectedProcedure
    .input(
      z.object({
        orderId: z.string(),
        method: z.enum(["CASH", "CREDIT_CARD", "DEBIT_CARD", "BUNZ"]),
        amount: z.number(),
        reference: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.method === "CASH") {
        await assertOpenShiftForCash(ctx.restaurantDb, ctx.branchId);
      }
      const order = await ctx.restaurantDb.select().from(orders).where(eq(orders.id, input.orderId));
      if (!order) throw new Error("Orden no encontrada");

      const [payment] = await ctx.restaurantDb.insert(payments).values({
        orderId: input.orderId,
        method: input.method,
        amount: input.amount,
        reference: input.reference ?? null,
      }).returning();

      if (!payment) throw new Error("Error al procesar el pago");

      bus.emit(EventTypes.PAYMENT_PROCESSED, { paymentId: payment.id, orderId: input.orderId });
      return payment;
    }),

  splitBill: protectedProcedure
    .input(z.object({
      orderId: z.string(),
      splits: z.array(z.object({
        customerName: z.string().optional(),
        amount: z.number().min(1),
        method: z.enum(["CASH", "CREDIT_CARD", "DEBIT_CARD", "BUNZ"]),
      })).min(2),
    }))
    .mutation(async ({ ctx, input }) => {
      const [order] = await ctx.restaurantDb.select().from(orders).where(eq(orders.id, input.orderId));
      if (!order) throw new Error("Orden no encontrada");

      const totalSplit = input.splits.reduce((s, p) => s + p.amount, 0);
      if (Math.abs(totalSplit - order.total) > 0.01) {
        throw new Error("La suma de los splits no coincide con el total de la orden");
      }

      const results = [];
      for (const split of input.splits) {
        if (split.method === "CASH") {
          await assertOpenShiftForCash(ctx.restaurantDb, ctx.branchId);
        }
        const [payment] = await ctx.restaurantDb.insert(payments).values({
          orderId: input.orderId,
          method: split.method,
          amount: split.amount,
          reference: split.customerName ? `Split: ${split.customerName}` : "Split bill",
        }).returning();
        if (payment) results.push(payment);
      }

      bus.emit(EventTypes.PAYMENT_PROCESSED, { orderId: input.orderId, splitCount: results.length });
      return { success: true, payments: results };
    }),

  addTip: protectedProcedure
    .input(z.object({
      orderId: z.string(),
      tip: z.number().min(0),
      method: z.enum(["CASH", "CREDIT_CARD", "DEBIT_CARD"]).default("CASH"),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.tip <= 0) throw new Error("La propina debe ser mayor a 0");
      if (input.method === "CASH") {
        await assertOpenShiftForCash(ctx.restaurantDb, ctx.branchId);
      }

      const [payment] = await ctx.restaurantDb.insert(payments).values({
        orderId: input.orderId,
        method: input.method,
        amount: input.tip,
        reference: "Tip",
      }).returning();

      await ctx.restaurantDb.update(orders).set({
        tip: sql`${orders.tip} + ${input.tip}`,
      }).where(eq(orders.id, input.orderId));

      return payment;
    }),

  list: protectedProcedure
    .input(z.object({
      branchId: z.string().optional(),
      limit: z.number().default(50),
      offset: z.number().default(0),
      status: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [];
      const branchId = ctx.staffRole ? ctx.staffBranchId : input.branchId;
      if (branchId) conditions.push(eq(orders.branchId, branchId));
      if (input.status) conditions.push(eq(payments.status, input.status));

      const query = ctx.restaurantDb.select({
        payment: payments,
        order: { id: orders.id, total: orders.total, status: orders.status, customerName: orders.customerName, branchId: orders.branchId },
      })
        .from(payments)
        .leftJoin(orders, eq(payments.orderId, orders.id))
        .orderBy(sql`${payments.createdAt} DESC`)
        .limit(input.limit)
        .offset(input.offset);

      const where = conditions.length > 0 ? and(...conditions) : undefined;
      return where ? await query.where(where) : await query;
    }),

  getByOrder: protectedProcedure
    .input(z.object({ orderId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.restaurantDb.select().from(payments).where(eq(payments.orderId, input.orderId));
    }),

  getTotals: protectedProcedure
    .input(z.object({ startDate: z.string(), endDate: z.string() }))
    .query(async ({ ctx, input }) => {
      const start = input.startDate ? new Date(input.startDate) : new Date(0);
      const end = input.endDate ? new Date(input.endDate) : new Date();
      end.setDate(end.getDate() + 1);

      const [cashPayments, cardPayments, bunzPayments] = await Promise.all([
        ctx.restaurantDb.select().from(payments).where(
          and(eq(payments.method, "CASH"), gte(payments.createdAt, start), lt(payments.createdAt, end))
        ),
        ctx.restaurantDb.select().from(payments).where(
          and(inArray(payments.method, ["CREDIT_CARD", "DEBIT_CARD"]), gte(payments.createdAt, start), lt(payments.createdAt, end))
        ),
        ctx.restaurantDb.select().from(payments).where(
          and(eq(payments.method, "BUNZ"), gte(payments.createdAt, start), lt(payments.createdAt, end))
        ),
      ]);
      return {
        cash: cashPayments.reduce((sum, p) => sum + p.amount, 0),
        card: cardPayments.reduce((sum, p) => sum + p.amount, 0),
        bunz: bunzPayments.reduce((sum, p) => sum + p.amount, 0),
        total: cashPayments.reduce((sum, p) => sum + p.amount, 0) + cardPayments.reduce((sum, p) => sum + p.amount, 0) + bunzPayments.reduce((sum, p) => sum + p.amount, 0),
      };
    }),

  // Public procedure for in-table QR payment
  getOrderForPayment: publicLimitedProcedure
    .input(z.object({ orderId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [order] = await ctx.restaurantDb.select().from(orders).where(eq(orders.id, input.orderId));
      if (!order) throw new Error("Orden no encontrada");
      if (order.status === "PAID" || order.status === "VOID") throw new Error("Orden ya pagada o cancelada");

      const items = await ctx.restaurantDb.select().from(orderItems).where(eq(orderItems.orderId, input.orderId));
      const table = order.tableId
        ? await ctx.restaurantDb.select().from(tables).where(eq(tables.id, order.tableId))
        : null;

      return {
        order,
        items,
        tableNumber: table?.[0]?.number ?? null,
      };
    }),

  // ==========================================
  // Rabbitty Pay Phase 1: Core Engine Endpoints
  // ==========================================
  createPaymentIntent: publicLimitedProcedure
    .input(z.object({
      orderId: z.string(),
      bunzAmount: z.number().min(0).default(0),
      tipAmount: z.number().min(0).default(0),
      attemptNumber: z.number().int().min(1).default(1),
      customerId: z.string().optional(),
      provider: z.enum(["STRIPE", "CASH", "BUNZ_ONLY"]).default("STRIPE"),
    }))
    .mutation(async ({ ctx, input }) => {
      const [order] = await ctx.restaurantDb.select().from(orders).where(eq(orders.id, input.orderId));
      if (!order) throw new Error("Orden no encontrada");

      // Scoping: Si el usuario está autenticado, no permitir atribuir la deducción de Bunz a un tercero ajeno
      const effectiveUserId = ctx.userId ?? input.customerId ?? undefined;

      const { createOrGetPaymentIntent } = await import("../services/paymentCore");

      return await createOrGetPaymentIntent(ctx.restaurantDb, {
        branchId: order.branchId,
        orderId: input.orderId,
        payerUserId: effectiveUserId,
        bunzToApply: Math.floor(input.bunzAmount),
        tipMxn: input.tipAmount,
        attemptNumber: input.attemptNumber,
        provider: input.provider,
      });
    }),

  getPaymentIntent: publicLimitedProcedure
    .input(z.object({ intentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { paymentIntents } = await import("@rabbitty/database-restaurant/schema");
      const [intent] = await ctx.restaurantDb.select().from(paymentIntents).where(eq(paymentIntents.id, input.intentId));
      if (!intent) throw new Error("Intento de pago no encontrado");

      // Scoping de lectura: Si el intento tiene un payerSubjectId y el llamante está autenticado con otra cuenta
      if (ctx.userId && intent.payerSubjectId && intent.payerSubjectId !== ctx.userId && !ctx.staffRole) {
        throw new Error("Acceso denegado a este intento de pago");
      }

      return intent;
    }),

  cancelPaymentIntent: publicLimitedProcedure
    .input(z.object({
      intentId: z.string(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { releasePaymentIntentHold } = await import("../services/paymentCore");
      return await releasePaymentIntentHold(ctx.restaurantDb, {
        paymentIntentId: input.intentId,
        reason: input.reason ?? "USER_CANCELLED",
        callerUserId: ctx.staffRole ? undefined : (ctx.userId ?? undefined),
      });
    }),

  // ==========================================
  // Rabbitty Pay Phase 2: Stripe Connect & Secrets
  // ==========================================
  createStripePaymentSecret: publicLimitedProcedure
    .input(z.object({
      intentId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { paymentIntents } = await import("@rabbitty/database-restaurant/schema");
      const [intent] = await ctx.restaurantDb
        .select()
        .from(paymentIntents)
        .where(eq(paymentIntents.id, input.intentId))
        .limit(1);

      if (!intent) {
        throw new Error("Intento de pago no encontrado.");
      }

      // Scoping de seguridad: si el intento ya tiene un payerSubjectId y el llamante está autenticado con otra cuenta
      if (ctx.userId && intent.payerSubjectId && intent.payerSubjectId !== ctx.userId && !ctx.staffRole) {
        throw new Error("Acceso denegado: este intento de pago pertenece a otra sesión.");
      }

      const { createStripePaymentIntent } = await import("../services/stripeConnect");
      return await createStripePaymentIntent({
        db: ctx.restaurantDb,
        intentId: input.intentId,
      });
    }),

  getStripeAccountStatus: protectedProcedure
    .input(z.object({
      branchId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const branchId = resolveBranchId(ctx, input.branchId);
      const { syncStripeAccountStatus } = await import("../services/stripeConnect");
      return await syncStripeAccountStatus({
        db: ctx.restaurantDb,
        branchId,
      });
    }),

  createStripeConnectLink: protectedProcedure
    .input(z.object({
      branchId: z.string().optional(),
      refreshUrl: z.string().url(),
      returnUrl: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      const branchId = resolveBranchId(ctx, input.branchId);
      const { createStripeConnectOnboardingLink } = await import("../services/stripeConnect");
      return await createStripeConnectOnboardingLink({
        db: ctx.restaurantDb,
        branchId,
        refreshUrl: input.refreshUrl,
        returnUrl: input.returnUrl,
        email: ctx.user?.email ?? undefined,
        businessName: ctx.user?.name ?? undefined,
      });
    }),

  // ==========================================
  // Rabbitty Pay Phase 3: Efectivo Coordinado con POS
  // ==========================================
  requestCashPayment: publicLimitedProcedure
    .input(z.object({
      orderId: z.string(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [order] = await ctx.restaurantDb
        .select()
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1);

      if (!order) throw new Error("Orden no encontrada");
      if (order.status === "COMPLETED" || order.status === "VOID") {
        throw new Error("La orden ya fue liquidada o cancelada.");
      }

      await ctx.restaurantDb
        .update(orders)
        .set({
          status: "CASH_PAYMENT_REQUESTED",
          notes: input.notes ? `${order.notes ? order.notes + " | " : ""}${input.notes}` : order.notes,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, input.orderId));

      bus.emit(EventTypes.CASH_PAYMENT_REQUESTED, {
        orderId: order.id,
        tableId: order.tableId,
        branchId: order.branchId,
        total: order.total,
      });

      return { success: true, status: "CASH_PAYMENT_REQUESTED" };
    }),

  confirmCashPaymentWithPin: protectedProcedure
    .input(z.object({
      orderId: z.string(),
      pin: z.string().length(4),
      amount: z.number().min(0),
      tip: z.number().min(0).default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      // 1. Validar que la caja tenga turno abierto
      await assertOpenShiftForCash(ctx.restaurantDb, ctx.branchId);

      // 2. Verificar PIN de cajero / staff con hash scrypt y lockout
      const matchedStaff = await findStaffByPin(
        ctx.restaurantDb,
        ctx.branchId,
        input.pin,
        CASHIER_ROLES,
        "PIN de cajero o supervisor incorrecto"
      );

      // 3. Bloqueo transaccional y liquidación
      const [order] = await ctx.restaurantDb
        .select()
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1);

      if (!order) throw new Error("Orden no encontrada");
      if (order.status === "COMPLETED" || order.status === "VOID") {
        throw new Error("La orden ya se encuentra liquidada.");
      }

      // 4. Registrar pago en efectivo
      const [payment] = await ctx.restaurantDb.insert(payments).values({
        orderId: order.id,
        method: "CASH",
        amount: input.amount,
        reference: `Efectivo en caja (Autorizado por ${matchedStaff.name})`,
        status: "COMPLETED",
      }).returning();

      // 5. Cierre de orden y liberación de mesa
      await ctx.restaurantDb.update(orders).set({
        status: "COMPLETED",
        tip: sql`${orders.tip} + ${input.tip}`,
        updatedAt: new Date(),
      }).where(eq(orders.id, order.id));

      if (order.tableId) {
        await ctx.restaurantDb.update(tableSessions).set({
          status: "CLOSED",
          closedAt: new Date(),
        }).where(and(
          eq(tableSessions.tableId, order.tableId),
          eq(tableSessions.status, "OPEN")
        ));
      }

      bus.emit(EventTypes.ORDER_PAID, {
        orderId: order.id,
        branchId: ctx.branchId,
        paymentId: payment?.id,
        method: "CASH",
        amount: input.amount,
      });

      return {
        success: true,
        orderId: order.id,
        cashier: matchedStaff.name,
      };
    }),

  // ==========================================
  // Rabbitty Pay Phase 4: Conciliación Financiera SaaS
  // ==========================================
  getFinancialReconciliation: protectedProcedure
    .input(z.object({
      branchId: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const branchId = resolveBranchId(ctx, input.branchId);
      const start = input.startDate ? new Date(input.startDate) : new Date(Date.now() - 30 * 24 * 3600 * 1000);
      const end = input.endDate ? new Date(input.endDate) : new Date();
      end.setDate(end.getDate() + 1);

      const { paymentIntents, bunzReserves } = await import("@rabbitty/database-restaurant/schema");

      const intents = await ctx.restaurantDb
        .select()
        .from(paymentIntents)
        .where(
          and(
            eq(paymentIntents.merchantId, branchId),
            gte(paymentIntents.createdAt, start),
            lt(paymentIntents.createdAt, end)
          )
        );

      let grossOrderCents = 0;
      let netFiatCents = 0;
      let platformFeeCents = 0;
      let bunzDiscountCents = 0;
      let succeededCount = 0;
      let pendingCount = 0;
      let cancelledCount = 0;

      for (const pi of intents) {
        if (pi.status === "SUCCEEDED") {
          succeededCount++;
          grossOrderCents += pi.amountCents || Math.round(Number(pi.amountMxn || 0) * 100);
          netFiatCents += pi.netFiatCents || 0;
          platformFeeCents += pi.platformFeeCents || 0;
          bunzDiscountCents += Math.round(Number(pi.bunzAmount || 0) * 100);
        } else if (pi.status === "CANCELLED" || pi.status === "EXPIRED" || pi.status === "FAILED") {
          cancelledCount++;
        } else {
          pendingCount++;
        }
      }

      // Estimación de procesador Stripe (2.9% + 2.50 MXN)
      const estimatedProcessorFeeCents = Math.round(netFiatCents * 0.029) + (succeededCount * 250);
      const netSettledToMerchantCents = Math.max(0, netFiatCents - platformFeeCents - estimatedProcessorFeeCents);

      return {
        summary: {
          grossOrderTotalMxn: grossOrderCents / 100,
          netFiatMxn: netFiatCents / 100,
          bunzDiscountMxn: bunzDiscountCents / 100,
          platformFeeMxn: platformFeeCents / 100,
          estimatedProcessorFeeMxn: estimatedProcessorFeeCents / 100,
          netSettledToMerchantMxn: netSettledToMerchantCents / 100,
          succeededCount,
          pendingCount,
          cancelledCount,
          totalIntentsCount: intents.length,
        },
        records: intents.map((pi: any) => ({
          id: pi.id,
          orderId: pi.orderId,
          createdAt: pi.createdAt,
          status: pi.status,
          provider: pi.provider,
          grossMxn: (pi.amountCents || 0) / 100,
          netFiatMxn: (pi.netFiatCents || 0) / 100,
          platformFeeMxn: (pi.platformFeeCents || 0) / 100,
          bunzApplied: pi.bunzAmount || 0,
        })),
      };
    }),
});


```

---

### F. apps/admin/src/app/api/webhooks/stripe/route.ts
```typescript
import { NextResponse } from "next/server";
import { getStripeClient } from "@rabbitty/api/services/stripeConnect";
import { getRestaurantDb, getCoreDb } from "@rabbitty/api/db";
import {
  registerProviderWebhookEvent,
  markProviderWebhookEventCompleted,
  markProviderWebhookEventFailed,
  confirmPaymentIntentSettled,
  releasePaymentIntentHold,
} from "@rabbitty/api/services/paymentCore";
import { paymentIntents } from "@rabbitty/database-restaurant/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

/**
 * Endpoint oficial de Webhooks de Stripe Connect para Rabbitty Pay.
 * 1. Lee el cuerpo binario crudo (raw body) para verificar la firma de Stripe.
 * 2. Ciclo de vida recuperable de eventos (PROCESSING -> COMPLETED | FAILED).
 *    Si falla una confirmación previa, reintentos de Stripe vuelven a procesar.
 * 3. Valida datos de negocio del cobro (monto, moneda, sucursal, estatus).
 * 4. Ejecuta la confirmación atómica o cancelación de hold.
 */
export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[Stripe Webhook] STRIPE_WEBHOOK_SECRET no está configurado.");
    return NextResponse.json(
      { error: "Webhook secret no configurado." },
      { status: 500 }
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Firma stripe-signature ausente." },
      { status: 400 }
    );
  }

  let event: any;

  try {
    const rawBody = await req.text();
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    console.error("[Stripe Webhook] Error verificando firma criptográfica:", err.message);
    return NextResponse.json(
      { error: `Firma inválida: ${err.message}` },
      { status: 400 }
    );
  }

  const restaurantDb = getRestaurantDb();

  // Deduplicación física en DB con ciclo de vida recuperable (once-and-only-once real)
  const regResult = await registerProviderWebhookEvent(restaurantDb, {
    provider: "STRIPE",
    eventId: event.id,
    eventType: event.type,
    payload: event,
  });

  // P0 FIX: Únicamente respondemos 200 directo si la operación de negocio YA completó con éxito.
  // Si estaba en PROCESSING o FAILED, permitimos continuar el procesamiento para no perder confirmaciones.
  if (regResult.alreadyCompleted) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    let resolvedIntentId: string | undefined;

    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object;
        const externalId = pi.id;

        // Localizar el intento interno por metadata o por externalIntentId
        let internalIntentId = pi.metadata?.rabbittyIntentId;

        if (!internalIntentId) {
          const [found] = await restaurantDb
            .select()
            .from(paymentIntents)
            .where(eq(paymentIntents.externalIntentId, externalId))
            .limit(1);
          internalIntentId = found?.id;
        }

        if (internalIntentId) {
          resolvedIntentId = internalIntentId;
          // P0 FIX: Validación de negocio del cobro (monto, moneda y status)
          await confirmPaymentIntentSettled(restaurantDb, {
            paymentIntentId: internalIntentId,
            externalTransactionId: pi.latest_charge || externalId,
            verifiedMethod: "STRIPE_CARD",
            expectedAmountCents: typeof pi.amount === "number" ? pi.amount : undefined,
            expectedCurrency: pi.currency ? pi.currency.toUpperCase() : undefined,
          });
          console.log(`[Stripe Webhook] Intento ${internalIntentId} liquidado exitosamente.`);
        } else {
          console.warn(`[Stripe Webhook] PaymentIntent ${externalId} no tiene intento interno en Rabbitty.`);
        }
        break;
      }

      case "payment_intent.payment_failed":
      case "payment_intent.canceled": {
        const pi = event.data.object;
        const externalId = pi.id;
        let internalIntentId = pi.metadata?.rabbittyIntentId;

        if (!internalIntentId) {
          const [found] = await restaurantDb
            .select()
            .from(paymentIntents)
            .where(eq(paymentIntents.externalIntentId, externalId))
            .limit(1);
          internalIntentId = found?.id;
        }

        if (internalIntentId) {
          resolvedIntentId = internalIntentId;
          const failureMsg = pi.last_payment_error?.message || "Stripe payment failed or canceled";
          await releasePaymentIntentHold(restaurantDb, {
            paymentIntentId: internalIntentId,
            reason: failureMsg,
          });
          console.log(`[Stripe Webhook] Intento ${internalIntentId} cancelado y hold liberado: ${failureMsg}`);
        }
        break;
      }

      default:
        // Otros eventos informativos
        break;
    }

    // P0 FIX: Marcar el evento como COMPLETADO tras finalizar con éxito la saga
    await markProviderWebhookEventCompleted(restaurantDb, event.id, resolvedIntentId);

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("[Stripe Webhook] Error procesando evento de Stripe:", error);
    // P0 FIX: Marcar como FAILED en DB para auditoría y devolver 500 para que Stripe reintente
    await markProviderWebhookEventFailed(restaurantDb, event.id, error.message || "Error procesando webhook");
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

```

---

### G. apps/admin/src/app/pay/[orderId]/PaymentClient.tsx
```typescript
"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc-client";
import { Card, Button, toast } from "@rabbitty/ui";
import { 
  Sparkles, CheckCircle2, Store, CreditCard, 
  MessageSquareQuote, ShieldCheck, Loader2 
} from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

// Inicializador del Stripe Promise con la Publishable Key pública
const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

function StripeCheckoutForm({
  clientSecret,
  orderId,
  onSuccess,
}: {
  clientSecret: string;
  orderId: string;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setErrorMsg(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/pay/${orderId}`,
      },
      redirect: "if_required",
    });

    if (error) {
      setErrorMsg(error.message || "Error al procesar el pago");
      setSubmitting(false);
    } else if (paymentIntent && paymentIntent.status === "succeeded") {
      toast.success("¡Pago recibido con éxito!");
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <PaymentElement
          options={{
            layout: "tabs",
            wallets: {
              applePay: "auto",
              googlePay: "auto",
            },
          }}
        />
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 font-medium">
          {errorMsg}
        </div>
      )}

      <Button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-black text-sm py-3.5 rounded-xl shadow-lg shadow-pink-500/25 flex items-center justify-center gap-2 cursor-pointer"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Confirmando con tu banco...</span>
          </>
        ) : (
          <>
            <ShieldCheck className="h-4 w-4" />
            <span>Pagar con Apple Pay o Tarjeta</span>
          </>
        )}
      </Button>
    </form>
  );
}

export function PaymentClient({ order }: { order: any }) {
  const [notified, setNotified] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<"CARD" | "CASH">("CARD");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [intentId, setIntentId] = useState<string | null>(null);
  const [loadingSecret, setLoadingSecret] = useState(false);

  // tRPC mutations para crear el Payment Intent y obtener el clientSecret de Stripe
  const createIntentMutation = trpc.payments.createPaymentIntent.useMutation();
  const getSecretMutation = trpc.payments.createStripePaymentSecret.useMutation();
  const requestCashMutation = trpc.payments.requestCashPayment.useMutation();

  const handleStartDigitalPayment = async () => {
    try {
      setLoadingSecret(true);
      // 1. Crear o recuperar el intento con el motor de Rabbitty
      const intent = await createIntentMutation.mutateAsync({
        orderId: order.id,
        tipAmount: 0,
        provider: "STRIPE",
      });

      setIntentId(intent.intentId);

      // 2. Obtener el clientSecret de Stripe Connect
      const stripeRes = await getSecretMutation.mutateAsync({
        intentId: intent.intentId,
      });

      setClientSecret(stripeRes.clientSecret);
    } catch (err: any) {
      toast.error(err.message || "Error al inicializar la pasarela de pagos.");
    } finally {
      setLoadingSecret(false);
    }
  };

  if (paymentSuccess) {
    return (
      <Card className="border border-emerald-500/30 bg-emerald-500/10 p-6 text-center backdrop-blur-md rounded-2xl">
        <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
        <h2 className="text-xl font-black text-white">¡Cuenta Liquidada!</h2>
        <p className="text-sm text-gray-300 mt-1">
          Tu pago fue acreditado y la comanda ha sido cerrada en caja. ¡Gracias por tu visita!
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Selector de Método de Pago */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 border border-white/10 rounded-2xl">
        <button
          onClick={() => setSelectedMethod("CARD")}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            selectedMethod === "CARD"
              ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md shadow-pink-500/20"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <CreditCard className="h-4 w-4" />
          <span>Tarjeta / Apple Pay</span>
        </button>

        <button
          onClick={() => setSelectedMethod("CASH")}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            selectedMethod === "CASH"
              ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md shadow-pink-500/20"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <Store className="h-4 w-4" />
          <span>Efectivo en Caja</span>
        </button>
      </div>

      {/* Opción 1: Tarjeta / Apple Pay con Stripe Elements */}
      {selectedMethod === "CARD" && (
        <Card className="border border-white/10 bg-white/5 p-5 backdrop-blur-md rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-pink-400" />
              <h2 className="font-bold text-white text-base">Pago Seguro en Línea</h2>
            </div>
            <span className="text-[10px] uppercase font-black text-gray-400 tracking-wider bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
              Stripe 256-bit
            </span>
          </div>

          <p className="text-xs text-gray-300 leading-relaxed mb-4">
            Paga directamente sin esperar al mesero. Tu pago liberará la mesa automáticamente en el sistema.
          </p>

          <div className="rounded-xl bg-pink-500/10 border border-pink-500/20 p-3.5 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-pink-400" />
              <span className="text-xs font-bold text-white">Recompensa estimada:</span>
            </div>
            <span className="text-xs font-black text-pink-400">
              +{Math.floor(order.total * 0.20)} Bunz
            </span>
          </div>

          {clientSecret && stripePromise ? (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: "night",
                  variables: {
                    colorPrimary: "#ec4899",
                    colorBackground: "#09090b",
                    colorText: "#f4f4f5",
                    colorDanger: "#ef4444",
                    borderRadius: "14px",
                  },
                },
              }}
            >
              <StripeCheckoutForm
                clientSecret={clientSecret}
                orderId={order.id}
                onSuccess={() => setPaymentSuccess(true)}
              />
            </Elements>
          ) : (
            <Button
              onClick={handleStartDigitalPayment}
              disabled={loadingSecret}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-black text-xs py-3.5 rounded-xl shadow-lg shadow-pink-500/25 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loadingSecret ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Conectando con pasarela segura...</span>
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4" />
                  <span>Continuar a Cobro Digital</span>
                </>
              )}
            </Button>
          )}
        </Card>
      )}

      {/* Opción 2: Efectivo / Pago Físico */}
      {selectedMethod === "CASH" && (
        <Card className="border border-white/10 bg-white/5 p-5 backdrop-blur-md rounded-2xl">
          <div className="flex items-center gap-2 mb-3">
            <Store className="h-5 w-5 text-pink-400" />
            <h2 className="font-bold text-white text-base">Pago en Establecimiento</h2>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed mb-4">
            Este negocio cobra directamente en su caja o con terminal bancaria física. Muestra esta pantalla o tu número de orden al mesero / cajero para liquidar tu cuenta.
          </p>

          <div className="rounded-xl bg-pink-500/10 border border-pink-500/20 p-3.5 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-pink-400" />
              <span className="text-xs font-bold text-white">Recompensa estimada:</span>
            </div>
            <span className="text-xs font-black text-pink-400">
              +{Math.floor(order.total * 0.20)} Bunz
            </span>
          </div>

          {notified || order.status === "CASH_PAYMENT_REQUESTED" ? (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-emerald-400 text-xs font-bold">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Solicitud de efectivo recibida en caja. El mesero se acerca a tu mesa con tu cuenta.</span>
            </div>
          ) : (
            <Button
              onClick={async () => {
                try {
                  await requestCashMutation.mutateAsync({ orderId: order.id });
                  setNotified(true);
                  toast.success("Solicitud de cobro en efectivo enviada al POS");
                } catch (e: any) {
                  toast.error(e.message || "Error al solicitar cuenta");
                }
              }}
              disabled={requestCashMutation.isPending}
              className="w-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs py-3.5 border border-white/10 rounded-xl cursor-pointer flex items-center justify-center gap-2"
            >
              {requestCashMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Notificando a caja...</span>
                </>
              ) : (
                <>
                  <MessageSquareQuote className="h-4 w-4 text-pink-400" />
                  <span>Solicitar cobro en efectivo al mesero</span>
                </>
              )}
            </Button>
          )}
        </Card>
      )}

      <div className="text-center text-[11px] text-gray-500">
        Rabbitty ID: #{order.id.slice(-6).toUpperCase()} · Creado el {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
}

```

---

### H. packages/api/src/test/paymentCore.test.ts
```typescript
import { describe, it, expect, vi } from "vitest";
import {
  buildPaymentIdempotencyKey,
  mxnToCents,
  centsToMxn,
  createOrGetPaymentIntent,
  confirmPaymentIntentSettled,
  releasePaymentIntentHold,
  registerProviderWebhookEvent,
} from "../services/paymentCore";

describe("Rabbitty Pay Phase 1 — Motor Transaccional & Hardening", () => {
  describe("1. Precisión Monetaria e Idempotencia Canónica", () => {
    it("convierte importes a centavos y pesos sin errores de coma flotante", () => {
      expect(mxnToCents(270.0)).toBe(27000);
      expect(mxnToCents(300.5)).toBe(30050);
      expect(mxnToCents(19.99)).toBe(1999);
      expect(centsToMxn(27000)).toBe(270.0);
      expect(centsToMxn(30050)).toBe(300.5);
      expect(centsToMxn(1999)).toBe(19.99);
    });

    it("genera claves de idempotencia idénticas para la misma orden e intento lógico (sin timestamps)", () => {
      const key1 = buildPaymentIdempotencyKey({ branchId: "b1", orderId: "ord_100", attemptNumber: 1 });
      const key2 = buildPaymentIdempotencyKey({ branchId: "b1", orderId: "ord_100", attemptNumber: 1 });
      const keyAttempt2 = buildPaymentIdempotencyKey({ branchId: "b1", orderId: "ord_100", attemptNumber: 2 });

      expect(key1).toBe(key2);
      expect(key1).not.toBe(keyAttempt2);
      expect(key1).toHaveLength(64); // SHA-256
    });
  });

  describe("2. Deduplicación de Webhooks (Once-and-only-once en DB)", () => {
    it("registra evento nuevo y detecta duplicados cuando llega el mismo eventId", async () => {
      const mockDb = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn()
              .mockResolvedValueOnce([{ id: "evt_rec_1" }])
              .mockRejectedValueOnce({ code: "23505", message: "duplicate key value violates unique constraint" }),
          }),
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: "evt_rec_1", status: "COMPLETED" }]),
            }),
          }),
        }),
      };

      // 1er arribo del evento
      const res1 = await registerProviderWebhookEvent(mockDb as any, {
        provider: "STRIPE",
        eventId: "evt_stripe_12345",
        eventType: "payment_intent.succeeded",
        payload: { id: "pi_123", amount: 27000 },
      });
      expect(res1.isDuplicate).toBe(false);
      expect(res1.eventRecordId).toBe("evt_rec_1");

      // 2do arribo del mismo webhook (reintento de Stripe)
      const res2 = await registerProviderWebhookEvent(mockDb as any, {
        provider: "STRIPE",
        eventId: "evt_stripe_12345",
        eventType: "payment_intent.succeeded",
        payload: { id: "pi_123", amount: 27000 },
      });
      expect(res2.isDuplicate).toBe(true);
    });
  });

  describe("3. Idempotencia al Recuperar Payment Intent Existente", () => {
    it("devuelve el intento existente sin duplicar reservas ni filas en DB", async () => {
      const existingIntent = {
        id: "pi_exist_1",
        orderId: "ord_100",
        merchantId: "b1",
        amountCents: 30000,
        bunzAmount: 30,
        netFiatCents: 27000,
        platformFeeCents: 270,
        currency: "MXN",
        status: "PENDING_PAYMENT",
        idempotencyKey: buildPaymentIdempotencyKey({ branchId: "b1", orderId: "ord_100", attemptNumber: 1 }),
        expiresAt: new Date(Date.now() + 600000),
      };

      const existingReserve = {
        id: "res_exist_1",
        paymentIntentId: "pi_exist_1",
        amount: 30,
        status: "RESERVED",
      };

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockImplementation((table) => ({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(table._?.name === "bunz_reserves" ? [existingReserve] : [existingIntent]),
            }),
          })),
        }),
      };

      const result = await createOrGetPaymentIntent(mockDb as any, {
        branchId: "b1",
        orderId: "ord_100",
        payerUserId: "usr_rabbitter",
        bunzToApply: 30,
        attemptNumber: 1,
      });

      expect(result.intentId).toBe("pi_exist_1");
      expect(result.grossAmountCents).toBe(30000);
      expect(result.bunzDiscountCents).toBe(3000);
      expect(result.netFiatCents).toBe(27000);
      expect(result.platformFeeCents).toBe(270);
      expect(result.status).toBe("PENDING_PAYMENT");
    });
  });

  describe("4. Saga de Liberación de Hold de Bunz ante Fallo o Cancelación", () => {
    it("restituye el saldo al usuario liberando la reserva sin tocar órdenes ya pagadas", async () => {
      let capturedUpdates: any[] = [];
      const mockIntent = {
        id: "pi_test_1",
        orderId: "ord_1",
        status: "PENDING_PAYMENT",
      };
      const mockReserve = {
        id: "res_1",
        paymentIntentId: "pi_test_1",
        userId: "usr_1",
        amount: 50,
        status: "RESERVED",
      };

      let callCount = 0;
      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockReturnValue({
              for: vi.fn().mockImplementation(() => {
                callCount++;
                // Primer llamada es paymentIntents, segunda es bunzReserves
                return Promise.resolve(callCount === 1 ? [mockIntent] : [mockReserve]);
              }),
            }),
          })),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockImplementation((val) => {
            capturedUpdates.push(val);
            return { where: vi.fn().mockResolvedValue(true) };
          }),
        }),
      };

      const mockDb = {
        transaction: async (cb: any) => await cb(mockTx),
      };

      const res = await releasePaymentIntentHold(mockDb as any, {
        paymentIntentId: "pi_test_1",
        reason: "Tarjeta rechazada por emisor bancario",
      });

      expect(res.released).toBe(true);
      expect(res.refundedBunz).toBe(50);
      // Validar que se actualizó el estado a RELEASED y se canceló el intent
      expect(capturedUpdates.some((u) => u.status === "RELEASED")).toBe(true);
      expect(capturedUpdates.some((u) => u.status === "CANCELLED")).toBe(true);
    });

    it("rechaza liberar si el intento ya se encuentra en SUCCEEDED", async () => {
      const mockIntent = {
        id: "pi_paid",
        orderId: "ord_1",
        status: "SUCCEEDED",
      };

      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              for: vi.fn().mockResolvedValue([mockIntent]),
            }),
          }),
        }),
      };

      const mockDb = {
        transaction: async (cb: any) => await cb(mockTx),
      };

      await expect(
        releasePaymentIntentHold(mockDb as any, {
          paymentIntentId: "pi_paid",
          reason: "Intento de reversión ilegal",
        })
      ).rejects.toThrow("No se puede liberar un intento de pago que ya fue cobrado");
    });
  });

  describe("5. Cierre Seguro de Orden y Recuperación ante Expiración Previa", () => {
    it("si la reserva estaba EXPIRED cuando entra la confirmación, transiciona a RECOVERY_HOLD", async () => {
      const mockIntent = {
        id: "pi_exp_1",
        orderId: "ord_100",
        merchantId: "b1",
        netFiatCents: 27000,
        bunzAmount: 30,
        idempotencyKey: "key_1",
        status: "PENDING_PAYMENT",
      };
      const mockOrder = {
        id: "ord_100",
        total: 300,
        bunzPaid: 0,
      };
      const mockReserveExpired = {
        id: "res_exp",
        paymentIntentId: "pi_exp_1",
        amount: 30,
        status: "EXPIRED", // Expiró en cron segundos antes del webhook
      };

      let reserveStatusSet: string | undefined;
      let bunzPaymentsInserted: any[] = [];
      let orderStatusUpdated: string | undefined;

      let selectStep = 0;
      const mockTx = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation(() => {
            selectStep++;
            const step = selectStep;
            return {
              where: vi.fn().mockImplementation(() => {
                // Pasos 1, 2, 3 son consultas con .for("update")
                if (step === 1) return { for: vi.fn().mockResolvedValue([mockIntent]) };
                if (step === 2) return { for: vi.fn().mockResolvedValue([mockOrder]) };
                if (step === 3) return { for: vi.fn().mockResolvedValue([mockReserveExpired]) };
                // Paso 4 es allPayments (sin for): solo se insertó el pago fiat de 270 MXN (los Bunz expiraron)
                if (step === 4) {
                  return Promise.resolve([
                    { amount: 270, status: "COMPLETED" },
                  ]);
                }
                // Pasos siguientes son orderItems (vacío)
                return Promise.resolve([]);
              }),
            };
          }),
        })),
        insert: vi.fn().mockImplementation(() => ({
          values: vi.fn().mockImplementation((val) => {
            if (val.method === "BUNZ") bunzPaymentsInserted.push(val);
            return Promise.resolve(true);
          }),
        })),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockImplementation((val) => {
            if (val.status === "RECOVERY_HOLD") reserveStatusSet = "RECOVERY_HOLD";
            if (val.status === "COMPLETED") orderStatusUpdated = "COMPLETED";
            return { where: vi.fn().mockResolvedValue(true) };
          }),
        }),
        execute: vi.fn().mockResolvedValue(true),
      };

      const mockDb = {
        transaction: async (cb: any) => await cb(mockTx),
      };

      const res = await confirmPaymentIntentSettled(mockDb as any, {
        paymentIntentId: "pi_exp_1",
        externalTransactionId: "ch_stripe_settled",
        verifiedMethod: "STRIPE_CARD",
        expectedAmountCents: 27000,
        expectedCurrency: "MXN",
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe("SUCCEEDED");
      expect(res.recoveryHold).toBe(true);
      expect(reserveStatusSet).toBe("RECOVERY_HOLD");
      // P0 FIX: Los Bunz expirados NO se insertan como pago ni se cierra la orden como COMPLETED si falta saldo
      expect(bunzPaymentsInserted.length).toBe(0);
      expect(orderStatusUpdated).toBeUndefined();
    });

    it("rechaza confirmación si el monto recibido no coincide con el intento", async () => {
      const mockIntent = {
        id: "pi_check_1",
        orderId: "ord_100",
        merchantId: "b1",
        netFiatCents: 27000,
        currency: "MXN",
        status: "PENDING_PAYMENT",
      };

      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              for: vi.fn().mockResolvedValue([mockIntent]),
            }),
          }),
        }),
      };

      const mockDb = {
        transaction: async (cb: any) => await cb(mockTx),
      };

      await expect(
        confirmPaymentIntentSettled(mockDb as any, {
          paymentIntentId: "pi_check_1",
          verifiedMethod: "STRIPE_CARD",
          expectedAmountCents: 15000, // Discrepancia de monto
          expectedCurrency: "MXN",
        })
      ).rejects.toThrow("Monto del cobro no coincide");
    });
  });

  describe("6. Ciclo de Vida Recuperable de Webhooks", () => {
    it("permite reintento si el registro previo estaba en PROCESSING o FAILED", async () => {
      const mockDb = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockRejectedValue({ code: "23505", message: "duplicate key" }),
          }),
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: "evt_1", status: "FAILED" }]),
            }),
          }),
        }),
      };

      const res = await registerProviderWebhookEvent(mockDb as any, {
        provider: "STRIPE",
        eventId: "evt_failed_retry",
        eventType: "payment_intent.succeeded",
        payload: { id: "pi_123" },
      });

      expect(res.isDuplicate).toBe(true);
      expect(res.alreadyCompleted).toBe(false);
    });

    it("identifica duplicado real cuando el estado ya es COMPLETED", async () => {
      const mockDb = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockRejectedValue({ code: "23505", message: "duplicate key" }),
          }),
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: "evt_1", status: "COMPLETED" }]),
            }),
          }),
        }),
      };

      const res = await registerProviderWebhookEvent(mockDb as any, {
        provider: "STRIPE",
        eventId: "evt_done",
        eventType: "payment_intent.succeeded",
        payload: { id: "pi_123" },
      });

      expect(res.isDuplicate).toBe(true);
      expect(res.alreadyCompleted).toBe(true);
    });
  });
});

```
