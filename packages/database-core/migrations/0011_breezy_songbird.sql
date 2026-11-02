CREATE TABLE "behaviorRules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"businessId" text NOT NULL,
	"name" text NOT NULL,
	"triggerType" text NOT NULL,
	"triggerParams" jsonb NOT NULL,
	"action" jsonb NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"budgetBunz" integer DEFAULT 0 NOT NULL,
	"budgetSpent" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "presenceSessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"businessId" text NOT NULL,
	"source" text DEFAULT 'gps' NOT NULL,
	"startedAt" timestamp NOT NULL,
	"lastPingAt" timestamp NOT NULL,
	"endedAt" timestamp,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reconciliationRequests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"orderId" text NOT NULL,
	"userId" text NOT NULL,
	"businessId" text NOT NULL,
	"branchId" text,
	"expectedBunz" integer NOT NULL,
	"creditedBunz" integer DEFAULT 0 NOT NULL,
	"pendingBunz" integer DEFAULT 0 NOT NULL,
	"claimedBunz" integer NOT NULL,
	"rewardRuleRef" text,
	"note" text NOT NULL,
	"evidenceUrl" text,
	"status" text DEFAULT 'PENDING_AFFILIATE' NOT NULL,
	"affiliateNote" text,
	"affiliateUserId" text,
	"godNote" text,
	"godUserId" text,
	"ledgerEntryId" text,
	"idempotencyKey" text NOT NULL,
	"deliveryAttempts" integer DEFAULT 0 NOT NULL,
	"affiliateRespondedAt" timestamp,
	"godResolvedAt" timestamp,
	"deliveredAt" timestamp,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now(),
	CONSTRAINT "reconciliationRequests_orderId_unique" UNIQUE("orderId")
);
--> statement-breakpoint
ALTER TABLE "membership_subscriptions" ALTER COLUMN "currentPeriodEnd" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "membership_subscriptions" ALTER COLUMN "paymentProvider" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "membership_subscriptions" ADD COLUMN "noExpiration" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "membership_subscriptions" ADD COLUMN "membershipOrigin" text;--> statement-breakpoint
ALTER TABLE "membership_subscriptions" ADD COLUMN "issuedByUserId" text;--> statement-breakpoint
ALTER TABLE "membership_subscriptions" ADD COLUMN "giftNote" text;--> statement-breakpoint
ALTER TABLE "membership_subscriptions" ADD COLUMN "revokedAt" timestamp;--> statement-breakpoint
ALTER TABLE "membership_subscriptions" ADD COLUMN "revokedByUserId" text;--> statement-breakpoint
ALTER TABLE "membership_subscriptions" ADD COLUMN "revocationReason" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "route" text;