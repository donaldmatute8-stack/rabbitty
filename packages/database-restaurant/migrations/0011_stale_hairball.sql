CREATE TABLE "ai_strategies" (
	"id" text PRIMARY KEY NOT NULL,
	"branchId" text NOT NULL,
	"goal" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"memory" jsonb,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "ai_strategies" ADD CONSTRAINT "ai_strategies_branchId_branches_id_fk" FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;