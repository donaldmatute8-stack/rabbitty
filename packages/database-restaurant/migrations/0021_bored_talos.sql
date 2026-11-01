ALTER TABLE "payment_intents" ADD COLUMN "tipMxn" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "tipAmount" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "tipPayoutEnabled" boolean DEFAULT false NOT NULL;