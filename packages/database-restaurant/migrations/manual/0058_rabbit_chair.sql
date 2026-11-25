-- 0058 · Rabbit Chair — activaciones, cupo y créditos (Fase 0/1)
--
-- Aditiva: no toca menú, órdenes ni caja. La orden real y el cobro llegan en
-- fase 2; aquí solo viven la activación, los lugares y el derecho de uso.
--
-- Decisiones (ADR-016):
--  · Los grants viven en la MISMA base que la activación para que consumir el
--    crédito y crear la activación sea una sola transacción (sin consistencia
--    entre bases). Las solicitudes de la landing siguen en core DB.
--  · `chargeMode` PREPAID cobra en la app; POSTPAID cobra al final en POS.
--  · `format` define la experiencia: SINGLE, BLOCK, WAVES o COUPLES.

BEGIN;

CREATE TABLE IF NOT EXISTS "rabbitChairGrants" (
  "id"           text PRIMARY KEY,
  "businessId"   text NOT NULL,
  "requestId"    text,
  "creditsTotal" integer NOT NULL CHECK ("creditsTotal" > 0),
  "creditsUsed"  integer NOT NULL DEFAULT 0,
  "expiresAt"    timestamp,
  "revokedAt"    timestamp,
  "createdBy"    text,
  "createdAt"    timestamp DEFAULT now(),
  "updatedAt"    timestamp DEFAULT now(),
  CONSTRAINT "rabbitChairGrants_credits_check"
    CHECK ("creditsUsed" >= 0 AND "creditsUsed" <= "creditsTotal")
);

CREATE INDEX IF NOT EXISTS "rabbitChairGrants_business_idx"
  ON "rabbitChairGrants" ("businessId", "revokedAt", "expiresAt");

