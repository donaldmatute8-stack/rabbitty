CREATE TABLE "entitlement_usages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entitlementId" uuid NOT NULL,
	"subscriptionId" uuid NOT NULL,
	"branchId" text NOT NULL,
	"staffId" text,
	"orderId" text,
	"quantityUsed" integer DEFAULT 1 NOT NULL,
	"idempotencyKey" text NOT NULL,
	"redeemedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "entitlement_usages_idempotencyKey_unique" UNIQUE("idempotencyKey")
);
--> statement-breakpoint
CREATE TABLE "membership_entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscriptionId" uuid NOT NULL,
	"benefitType" text NOT NULL,
	"targetRefId" text,
	"quotaPerCycle" integer NOT NULL,
	"cycleResetType" text NOT NULL,
	"currentUsageInCycle" integer DEFAULT 0 NOT NULL,
	"cycleStartDate" timestamp NOT NULL,
	"cycleEndDate" timestamp NOT NULL,
	"discountPct" real,
	"creditBalance" real,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "membership_nft_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscriptionId" uuid NOT NULL,
	"network" text,
	"contractAddress" text,
	"tokenId" text,
	"walletAddress" text,
	"mintStatus" text DEFAULT 'NOT_STARTED' NOT NULL,
	"txHash" text,
	"metadataUri" text,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "membership_plan_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planId" uuid NOT NULL,
	"versionNumber" integer NOT NULL,
	"priceFiat" real NOT NULL,
	"currency" text DEFAULT 'MXN' NOT NULL,
	"billingInterval" text NOT NULL,
	"benefitRules" jsonb NOT NULL,
	"branchesAllowed" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"maxMembersLimit" integer,
	"isPublished" boolean DEFAULT false NOT NULL,
	"stripeProductId" text,
	"stripePriceId" text,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "membership_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"businessId" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"coverImageUrl" text,
	"badgeColor" text DEFAULT '#E91E63' NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"currentVersionId" uuid,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "membership_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"businessId" uuid NOT NULL,
	"planVersionId" uuid NOT NULL,
	"status" text NOT NULL,
	"currentPeriodStart" timestamp NOT NULL,
	"currentPeriodEnd" timestamp NOT NULL,
	"cancelAtPeriodEnd" boolean DEFAULT false NOT NULL,
	"paymentProvider" text NOT NULL,
	"paymentProviderSubId" text,
	"qrPassSecret" text NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "ownedBusinesses" ADD COLUMN "scanCode" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "scanCode" integer;--> statement-breakpoint
ALTER TABLE "entitlement_usages" ADD CONSTRAINT "entitlement_usages_entitlementId_membership_entitlements_id_fk" FOREIGN KEY ("entitlementId") REFERENCES "public"."membership_entitlements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlement_usages" ADD CONSTRAINT "entitlement_usages_subscriptionId_membership_subscriptions_id_fk" FOREIGN KEY ("subscriptionId") REFERENCES "public"."membership_subscriptions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_entitlements" ADD CONSTRAINT "membership_entitlements_subscriptionId_membership_subscriptions_id_fk" FOREIGN KEY ("subscriptionId") REFERENCES "public"."membership_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_nft_credentials" ADD CONSTRAINT "membership_nft_credentials_subscriptionId_membership_subscriptions_id_fk" FOREIGN KEY ("subscriptionId") REFERENCES "public"."membership_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_plan_versions" ADD CONSTRAINT "membership_plan_versions_planId_membership_plans_id_fk" FOREIGN KEY ("planId") REFERENCES "public"."membership_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_plans" ADD CONSTRAINT "membership_plans_businessId_ownedBusinesses_id_fk" FOREIGN KEY ("businessId") REFERENCES "public"."ownedBusinesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_subscriptions" ADD CONSTRAINT "membership_subscriptions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_subscriptions" ADD CONSTRAINT "membership_subscriptions_businessId_ownedBusinesses_id_fk" FOREIGN KEY ("businessId") REFERENCES "public"."ownedBusinesses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_subscriptions" ADD CONSTRAINT "membership_subscriptions_planVersionId_membership_plan_versions_id_fk" FOREIGN KEY ("planVersionId") REFERENCES "public"."membership_plan_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownedBusinesses" ADD CONSTRAINT "ownedBusinesses_scanCode_unique" UNIQUE("scanCode");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_scanCode_unique" UNIQUE("scanCode");