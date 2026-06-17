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
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_branchId_branches_id_fk" FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_orderId_orders_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
