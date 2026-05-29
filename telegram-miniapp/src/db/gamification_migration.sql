ALTER TABLE "users" ADD COLUMN "hops" integer DEFAULT 0 NOT NULL;
ALTER TABLE "users" ADD COLUMN "levelId" text;

CREATE TABLE IF NOT EXISTS "levels" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"requiredHops" integer NOT NULL,
	"bunzMultiplier" real DEFAULT 1.0 NOT NULL,
	"premiumAccess" boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS "hat_tricks" (
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

CREATE TABLE IF NOT EXISTS "user_hat_tricks" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"trickId" text NOT NULL,
	"progressValue" integer DEFAULT 0 NOT NULL,
	"isCompleted" boolean DEFAULT false NOT NULL,
	"completedAt" timestamp
);

CREATE TABLE IF NOT EXISTS "achievements" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"iconUrl" text NOT NULL,
	"conditionType" text NOT NULL,
	"conditionTarget" integer NOT NULL
);

CREATE TABLE IF NOT EXISTS "user_achievements" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"achievementId" text NOT NULL,
	"unlockedAt" timestamp DEFAULT now()
);

DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_levelId_levels_id_fk" FOREIGN KEY ("levelId") REFERENCES "public"."levels"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "user_hat_tricks" ADD CONSTRAINT "user_hat_tricks_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "user_hat_tricks" ADD CONSTRAINT "user_hat_tricks_trickId_hat_tricks_id_fk" FOREIGN KEY ("trickId") REFERENCES "public"."hat_tricks"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievementId_achievements_id_fk" FOREIGN KEY ("achievementId") REFERENCES "public"."achievements"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
