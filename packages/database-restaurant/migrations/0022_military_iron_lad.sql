CREATE TABLE "rabbitter_score_shadow" (
	"id" text PRIMARY KEY NOT NULL,
	"subjectId" text NOT NULL,
	"score" real,
	"confidence" text NOT NULL,
	"sampleN" integer NOT NULL,
	"components" jsonb,
	"reviewFlag" boolean DEFAULT false NOT NULL,
	"computedAt" timestamp DEFAULT now() NOT NULL
);
