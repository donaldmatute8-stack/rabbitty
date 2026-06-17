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
ALTER TABLE "dynamic_pricing_rules" ADD CONSTRAINT "dynamic_pricing_rules_branchId_branches_id_fk" FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dynamic_pricing_rules" ADD CONSTRAINT "dynamic_pricing_rules_menuItemId_menu_items_id_fk" FOREIGN KEY ("menuItemId") REFERENCES "public"."menu_items"("id") ON DELETE no action ON UPDATE no action;