CREATE UNIQUE INDEX IF NOT EXISTS "rabbitChairGrants_request_uidx"
  ON "rabbitChairGrants" ("requestId") WHERE "requestId" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "rabbitChairGrantUses" (
  "id"           text PRIMARY KEY,
  "grantId"      text NOT NULL REFERENCES "rabbitChairGrants"("id") ON DELETE CASCADE,
  "activationId" text NOT NULL,
  "businessId"   text NOT NULL,
  "createdAt"    timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "rabbitChairGrantUses_activation_uidx"
  ON "rabbitChairGrantUses" ("activationId");

CREATE TABLE IF NOT EXISTS "rabbitChairActivations" (
  "id"                    text PRIMARY KEY,
  "businessId"            text NOT NULL,
  "branchId"              text NOT NULL REFERENCES "branches"("id") ON DELETE CASCADE,
  "name"                  text NOT NULL DEFAULT 'La Silla',
  "status"                text NOT NULL DEFAULT 'DRAFT',
  "grantId"               text,
  "format"                text NOT NULL DEFAULT 'BLOCK',
  "capacity"              integer NOT NULL DEFAULT 10 CHECK ("capacity" > 0 AND "capacity" <= 50),
  "partySize"             integer NOT NULL DEFAULT 1 CHECK ("partySize" >= 1 AND "partySize" <= 4),
  "waveMinutes"           integer,
  "chargeMode"            text NOT NULL DEFAULT 'PREPAID',
  "minContributionCents"  integer NOT NULL DEFAULT 5000 CHECK ("minContributionCents" >= 5000),
  "currency"              text NOT NULL DEFAULT 'MXN',
  "cardOnly"              boolean NOT NULL DEFAULT true,
  "durationMinutes"       integer NOT NULL DEFAULT 10 CHECK ("durationMinutes" > 0),
  "requiresAgeCheck"      boolean NOT NULL DEFAULT false,
  "menuMode"              text NOT NULL DEFAULT 'BOTH',
  "startsAt"              timestamp,
  "revealAt"              timestamp,
  "randomWindowFrom"      timestamp,
  "randomWindowTo"        timestamp,
  "radiusMeters"          integer,
  "playlist"              text,
  "lightPreset"           text,
  "bartenderMode"         text NOT NULL DEFAULT 'ROTATING',
  "createdBy"             text,
  "createdAt"             timestamp DEFAULT now(),
  "updatedAt"             timestamp DEFAULT now(),
  CONSTRAINT "rabbitChairActivations_status_check"
    CHECK ("status" IN ('DRAFT', 'LIVE', 'SOLD_OUT', 'DONE', 'CANCELLED')),
  CONSTRAINT "rabbitChairActivations_format_check"
    CHECK ("format" IN ('SINGLE', 'BLOCK', 'WAVES', 'COUPLES')),
  CONSTRAINT "rabbitChairActivations_charge_check"
    CHECK ("chargeMode" IN ('PREPAID', 'POSTPAID')),
  CONSTRAINT "rabbitChairActivations_menu_check"
    CHECK ("menuMode" IN ('COFFEE', 'ALCOHOL', 'BOTH')),
  CONSTRAINT "rabbitChairActivations_bartender_check"
    CHECK ("bartenderMode" IN ('FIXED', 'ROTATING'))
);

-- Una sola activación LIVE por sucursal: la escasez es parte del producto y
-- evita que dos drops se pisen en la misma barra.
CREATE UNIQUE INDEX IF NOT EXISTS "rabbitChairActivations_live_branch_uidx"
  ON "rabbitChairActivations" ("branchId") WHERE "status" = 'LIVE';

CREATE INDEX IF NOT EXISTS "rabbitChairActivations_branch_idx"
  ON "rabbitChairActivations" ("branchId", "status", "startsAt");

CREATE TABLE IF NOT EXISTS "rabbitChairSlots" (
  "id"            text PRIMARY KEY,
  "activationId"  text NOT NULL REFERENCES "rabbitChairActivations"("id") ON DELETE CASCADE,
  "index"         integer NOT NULL,
  "wave"          integer NOT NULL DEFAULT 1,
  "status"        text NOT NULL DEFAULT 'FREE',
  "paymentStatus" text NOT NULL DEFAULT 'UNPAID',
  "orderId"       text,
  "userId"        text,
  "guestName"     text,
  "config"        jsonb,
  "paidCents"     integer,
  "paymentRef"    text,
  "heldUntil"     timestamp,
  "seatedAt"      timestamp,
  "servedAt"      timestamp,
  "endsAt"        timestamp,
  "createdAt"     timestamp DEFAULT now(),
  "updatedAt"     timestamp DEFAULT now(),
  CONSTRAINT "rabbitChairSlots_status_check"
    CHECK ("status" IN ('FREE', 'HELD', 'PAID', 'SEATED', 'SERVED', 'DONE', 'EXPIRED')),
  CONSTRAINT "rabbitChairSlots_payment_check"
    CHECK ("paymentStatus" IN ('UNPAID', 'AUTHORIZED', 'PAID', 'REFUNDED')),
  CONSTRAINT "rabbitChairSlots_amount_check"
    CHECK ("paidCents" IS NULL OR "paidCents" >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "rabbitChairSlots_activation_index_uidx"
  ON "rabbitChairSlots" ("activationId", "index");

-- Un Rabbiter no puede acaparar dos lugares activos de la misma activación.
-- Es la garantía dura; el servicio además devuelve un error amable.
CREATE UNIQUE INDEX IF NOT EXISTS "rabbitChairSlots_active_user_uidx"
  ON "rabbitChairSlots" ("activationId", "userId")
  WHERE "userId" IS NOT NULL AND "status" IN ('HELD', 'PAID', 'SEATED');

CREATE UNIQUE INDEX IF NOT EXISTS "rabbitChairSlots_payment_uidx"
  ON "rabbitChairSlots" ("paymentRef") WHERE "paymentRef" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "rabbitChairSlots_activation_status_idx"
  ON "rabbitChairSlots" ("activationId", "status", "wave", "index");

COMMIT;
