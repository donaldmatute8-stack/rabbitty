CREATE TABLE "branches" (
	"id" text PRIMARY KEY NOT NULL,
	"restaurantId" text NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"phone" text,
	"lat" real,
	"lng" real,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"branchId" text,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" text PRIMARY KEY NOT NULL,
	"branchId" text NOT NULL,
	"name" text NOT NULL,
	"sku" text,
	"unit" text DEFAULT 'pz' NOT NULL,
	"stock" real DEFAULT 0 NOT NULL,
	"minStock" real DEFAULT 0 NOT NULL,
	"costPerUnit" real DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"id" text PRIMARY KEY NOT NULL,
	"itemId" text NOT NULL,
	"branchId" text NOT NULL,
	"type" text NOT NULL,
	"quantity" real NOT NULL,
	"reference" text,
	"notes" text,
	"createdAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "menu_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"branchId" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "menu_item_modifiers" (
	"id" text PRIMARY KEY NOT NULL,
	"itemId" text NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'SELECT' NOT NULL,
	"priceAdjust" real DEFAULT 0 NOT NULL,
	"maxSelect" integer DEFAULT 1 NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" text PRIMARY KEY NOT NULL,
	"categoryId" text NOT NULL,
	"branchId" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" real NOT NULL,
	"cost" real DEFAULT 0,
	"imageUrl" text,
	"sku" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"isAvailable" boolean DEFAULT true NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"orderId" text NOT NULL,
	"menuItemId" text NOT NULL,
	"quantity" integer NOT NULL,
	"unitPrice" real NOT NULL,
	"totalPrice" real NOT NULL,
	"modifiers" jsonb,
	"notes" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"branchId" text NOT NULL,
	"tableId" text,
	"tableSessionId" text,
	"staffId" text,
	"customerId" text,
	"orderType" text DEFAULT 'DINE_IN' NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"subtotal" real NOT NULL,
	"tax" real DEFAULT 0 NOT NULL,
	"discount" real DEFAULT 0 NOT NULL,
	"tip" real DEFAULT 0 NOT NULL,
	"total" real NOT NULL,
	"bunzReward" integer DEFAULT 0,
	"bunzPaid" integer DEFAULT 0,
	"notes" text,
	"voidReason" text,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"orderId" text NOT NULL,
	"method" text NOT NULL,
	"amount" real NOT NULL,
	"reference" text,
	"status" text DEFAULT 'COMPLETED' NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "restaurants" (
	"id" text PRIMARY KEY NOT NULL,
	"businessId" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"currency" text DEFAULT 'MXN' NOT NULL,
	"taxRate" real DEFAULT 0.16 NOT NULL,
	"timezone" text DEFAULT 'America/Mexico_City' NOT NULL,
	"defaultRewardRate" integer DEFAULT 20 NOT NULL,
	"acceptsBunz" boolean DEFAULT true NOT NULL,
	"printerType" text,
	"printerConfig" jsonb,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now(),
	CONSTRAINT "restaurants_businessId_unique" UNIQUE("businessId"),
	CONSTRAINT "restaurants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"branchId" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'WAITER' NOT NULL,
	"pinCode" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "staff_shifts" (
	"id" text PRIMARY KEY NOT NULL,
	"staffId" text NOT NULL,
	"branchId" text NOT NULL,
	"checkIn" timestamp DEFAULT now() NOT NULL,
	"checkOut" timestamp,
	"status" text DEFAULT 'ACTIVE' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "table_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"tableId" text NOT NULL,
	"branchId" text NOT NULL,
	"staffId" text,
	"customerCount" integer DEFAULT 1,
	"customerId" text,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"openedAt" timestamp DEFAULT now() NOT NULL,
	"closedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "tables" (
	"id" text PRIMARY KEY NOT NULL,
	"branchId" text NOT NULL,
	"number" integer NOT NULL,
	"capacity" integer DEFAULT 4 NOT NULL,
	"location" text,
	"qrCode" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_restaurantId_restaurants_id_fk" FOREIGN KEY ("restaurantId") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_branchId_branches_id_fk" FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_branchId_branches_id_fk" FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_itemId_inventory_items_id_fk" FOREIGN KEY ("itemId") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_branchId_branches_id_fk" FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_categories" ADD CONSTRAINT "menu_categories_branchId_branches_id_fk" FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item_modifiers" ADD CONSTRAINT "menu_item_modifiers_itemId_menu_items_id_fk" FOREIGN KEY ("itemId") REFERENCES "public"."menu_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_categoryId_menu_categories_id_fk" FOREIGN KEY ("categoryId") REFERENCES "public"."menu_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_branchId_branches_id_fk" FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_orders_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_menuItemId_menu_items_id_fk" FOREIGN KEY ("menuItemId") REFERENCES "public"."menu_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_branchId_branches_id_fk" FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tableId_tables_id_fk" FOREIGN KEY ("tableId") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tableSessionId_table_sessions_id_fk" FOREIGN KEY ("tableSessionId") REFERENCES "public"."table_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_staffId_staff_id_fk" FOREIGN KEY ("staffId") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_orders_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_branchId_branches_id_fk" FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_shifts" ADD CONSTRAINT "staff_shifts_staffId_staff_id_fk" FOREIGN KEY ("staffId") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_shifts" ADD CONSTRAINT "staff_shifts_branchId_branches_id_fk" FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_sessions" ADD CONSTRAINT "table_sessions_tableId_tables_id_fk" FOREIGN KEY ("tableId") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_sessions" ADD CONSTRAINT "table_sessions_branchId_branches_id_fk" FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_sessions" ADD CONSTRAINT "table_sessions_staffId_staff_id_fk" FOREIGN KEY ("staffId") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_branchId_branches_id_fk" FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;