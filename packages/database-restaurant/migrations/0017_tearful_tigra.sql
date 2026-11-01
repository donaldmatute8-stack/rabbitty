ALTER TABLE "payment_provider_events" ADD COLUMN "status" text DEFAULT 'PROCESSING' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_provider_events" ADD COLUMN "errorMessage" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "usdRateMode" text DEFAULT 'AUTO' NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "usdRate" real;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "usdRateUpdatedAt" timestamp;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "staleOrderHours" integer DEFAULT 12 NOT NULL;