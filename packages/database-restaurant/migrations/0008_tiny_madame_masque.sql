CREATE TABLE "campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"branchId" text NOT NULL,
	"name" text NOT NULL,
	"targetSegment" text NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"sentAt" timestamp,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "catering_events" (
	"id" text PRIMARY KEY NOT NULL,
	"branchId" text NOT NULL,
	"eventName" text NOT NULL,
	"eventDate" timestamp NOT NULL,
	"partySize" integer DEFAULT 1 NOT NULL,
	"customerName" text NOT NULL,
	"customerPhone" text,
	"customerEmail" text,
	"menuDetails" jsonb,
	"deposit" real DEFAULT 0 NOT NULL,
	"totalAmount" real DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"notes" text,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"restaurantId" text NOT NULL,
	"phone" text NOT NULL,
	"name" text,
	"totalVisits" integer DEFAULT 0 NOT NULL,
	"totalSpent" real DEFAULT 0 NOT NULL,
	"lastVisitAt" timestamp,
	"birthDate" timestamp,
	"segment" text DEFAULT 'NEW' NOT NULL,
	"marketingConsent" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dynamic_pricing_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"branchId" text NOT NULL,
	"menuItemId" text,
	"name" text NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"dayOfWeek" integer,
	"startTime" text,
	"endTime" text,
	"adjustmentType" text DEFAULT 'PERCENTAGE' NOT NULL,
	"adjustmentValue" real DEFAULT 0 NOT NULL,
	"minPrice" real,
	"maxPrice" real,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"branchId" text NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"amount" real NOT NULL,
	"expenseDate" timestamp DEFAULT now() NOT NULL,
	"reference" text,
	"paidTo" text,
	"notes" text,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"branchId" text NOT NULL,
	"orderId" text NOT NULL,
	"billingProfileId" text NOT NULL,
	"rfc" text NOT NULL,
	"legalName" text NOT NULL,
	"taxRegime" text NOT NULL,
	"cfdiUse" text NOT NULL,
	"zipCode" text NOT NULL,
	"billableAmount" real NOT NULL,
	"tax" real DEFAULT 0 NOT NULL,
	"total" real NOT NULL,
	"status" text DEFAULT 'INVOICED' NOT NULL,
	"uuid" text,
	"pdfUrl" text,
	"xmlUrl" text,
	"cancelledAt" timestamp,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "menu_item_ingredients" (
	"id" text PRIMARY KEY NOT NULL,
	"menuItemId" text NOT NULL,
	"inventoryItemId" text NOT NULL,
	"quantityRequired" real NOT NULL,
	"unit" text DEFAULT 'pz' NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "purchase_order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"purchaseOrderId" text NOT NULL,
	"inventoryItemId" text NOT NULL,
	"quantity" real NOT NULL,
	"unitCost" real DEFAULT 0 NOT NULL,
	"totalCost" real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"branchId" text NOT NULL,
	"supplierId" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"total" real DEFAULT 0 NOT NULL,
	"notes" text,
	"orderedAt" timestamp DEFAULT now(),
	"receivedAt" timestamp,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" text PRIMARY KEY NOT NULL,
	"branchId" text NOT NULL,
	"name" text NOT NULL,
	"contactName" text,
	"phone" text,
	"email" text,
	"address" text,
	"notes" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "waitlist_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"branchId" text NOT NULL,
	"customerName" text NOT NULL,
	"customerPhone" text NOT NULL,
	"partySize" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'WAITING' NOT NULL,
	"notes" text,
	"estimatedWaitMinutes" integer,
	"notifiedViaTelegram" boolean DEFAULT false,
	"notifiedAt" timestamp,
	"tableId" text,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "menu_categories" ADD COLUMN "printerZone" text DEFAULT 'MAIN' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cfdiStatus" text DEFAULT 'NONE' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cfdiUrl" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "happyHourStart" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "happyHourEnd" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "happyHourRewardRate" integer;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_branchId_branches_id_fk" FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catering_events" ADD CONSTRAINT "catering_events_branchId_branches_id_fk" FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_restaurantId_restaurants_id_fk" FOREIGN KEY ("restaurantId") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dynamic_pricing_rules" ADD CONSTRAINT "dynamic_pricing_rules_branchId_branches_id_fk" FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dynamic_pricing_rules" ADD CONSTRAINT "dynamic_pricing_rules_menuItemId_menu_items_id_fk" FOREIGN KEY ("menuItemId") REFERENCES "public"."menu_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_branchId_branches_id_fk" FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_branchId_branches_id_fk" FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_orderId_orders_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item_ingredients" ADD CONSTRAINT "menu_item_ingredients_menuItemId_menu_items_id_fk" FOREIGN KEY ("menuItemId") REFERENCES "public"."menu_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item_ingredients" ADD CONSTRAINT "menu_item_ingredients_inventoryItemId_inventory_items_id_fk" FOREIGN KEY ("inventoryItemId") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchaseOrderId_purchase_orders_id_fk" FOREIGN KEY ("purchaseOrderId") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_inventoryItemId_inventory_items_id_fk" FOREIGN KEY ("inventoryItemId") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_branchId_branches_id_fk" FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplierId_suppliers_id_fk" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_branchId_branches_id_fk" FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_branchId_branches_id_fk" FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_tableId_tables_id_fk" FOREIGN KEY ("tableId") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;