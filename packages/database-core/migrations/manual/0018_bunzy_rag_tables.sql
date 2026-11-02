-- ── Bunzy Fase 0 (RAG): tablas knowledge/memories del roadmap Supreme ──
-- Extrae de 0008_mute_cyclops.sql SOLO las tablas de Bunzy que faltaban en prod
-- (el resto de 0008 ya está aplicado). Idempotente. Norma DRIFT-001:
--   psql "$CORE_DATABASE_URL" -f packages/database-core/migrations/manual/0018_bunzy_rag_tables.sql
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "knowledgeChunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"businessId" text,
	"scope" text NOT NULL,
	"sourceType" text NOT NULL,
	"sourceId" text NOT NULL,
	"content" text NOT NULL,
	"contentHash" text NOT NULL,
	"embedding" vector(1536),
	"embeddingModel" text DEFAULT 'text-embedding-3-small' NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "userMemories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"confidenceScore" real DEFAULT 1.0 NOT NULL,
	"source" text DEFAULT 'EXPLICIT_USER_INPUT' NOT NULL,
	"expiresAt" timestamp,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "memoryCandidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text,
	"businessId" text,
	"rawInput" text NOT NULL,
	"extractedKey" text NOT NULL,
	"extractedValue" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"createdAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "businessLearningInsights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"businessId" text NOT NULL,
	"insightType" text NOT NULL,
	"periodAnalyzed" text NOT NULL,
	"sampleSize" integer NOT NULL,
	"confidenceScore" real NOT NULL,
	"recommendation" text NOT NULL,
	"metricsBasis" jsonb NOT NULL,
	"calculatedAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "knowledgeChunks" ADD CONSTRAINT "knowledgeChunks_businessId_ownedBusinesses_id_fk"
		FOREIGN KEY ("businessId") REFERENCES "public"."ownedBusinesses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN others THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "memoryCandidates" ADD CONSTRAINT "memoryCandidates_userId_users_id_fk"
		FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN others THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "memoryCandidates" ADD CONSTRAINT "memoryCandidates_businessId_ownedBusinesses_id_fk"
		FOREIGN KEY ("businessId") REFERENCES "public"."ownedBusinesses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN others THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "userMemories" ADD CONSTRAINT "userMemories_userId_users_id_fk"
		FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN others THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "businessLearningInsights" ADD CONSTRAINT "businessLearningInsights_businessId_ownedBusinesses_id_fk"
		FOREIGN KEY ("businessId") REFERENCES "public"."ownedBusinesses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN others THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN CREATE UNIQUE INDEX "knowledge_chunks_source_uidx" ON "knowledgeChunks" ("sourceType","sourceId"); EXCEPTION WHEN others THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN CREATE UNIQUE INDEX "user_memories_user_key_uidx" ON "userMemories" ("userId","key"); EXCEPTION WHEN others THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN CREATE INDEX "knowledge_chunks_hnsw_idx" ON "knowledgeChunks" USING hnsw ("embedding" vector_cosine_ops); EXCEPTION WHEN others THEN NULL; END $$;
