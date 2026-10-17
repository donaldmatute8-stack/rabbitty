CREATE TABLE IF NOT EXISTS "verificationTokens" (
	"identifier" text NOT NULL,
	"token" text PRIMARY KEY NOT NULL,
	"expires" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "passkeys" ALTER COLUMN "userId" SET DATA TYPE uuid;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "trustedSessions" ALTER COLUMN "userId" SET DATA TYPE uuid;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "telegramId" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "participant1TypingAt" timestamp;
--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "participant2TypingAt" timestamp;
--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "lastMessageAt" timestamp DEFAULT now();
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "type" text DEFAULT 'TEXT' NOT NULL;
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "metadata" jsonb;
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "readAt" timestamp;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE("username");
EXCEPTION WHEN OTHERS THEN NULL;
END $$;