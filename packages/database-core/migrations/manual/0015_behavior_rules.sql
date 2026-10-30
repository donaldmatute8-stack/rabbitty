-- Motor de reglas de comportamiento — IDEMPOTENTE, solo CREATE.
CREATE TABLE IF NOT EXISTS "behaviorRules" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "businessId" text NOT NULL,
    "name" text NOT NULL,
    "triggerType" text NOT NULL,
    "triggerParams" jsonb NOT NULL,
    "action" jsonb NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "budgetBunz" integer DEFAULT 0 NOT NULL,
    "budgetSpent" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp DEFAULT now(),
    "updatedAt" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "behaviorRules_business_idx" ON "behaviorRules" ("businessId");
