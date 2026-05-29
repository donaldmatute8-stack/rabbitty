CREATE TABLE "achievements" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"iconUrl" text NOT NULL,
	"conditionType" text NOT NULL,
	"conditionTarget" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"participant1" text NOT NULL,
	"participant2" text NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "hat_tricks" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"rewardHops" integer DEFAULT 0 NOT NULL,
	"rewardBunz" integer DEFAULT 0 NOT NULL,
	"conditionType" text NOT NULL,
	"conditionTarget" integer NOT NULL,
	"conditionCategory" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "levels" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"requiredHops" integer NOT NULL,
	"bunzMultiplier" real DEFAULT 1 NOT NULL,
	"premiumAccess" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversationId" text NOT NULL,
	"senderId" text NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"isRead" boolean DEFAULT false NOT NULL,
	"type" text DEFAULT 'SYSTEM' NOT NULL,
	"createdAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ownedBusinesses" (
	"id" text PRIMARY KEY NOT NULL,
	"ownerId" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"address" text NOT NULL,
	"lat" real NOT NULL,
	"lng" real NOT NULL,
	"logoUrl" text,
	"gallery" text DEFAULT '[]' NOT NULL,
	"rewardPercentage" integer DEFAULT 10 NOT NULL,
	"rarity" text DEFAULT 'common' NOT NULL,
	"givesBunz" boolean DEFAULT true NOT NULL,
	"acceptsBunz" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now(),
	"status" text DEFAULT 'PENDING_VERIFICATION' NOT NULL,
	"verificationMethod" text,
	"verificationData" text,
	"activeDays" text DEFAULT '[1,2,3,4,5,6,7]' NOT NULL,
	"startTime" text DEFAULT '00:00' NOT NULL,
	"endTime" text DEFAULT '23:59' NOT NULL,
	"timezone" text DEFAULT 'America/Mexico_City' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qrSessions" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"userId" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"expiresAt" timestamp NOT NULL,
	CONSTRAINT "qrSessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" text PRIMARY KEY NOT NULL,
	"inviterId" text NOT NULL,
	"invitedId" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"rewardAmount" integer DEFAULT 50 NOT NULL,
	"createdAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"businessId" text NOT NULL,
	"title" text NOT NULL,
	"bunzCost" integer NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"date" timestamp DEFAULT now(),
	"createdAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"businessId" text NOT NULL,
	"fiatAmount" real NOT NULL,
	"bunzMinted" integer NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"txHash" text,
	"errorMessage" text,
	"ticketUrl" text,
	"createdAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_achievements" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"achievementId" text NOT NULL,
	"unlockedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_hat_tricks" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"trickId" text NOT NULL,
	"progressValue" integer DEFAULT 0 NOT NULL,
	"isCompleted" boolean DEFAULT false NOT NULL,
	"completedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"telegramId" text NOT NULL,
	"username" text,
	"firstName" text,
	"lastName" text,
	"tonWalletAddress" text,
	"totalBunzEarned" integer DEFAULT 0 NOT NULL,
	"visitedBusinesses" integer DEFAULT 0 NOT NULL,
	"role" text DEFAULT 'USER' NOT NULL,
	"hasMadeFirstTransaction" boolean DEFAULT false NOT NULL,
	"hasEarnedFirstBunz" boolean DEFAULT false NOT NULL,
	"hops" integer DEFAULT 0 NOT NULL,
	"levelId" text,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now(),
	CONSTRAINT "users_telegramId_unique" UNIQUE("telegramId"),
	CONSTRAINT "users_tonWalletAddress_unique" UNIQUE("tonWalletAddress")
);
--> statement-breakpoint
CREATE TABLE "webSessions" (
	"id" text PRIMARY KEY NOT NULL,
	"jwtToken" text NOT NULL,
	"userId" text,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	CONSTRAINT "webSessions_jwtToken_unique" UNIQUE("jwtToken")
);
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_conversations_id_fk" FOREIGN KEY ("conversationId") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownedBusinesses" ADD CONSTRAINT "ownedBusinesses_ownerId_users_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qrSessions" ADD CONSTRAINT "qrSessions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_inviterId_users_id_fk" FOREIGN KEY ("inviterId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_invitedId_users_id_fk" FOREIGN KEY ("invitedId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_businessId_ownedBusinesses_id_fk" FOREIGN KEY ("businessId") REFERENCES "public"."ownedBusinesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_businessId_ownedBusinesses_id_fk" FOREIGN KEY ("businessId") REFERENCES "public"."ownedBusinesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievementId_achievements_id_fk" FOREIGN KEY ("achievementId") REFERENCES "public"."achievements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_hat_tricks" ADD CONSTRAINT "user_hat_tricks_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_hat_tricks" ADD CONSTRAINT "user_hat_tricks_trickId_hat_tricks_id_fk" FOREIGN KEY ("trickId") REFERENCES "public"."hat_tricks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webSessions" ADD CONSTRAINT "webSessions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;