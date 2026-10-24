CREATE TABLE "affiliateCampaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"businessId" text NOT NULL,
	"createdBy" text NOT NULL,
	"approvedBy" text,
	"title" text NOT NULL,
	"headline" text NOT NULL,
	"message" text NOT NULL,
	"campaignType" text NOT NULL,
	"targetSegment" text NOT NULL,
	"rewardPercentage" integer NOT NULL,
	"maxRewardPerUser" integer DEFAULT 50 NOT NULL,
	"budgetBunz" integer NOT NULL,
	"budgetSpent" integer DEFAULT 0 NOT NULL,
	"redemptionCount" integer DEFAULT 0 NOT NULL,
	"startsAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"approvedAt" timestamp,
	"metadata" jsonb,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "businessLearningInsights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"businessId" text NOT NULL,
	"insightType" text NOT NULL,
	"periodAnalyzed" text NOT NULL,
	"sampleSize" integer NOT NULL,
	"confidenceScore" real NOT NULL,
	"recommendation" text NOT NULL,
	"metricsBasis" jsonb NOT NULL,
	"calculatedAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaignRedemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaignId" uuid NOT NULL,
	"userId" text NOT NULL,
	"businessId" text NOT NULL,
	"transactionId" text,
	"bunzAwarded" integer NOT NULL,
	"fiatSpent" real DEFAULT 0 NOT NULL,
	"idempotencyKey" text NOT NULL,
	"redeemedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "campaignRedemptions_idempotencyKey_unique" UNIQUE("idempotencyKey")
);
--> statement-breakpoint
CREATE TABLE "knowledgeChunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"businessId" text,
	"scope" text NOT NULL,
	"sourceType" text NOT NULL,
	"sourceId" text NOT NULL,
	"content" text NOT NULL,
	"contentHash" text NOT NULL,
	"embedding" vector(1536),
	"embeddingModel" text DEFAULT 'text-embedding-3-small' NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memoryCandidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text,
	"businessId" text,
	"rawInput" text NOT NULL,
	"extractedKey" text NOT NULL,
	"extractedValue" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "userMemories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"confidenceScore" real DEFAULT 1 NOT NULL,
	"source" text DEFAULT 'EXPLICIT_USER_INPUT' NOT NULL,
	"expiresAt" timestamp,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "ownedBusinesses" ADD COLUMN "hops" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ownedBusinesses" ADD COLUMN "savedCount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ownedBusinesses" ADD COLUMN "sharedCount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "twoFactorMethods" text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "affiliateCampaigns" ADD CONSTRAINT "affiliateCampaigns_businessId_ownedBusinesses_id_fk" FOREIGN KEY ("businessId") REFERENCES "public"."ownedBusinesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliateCampaigns" ADD CONSTRAINT "affiliateCampaigns_createdBy_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliateCampaigns" ADD CONSTRAINT "affiliateCampaigns_approvedBy_users_id_fk" FOREIGN KEY ("approvedBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "businessLearningInsights" ADD CONSTRAINT "businessLearningInsights_businessId_ownedBusinesses_id_fk" FOREIGN KEY ("businessId") REFERENCES "public"."ownedBusinesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaignRedemptions" ADD CONSTRAINT "campaignRedemptions_campaignId_affiliateCampaigns_id_fk" FOREIGN KEY ("campaignId") REFERENCES "public"."affiliateCampaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaignRedemptions" ADD CONSTRAINT "campaignRedemptions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaignRedemptions" ADD CONSTRAINT "campaignRedemptions_businessId_ownedBusinesses_id_fk" FOREIGN KEY ("businessId") REFERENCES "public"."ownedBusinesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledgeChunks" ADD CONSTRAINT "knowledgeChunks_businessId_ownedBusinesses_id_fk" FOREIGN KEY ("businessId") REFERENCES "public"."ownedBusinesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memoryCandidates" ADD CONSTRAINT "memoryCandidates_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memoryCandidates" ADD CONSTRAINT "memoryCandidates_businessId_ownedBusinesses_id_fk" FOREIGN KEY ("businessId") REFERENCES "public"."ownedBusinesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "userMemories" ADD CONSTRAINT "userMemories_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_tx_redemption_idx" ON "campaignRedemptions" USING btree ("campaignId","transactionId");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_chunks_source_uidx" ON "knowledgeChunks" USING btree ("sourceType","sourceId");--> statement-breakpoint
CREATE UNIQUE INDEX "user_memories_user_key_uidx" ON "userMemories" USING btree ("userId","key");