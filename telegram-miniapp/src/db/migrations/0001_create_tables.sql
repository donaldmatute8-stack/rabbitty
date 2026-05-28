-- Rabbitty: Create new Drizzle schema tables in Neon
-- Run this in the Neon SQL editor

CREATE TABLE IF NOT EXISTS "users" (
  "id" text PRIMARY KEY,
  "telegramId" text NOT NULL UNIQUE,
  "username" text,
  "firstName" text,
  "lastName" text,
  "tonWalletAddress" text UNIQUE,
  "totalBunzEarned" integer NOT NULL DEFAULT 0,
  "visitedBusinesses" integer NOT NULL DEFAULT 0,
  "role" text NOT NULL DEFAULT 'USER',
  "createdAt" timestamp DEFAULT now(),
  "updatedAt" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "webSessions" (
  "id" text PRIMARY KEY,
  "jwtToken" text NOT NULL UNIQUE,
  "userId" text REFERENCES "users"("id"),
  "expiresAt" timestamp NOT NULL,
  "createdAt" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "ownedBusinesses" (
  "id" text PRIMARY KEY,
  "ownerId" text NOT NULL REFERENCES "users"("id"),
  "name" text NOT NULL,
  "category" text NOT NULL,
  "description" text,
  "address" text NOT NULL,
  "lat" real NOT NULL,
  "lng" real NOT NULL,
  "logoUrl" text,
  "gallery" text NOT NULL DEFAULT '[]',
  "rewardPercentage" integer NOT NULL DEFAULT 10,
  "createdAt" timestamp DEFAULT now(),
  "updatedAt" timestamp DEFAULT now(),
  "status" text NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "verificationMethod" text,
  "verificationData" text,
  "activeDays" text NOT NULL DEFAULT '[1,2,3,4,5,6,7]',
  "startTime" text NOT NULL DEFAULT '00:00',
  "endTime" text NOT NULL DEFAULT '23:59',
  "timezone" text NOT NULL DEFAULT 'America/Mexico_City'
);

CREATE TABLE IF NOT EXISTS "transactions" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES "users"("id"),
  "businessId" text NOT NULL REFERENCES "ownedBusinesses"("id"),
  "fiatAmount" real NOT NULL,
  "bunzMinted" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'PENDING',
  "txHash" text,
  "errorMessage" text,
  "ticketUrl" text,
  "createdAt" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "conversations" (
  "id" text PRIMARY KEY,
  "participant1" text NOT NULL,
  "participant2" text NOT NULL,
  "createdAt" timestamp DEFAULT now(),
  "updatedAt" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "messages" (
  "id" text PRIMARY KEY,
  "conversationId" text NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "senderId" text NOT NULL,
  "content" text NOT NULL,
  "createdAt" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "qrSessions" (
  "id" text PRIMARY KEY,
  "token" text NOT NULL UNIQUE,
  "userId" text REFERENCES "users"("id"),
  "status" text NOT NULL DEFAULT 'PENDING',
  "createdAt" timestamp DEFAULT now(),
  "expiresAt" timestamp NOT NULL
);
