CREATE TABLE "merchant_score_shadow" (
	"id" text PRIMARY KEY NOT NULL,
	"branchId" text NOT NULL,
	"score" real NOT NULL,
	"sampleN" integer NOT NULL,
	"coverage" real NOT NULL,
	"components" jsonb,
	"computedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderation_log" (
	"id" text PRIMARY KEY NOT NULL,
	"entityType" text NOT NULL,
	"entityId" text NOT NULL,
	"action" text NOT NULL,
	"actorUserId" text NOT NULL,
	"reason" text NOT NULL,
	"previousState" text,
	"newState" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_rating_events" (
	"id" text PRIMARY KEY NOT NULL,
	"ratingId" text NOT NULL,
	"eventType" text NOT NULL,
	"actorUserId" text,
	"actorRole" text,
	"previousStars" integer,
	"newStars" integer,
	"previousComment" text,
	"newComment" text,
	"reason" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_ratings" (
	"id" text PRIMARY KEY NOT NULL,
	"orderId" text NOT NULL,
	"branchId" text NOT NULL,
	"customerUserId" text NOT NULL,
	"stars" integer NOT NULL,
	"attributes" jsonb,
	"comment" text,
	"isEligible" boolean DEFAULT true NOT NULL,
	"ineligibleReason" text,
	"moderationStatus" text DEFAULT 'VISIBLE' NOT NULL,
	"reviewFlag" boolean DEFAULT false NOT NULL,
	"editedAt" timestamp,
	"reportedAt" timestamp,
	"reportedBy" text,
	"reportReason" text,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now(),
	CONSTRAINT "order_ratings_orderId_unique" UNIQUE("orderId")
);
--> statement-breakpoint
ALTER TABLE "merchant_score_shadow" ADD CONSTRAINT "merchant_score_shadow_branchId_branches_id_fk" FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_rating_events" ADD CONSTRAINT "order_rating_events_ratingId_order_ratings_id_fk" FOREIGN KEY ("ratingId") REFERENCES "public"."order_ratings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_ratings" ADD CONSTRAINT "order_ratings_orderId_orders_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_ratings" ADD CONSTRAINT "order_ratings_branchId_branches_id_fk" FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;