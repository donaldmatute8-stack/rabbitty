-- ─────────────────────────────────────────────────────────────────────────────
-- Rabbitty Memberships (Fase 15.1) — migración IDEMPOTENTE para producción.
-- Aplicar con: psql "$DATABASE_URL" -1 -v ON_ERROR_STOP=1 -f 0010_memberships_prod.sql
-- NOTA: NO incluye scanCode (ya aplicado manualmente en producción).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "entitlement_usages" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "entitlementId" uuid NOT NULL,
    "subscriptionId" uuid NOT NULL,
    "branchId" text,
    "staffId" text,
    "orderId" text,
    "quantityUsed" integer NOT NULL,
    "idempotencyKey" text NOT NULL,
    "redeemedAt" timestamp DEFAULT now(),
    CONSTRAINT "entitlement_usages_idempotencyKey_unique" UNIQUE ("idempotencyKey")
);

CREATE TABLE IF NOT EXISTS "membership_entitlements" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "subscriptionId" uuid NOT NULL,
    "benefitType" text NOT NULL,
    "targetRefId" text,
    "quotaPerCycle" integer NOT NULL,
    "cycleResetType" text NOT NULL,
    "currentUsageInCycle" integer DEFAULT 0 NOT NULL,
    "cycleStartDate" timestamp NOT NULL,
    "cycleEndDate" timestamp NOT NULL,
    "discountPct" integer,
    "creditBalance" real,
    "createdAt" timestamp DEFAULT now(),
    "updatedAt" timestamp DEFAULT now()
);

-- Web2.5 — NOT ACTIVE (dormida, sin router ni UI)
CREATE TABLE IF NOT EXISTS "membership_nft_credentials" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "subscriptionId" uuid NOT NULL,
    "network" text,
    "contractAddress" text,
    "tokenId" text,
    "walletAddress" text,
    "mintStatus" text DEFAULT 'NOT_STARTED' NOT NULL,
    "txHash" text,
    "metadataUri" text,
    "createdAt" timestamp DEFAULT now(),
    "updatedAt" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "membership_plan_versions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "planId" uuid NOT NULL,
    "versionNumber" integer NOT NULL,
    "priceFiat" real NOT NULL,
    "currency" text DEFAULT 'MXN' NOT NULL,
    "billingInterval" text NOT NULL,
    "benefitRules" jsonb NOT NULL,
    "branchesAllowed" jsonb DEFAULT '[]'::jsonb,
    "maxMembersLimit" integer,
    "isPublished" boolean DEFAULT false NOT NULL,
    "stripeProductId" text,
    "stripePriceId" text,
    "createdAt" timestamp DEFAULT now(),
    "updatedAt" timestamp DEFAULT now(),
    CONSTRAINT "membership_plan_versions_planId_versionNumber_unique" UNIQUE ("planId","versionNumber")
);

CREATE TABLE IF NOT EXISTS "membership_plans" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "businessId" text NOT NULL,
    "slug" text NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "coverImageUrl" text,
    "badgeColor" text DEFAULT '#E91E63' NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "currentVersionId" uuid,
    "createdAt" timestamp DEFAULT now(),
    "updatedAt" timestamp DEFAULT now(),
    CONSTRAINT "membership_plans_businessId_slug_unique" UNIQUE ("businessId","slug")
);

CREATE TABLE IF NOT EXISTS "membership_subscriptions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "userId" text NOT NULL,
    "businessId" text NOT NULL,
    "planVersionId" uuid NOT NULL,
    "status" text DEFAULT 'ACTIVE' NOT NULL,
    "currentPeriodStart" timestamp NOT NULL,
    "currentPeriodEnd" timestamp NOT NULL,
    "cancelAtPeriodEnd" boolean DEFAULT false NOT NULL,
    "paymentProvider" text,
    "paymentProviderSubId" text,
    "qrPassSecret" text NOT NULL,
    "createdAt" timestamp DEFAULT now(),
    "updatedAt" timestamp DEFAULT now()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'entitlement_usages_entitlementId_membership_entitlements_id_fk'
    ) THEN
        ALTER TABLE "entitlement_usages" ADD CONSTRAINT "entitlement_usages_entitlementId_membership_entitlements_id_fk"
            FOREIGN KEY ("entitlementId") REFERENCES "membership_entitlements"("id") ON DELETE restrict ON UPDATE cascade;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'entitlement_usages_subscriptionId_membership_subscriptions_id_fk'
    ) THEN
        ALTER TABLE "entitlement_usages" ADD CONSTRAINT "entitlement_usages_subscriptionId_membership_subscriptions_id_fk"
            FOREIGN KEY ("subscriptionId") REFERENCES "membership_subscriptions"("id") ON DELETE restrict ON UPDATE cascade;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'membership_entitlements_subscriptionId_membership_subscriptions_id_fk'
    ) THEN
        ALTER TABLE "membership_entitlements" ADD CONSTRAINT "membership_entitlements_subscriptionId_membership_subscriptions_id_fk"
            FOREIGN KEY ("subscriptionId") REFERENCES "membership_subscriptions"("id") ON DELETE restrict ON UPDATE cascade;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'membership_nft_credentials_subscriptionId_membership_subscriptions_id_fk'
    ) THEN
        ALTER TABLE "membership_nft_credentials" ADD CONSTRAINT "membership_nft_credentials_subscriptionId_membership_subscriptions_id_fk"
            FOREIGN KEY ("subscriptionId") REFERENCES "membership_subscriptions"("id") ON DELETE restrict ON UPDATE cascade;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'membership_plan_versions_planId_membership_plans_id_fk'
    ) THEN
        ALTER TABLE "membership_plan_versions" ADD CONSTRAINT "membership_plan_versions_planId_membership_plans_id_fk"
            FOREIGN KEY ("planId") REFERENCES "membership_plans"("id") ON DELETE restrict ON UPDATE cascade;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'membership_subscriptions_planVersionId_membership_plan_versions_id_fk'
    ) THEN
        ALTER TABLE "membership_subscriptions" ADD CONSTRAINT "membership_subscriptions_planVersionId_membership_plan_versions_id_fk"
            FOREIGN KEY ("planVersionId") REFERENCES "membership_plan_versions"("id") ON DELETE restrict ON UPDATE cascade;
    END IF;
END $$;
