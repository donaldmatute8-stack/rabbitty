CREATE TABLE "systemSettings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "treasury" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"concept" text NOT NULL,
	"amount" integer NOT NULL,
	"type" text NOT NULL,
	"referenceId" text,
	"notes" text,
	"createdAt" timestamp DEFAULT now()
);
