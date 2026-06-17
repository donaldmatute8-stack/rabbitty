CREATE TABLE "catering_events" (
	"id" text PRIMARY KEY NOT NULL,
	"branchId" text NOT NULL,
	"eventName" text NOT NULL,
	"eventDate" timestamp NOT NULL,
	"partySize" integer DEFAULT 1 NOT NULL,
	"customerName" text NOT NULL,
	"customerPhone" text,
	"customerEmail" text,
	"menuDetails" jsonb,
	"deposit" real DEFAULT 0 NOT NULL,
	"totalAmount" real DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"notes" text,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "catering_events" ADD CONSTRAINT "catering_events_branchId_branches_id_fk" FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;
