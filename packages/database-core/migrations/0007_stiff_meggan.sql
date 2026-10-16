CREATE TABLE "verificationTokens" (
	"identifier" text NOT NULL,
	"token" text PRIMARY KEY NOT NULL,
	"expires" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "passkeys" ALTER COLUMN "userId" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "trustedSessions" ALTER COLUMN "userId" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "telegramId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "participant1TypingAt" timestamp;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "participant2TypingAt" timestamp;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "lastMessageAt" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "type" text DEFAULT 'TEXT' NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "readAt" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE("username");