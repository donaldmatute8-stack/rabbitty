ALTER TABLE "campaigns" ADD COLUMN "deliveredCount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "failedCount" integer DEFAULT 0 NOT NULL;