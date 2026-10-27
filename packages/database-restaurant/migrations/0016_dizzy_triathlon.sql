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