CREATE TABLE IF NOT EXISTS "notifications_outbox" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"route" text,
	"data" jsonb,
	"dedupeKey" text UNIQUE,
	"priority" text DEFAULT 'normal' NOT NULL,
	"status" text DEFAULT 'QUEUED' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"runAfter" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notificationDeliveries" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notificationId" text NOT NULL,
	"deviceId" text,
	"channel" text NOT NULL,
	"status" text NOT NULL,
	"reason" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	CREATE UNIQUE INDEX "notifications_outbox_dedupeKey_unique" ON "notifications_outbox" ("dedupeKey");
EXCEPTION WHEN others THEN NULL; END $$;
