import { pgTable, text, integer, real, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import crypto from "crypto";

function genId(): string {
  return crypto.randomUUID();
}

const id = () => text("id").primaryKey().$defaultFn(() => genId());
const fkId = (field: string) => text(field).notNull();
const fkIdOpt = (field: string) => text(field);
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
});

export const payments = pgTable("payments", {
  id: id(),
  orderId: fkId("orderId").references(() => orders.id),
  method: text("method").notNull(),
  amount: real("amount").notNull(),
  reference: text("reference"),
  status: text("status").default("COMPLETED").notNull(),
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
  inventoryItemId: fkId("inventoryItemId").references(() => inventoryItems.id),
  quantityRequired: real("quantityRequired").notNull(),
  unit: text("unit").default("pz").notNull(), // Allows custom units like 'pizca', 'gramos'
  isActive: boolean("isActive").default(true).notNull(),
  ...timestamps,
});

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
  ...timestamps,
});
