CREATE TABLE "auditEntries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text,
	"action" text NOT NULL,
	"resource" text NOT NULL,
	"resourceId" text,
	"details" text,
	"ipAddress" text,
	"createdAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "billingProfiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"rfc" text NOT NULL,
	"legalName" text NOT NULL,
	"taxRegime" text NOT NULL,
	"zipCode" text NOT NULL,
	"cfdiUse" text DEFAULT 'G03' NOT NULL,
	"email" text NOT NULL,
	"isDefault" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "ownedBusinesses" ADD COLUMN "bunzBalance" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "pendingDebtBunz" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "billingProfiles" ADD CONSTRAINT "billingProfiles_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;