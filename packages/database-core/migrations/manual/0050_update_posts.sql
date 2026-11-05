-- 0050_update_posts.sql
-- Update Log (blog de novedades). Aditiva.

CREATE TABLE IF NOT EXISTS "updatePosts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug" text NOT NULL UNIQUE,
  "version" text,
  "title" text NOT NULL,
  "summary" text NOT NULL,
  "body" text NOT NULL,
  "category" text NOT NULL DEFAULT 'PRODUCT',
  "tags" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "coverUrl" text,
  "status" text NOT NULL DEFAULT 'PUBLISHED',
  "publishedAt" timestamp NOT NULL DEFAULT now(),
  "createdBy" text,
  "createdAt" timestamp DEFAULT now(),
  "updatedAt" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "update_posts_status_published_idx"
  ON "updatePosts" ("status", "publishedAt");
