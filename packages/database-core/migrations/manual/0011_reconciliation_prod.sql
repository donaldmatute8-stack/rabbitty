-- ─────────────────────────────────────────────────────────────────────────────
-- Conciliación de recompensas — migración IDEMPOTENTE para producción.
-- Aplicar con: psql "$URL" -1 -v ON_ERROR_STOP=1 -f 0011_reconciliation_prod.sql
-- SOLO CREATE (tablas/constraints). Nunca modifica ni borra datos existentes.
-- ids text (patrón de producción): orderId, userId, businessId, affiliateUserId,
-- godUserId, ledgerEntryId — snapshots financieros como integer NOT NULL.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "reconciliationRequests" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "orderId" text NOT NULL UNIQUE,
    "userId" text NOT NULL,
    "businessId" text NOT NULL,
    "branchId" text,
    "expectedBunz" integer NOT NULL,
    "creditedBunz" integer DEFAULT 0 NOT NULL,
    "pendingBunz" integer DEFAULT 0 NOT NULL,
    "claimedBunz" integer NOT NULL,
    "rewardRuleRef" text,
    "note" text NOT NULL,
    "evidenceUrl" text,
    "status" text DEFAULT 'PENDING_AFFILIATE' NOT NULL,
    "affiliateNote" text,
    "affiliateUserId" text,
    "godNote" text,
    "godUserId" text,
    "ledgerEntryId" text,
    "idempotencyKey" text NOT NULL,
    "deliveryAttempts" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp DEFAULT now(),
    "updatedAt" timestamp DEFAULT now(),
    "affiliateRespondedAt" timestamp,
    "godResolvedAt" timestamp,
    "deliveredAt" timestamp
);

CREATE INDEX IF NOT EXISTS "reconciliationRequests_status_idx"
    ON "reconciliationRequests" ("status");
CREATE INDEX IF NOT EXISTS "reconciliationRequests_userId_idx"
    ON "reconciliationRequests" ("userId");
CREATE INDEX IF NOT EXISTS "reconciliationRequests_businessId_idx"
    ON "reconciliationRequests" ("businessId");
