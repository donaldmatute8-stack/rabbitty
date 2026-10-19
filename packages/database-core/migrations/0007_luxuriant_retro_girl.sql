CREATE TABLE "atmosphereInterventions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"businessId" text NOT NULL,
	"recipeType" text NOT NULL,
	"staffId" text,
	"soundtrackApplied" text,
	"lightingApplied" text,
	"roomAction" text,
	"notes" text,
	"executedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moodCampaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"businessId" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"targetMood" text NOT NULL,
	"rewardBunz" integer DEFAULT 0 NOT NULL,
	"startHour" integer DEFAULT 0 NOT NULL,
	"endHour" integer DEFAULT 23 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "moodEvents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text,
	"businessId" text,
	"mood" text NOT NULL,
	"source" text DEFAULT 'checkin' NOT NULL,
	"rating" integer,
	"feedbackNote" text,
	"metadata" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vibePassportStamps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"routeId" text NOT NULL,
	"stopOrder" integer NOT NULL,
	"businessId" text,
	"vibe" text NOT NULL,
	"transactionId" text,
	"stampedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ownedBusinesses" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "atmosphereInterventions" ADD CONSTRAINT "atmosphereInterventions_businessId_ownedBusinesses_id_fk" FOREIGN KEY ("businessId") REFERENCES "public"."ownedBusinesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moodCampaigns" ADD CONSTRAINT "moodCampaigns_businessId_ownedBusinesses_id_fk" FOREIGN KEY ("businessId") REFERENCES "public"."ownedBusinesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moodEvents" ADD CONSTRAINT "moodEvents_businessId_ownedBusinesses_id_fk" FOREIGN KEY ("businessId") REFERENCES "public"."ownedBusinesses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vibePassportStamps" ADD CONSTRAINT "vibePassportStamps_businessId_ownedBusinesses_id_fk" FOREIGN KEY ("businessId") REFERENCES "public"."ownedBusinesses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownedBusinesses" ADD CONSTRAINT "ownedBusinesses_slug_unique" UNIQUE("slug");