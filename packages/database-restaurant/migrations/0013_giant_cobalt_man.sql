CREATE TABLE "distribution_allocations" (
	"id" text PRIMARY KEY NOT NULL,
	"paymentIntentId" text,
	"orderId" text,
	"branchId" text NOT NULL,
	"ruleId" text NOT NULL,
	"destinationId" text NOT NULL,
	"amountMxn" real NOT NULL,
	"status" text DEFAULT 'ALLOCATED' NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "distribution_destinations" (
	"id" text PRIMARY KEY NOT NULL,
	"branchId" text,
	"name" text NOT NULL,
	"type" text DEFAULT 'FOUNDATION' NOT NULL,
	"accountIdentifier" text,
	"description" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "distribution_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"branchId" text NOT NULL,
	"destinationId" text NOT NULL,
	"name" text NOT NULL,
	"allocationType" text DEFAULT 'PERCENTAGE' NOT NULL,
	"allocationValue" real NOT NULL,
	"triggerEvent" text DEFAULT 'PAYMENT_SETTLED' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"branchId" text,
	"payerSubjectId" text NOT NULL,
	"payeeSubjectId" text NOT NULL,
	"amount" real NOT NULL,
	"currency" text DEFAULT 'BUNZ' NOT NULL,
	"type" text NOT NULL,
	"referenceId" text,
	"idempotencyKey" text NOT NULL,
	"metadata" jsonb,
	"createdAt" timestamp DEFAULT now(),
	CONSTRAINT "ledger_entries_idempotencyKey_unique" UNIQUE("idempotencyKey")
);
--> statement-breakpoint
CREATE TABLE "settlement_operations" (
	"id" text PRIMARY KEY NOT NULL,
	"allocationId" text,
	"ledgerEntryId" text,
	"destinationId" text NOT NULL,
	"amount" real NOT NULL,
	"currency" text DEFAULT 'MXN' NOT NULL,
	"provider" text DEFAULT 'INTERNAL' NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"txHash" text,
	"failureReason" text,
	"retryCount" integer DEFAULT 0 NOT NULL,
	"settledAt" timestamp,
	"createdAt" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "payment_intents" ALTER COLUMN "orderId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD COLUMN "creatorSubjectId" text;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD COLUMN "payerSubjectId" text;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD COLUMN "currency" text DEFAULT 'MXN' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD COLUMN "idempotencyKey" text;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD COLUMN "paidAt" timestamp;--> statement-breakpoint
ALTER TABLE "distribution_allocations" ADD CONSTRAINT "distribution_allocations_paymentIntentId_payment_intents_id_fk" FOREIGN KEY ("paymentIntentId") REFERENCES "public"."payment_intents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distribution_allocations" ADD CONSTRAINT "distribution_allocations_orderId_orders_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distribution_allocations" ADD CONSTRAINT "distribution_allocations_branchId_branches_id_fk" FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distribution_allocations" ADD CONSTRAINT "distribution_allocations_ruleId_distribution_rules_id_fk" FOREIGN KEY ("ruleId") REFERENCES "public"."distribution_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distribution_allocations" ADD CONSTRAINT "distribution_allocations_destinationId_distribution_destinations_id_fk" FOREIGN KEY ("destinationId") REFERENCES "public"."distribution_destinations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distribution_destinations" ADD CONSTRAINT "distribution_destinations_branchId_branches_id_fk" FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distribution_rules" ADD CONSTRAINT "distribution_rules_branchId_branches_id_fk" FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distribution_rules" ADD CONSTRAINT "distribution_rules_destinationId_distribution_destinations_id_fk" FOREIGN KEY ("destinationId") REFERENCES "public"."distribution_destinations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_branchId_branches_id_fk" FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_operations" ADD CONSTRAINT "settlement_operations_allocationId_distribution_allocations_id_fk" FOREIGN KEY ("allocationId") REFERENCES "public"."distribution_allocations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_operations" ADD CONSTRAINT "settlement_operations_ledgerEntryId_ledger_entries_id_fk" FOREIGN KEY ("ledgerEntryId") REFERENCES "public"."ledger_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_operations" ADD CONSTRAINT "settlement_operations_destinationId_distribution_destinations_id_fk" FOREIGN KEY ("destinationId") REFERENCES "public"."distribution_destinations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_idempotencyKey_unique" UNIQUE("idempotencyKey");