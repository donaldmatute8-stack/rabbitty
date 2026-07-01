ALTER TABLE "passkeys" ALTER COLUMN "userId" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "trustedSessions" ALTER COLUMN "userId" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "ownedBusinesses" ADD COLUMN "package" text;--> statement-breakpoint
ALTER TABLE "ownedBusinesses" ADD COLUMN "creditLimit" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ownedBusinesses" ADD COLUMN "creditUsed" integer DEFAULT 0 NOT NULL;