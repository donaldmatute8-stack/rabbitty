CREATE TABLE "cash_drops" (
	"id" text PRIMARY KEY NOT NULL,
	"branchId" text NOT NULL,
	"staffId" text,
	"amount" real NOT NULL,
	"notes" text,
	"createdAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_intents" (
	"id" text PRIMARY KEY NOT NULL,
	"orderId" text NOT NULL,
	"merchantId" text NOT NULL,
	"amountMxn" real NOT NULL,
	"bunzAmount" real NOT NULL,
	"status" text DEFAULT 'PENDING_PAYMENT' NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "cashDropEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "cashDropThreshold" real DEFAULT 3000 NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "verificationMethod" text DEFAULT 'CASHIER_CONFIRMED' NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "legalName" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "rfc" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "taxRegime" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "logoUrl" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "ticketFooter" text;--> statement-breakpoint
ALTER TABLE "cash_drops" ADD CONSTRAINT "cash_drops_branchId_branches_id_fk" FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_drops" ADD CONSTRAINT "cash_drops_staffId_staff_id_fk" FOREIGN KEY ("staffId") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_orderId_orders_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_merchantId_branches_id_fk" FOREIGN KEY ("merchantId") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;