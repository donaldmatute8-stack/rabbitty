ALTER TABLE "menu_item_ingredients" ALTER COLUMN "inventoryItemId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_item_ingredients" ADD COLUMN "subRecipeId" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "voidReason" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "voidedAt" timestamp;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "authorizedById" text;--> statement-breakpoint
ALTER TABLE "menu_item_ingredients" ADD CONSTRAINT "menu_item_ingredients_subRecipeId_menu_items_id_fk" FOREIGN KEY ("subRecipeId") REFERENCES "public"."menu_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_authorizedById_staff_id_fk" FOREIGN KEY ("authorizedById") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item_ingredients" ADD CONSTRAINT "menu_item_ingredients_at_least_one_check" CHECK ("menu_item_ingredients"."inventoryItemId" IS NOT NULL OR "menu_item_ingredients"."subRecipeId" IS NOT NULL);