-- Verificador de invariantes de capacidad/Bunz por afiliado.
-- Uso:
--   psql "$CORE_DATABASE_URL" -v affiliate_id='<uuid>' -f scripts/verify-affiliate-capacity.sql
-- Devuelve una tabla de checks (ok = true/false). No modifica nada.

\pset pager off

WITH biz AS (
  SELECT * FROM "ownedBusinesses" WHERE id = :'affiliate_id'
),
cap AS (
  SELECT * FROM merchant_capacity_accounts WHERE "affiliateId" = :'affiliate_id'
),
lim AS (
  SELECT * FROM bunz_economic_limits WHERE "affiliateId" = :'affiliate_id'
),
reset AS (
  SELECT NULLIF(value, '')::timestamptz AS at
  FROM "systemSettings" WHERE key = 'bunz_economy_reset_at'
),
tx AS (
  SELECT * FROM transactions WHERE "businessId" = :'affiliate_id'
),
sig AS (
  SELECT
    ("verificationData"::jsonb -> 'contractSignature' ->> 'contractVersion') AS version,
    ("verificationData"::jsonb -> 'contractSignature' ->> 'contractStatus') AS status,
    ("verificationData"::jsonb -> 'contractSignature' ->> 'coverageMonths') AS coverage_months,
    ("verificationData"::jsonb -> 'contractSignature' ->> 'copyDeliveryStatus') AS copy_status
  FROM biz
),
current_tx AS (
  SELECT t.* FROM tx t, reset r
  WHERE r.at IS NULL OR t."createdAt" >= r.at
),
delivered AS (
  SELECT COALESCE(SUM("bunzMinted") FILTER (WHERE status IN ('MINTED','COMPLETED')), 0)::numeric AS amount
  FROM current_tx
),
ledger_wallet AS (
  -- El ledger usa el orderId como refId (no el transaction.id).
  SELECT COALESCE(SUM(l.amount) FILTER (WHERE l.account = 'user_wallet' AND l.direction = 'credit'), 0)::numeric AS amount
  FROM bunz_ledger_entries l
  JOIN orders o ON o.id = l."refId"
  JOIN branches b ON b.id = o."branchId"
  JOIN restaurants r ON r.id = b."restaurantId"
  WHERE r."businessId" = :'affiliate_id'
    AND (NOT EXISTS (SELECT 1 FROM reset WHERE at IS NOT NULL) OR l.ts >= (SELECT at FROM reset))
)
SELECT 'business_exists' AS check, EXISTS(SELECT 1 FROM biz) AS ok,
       COALESCE((SELECT name FROM biz), '—') AS detail
UNION ALL
SELECT 'capacity_account_exists', EXISTS(SELECT 1 FROM cap),
       COALESCE((SELECT status FROM cap), '—')
UNION ALL
SELECT 'authorized_equals_creditLimit',
       COALESCE((SELECT c."authorizedTotal" = b."creditLimit" FROM cap c, biz b), false),
       format('authorized=%s creditLimit=%s', (SELECT "authorizedTotal" FROM cap), (SELECT "creditLimit" FROM biz))
UNION ALL
SELECT 'promo_plus_credit_equals_authorized',
       COALESCE((SELECT c."promoAuthorized" + c."creditAuthorized" = c."authorizedTotal" FROM cap c), false),
       format('promo=%s credit=%s authorized=%s', (SELECT "promoAuthorized" FROM cap), (SELECT "creditAuthorized" FROM cap), (SELECT "authorizedTotal" FROM cap))
UNION ALL
SELECT 'available_equals_provisioned_minus_committed',
       COALESCE((SELECT c.available = c.provisioned - c.committed FROM cap c), false),
       format('available=%s provisioned=%s committed=%s', (SELECT available FROM cap), (SELECT provisioned FROM cap), (SELECT committed FROM cap))
UNION ALL
SELECT 'creditOutstanding_equals_disbursed_minus_repaid',
       COALESCE((SELECT c."creditOutstanding" = c."creditDisbursed" - c."creditRepaid" FROM cap c), false),
       format('outstanding=%s disbursed=%s repaid=%s', (SELECT "creditOutstanding" FROM cap), (SELECT "creditDisbursed" FROM cap), (SELECT "creditRepaid" FROM cap))
UNION ALL
SELECT 'coverageDays_matches_contract',
       COALESCE((SELECT c."coverageDays" = round((s.coverage_months)::numeric * 30) FROM cap c, sig s), false),
       format('coverageDays=%s coverageMonths=%s', (SELECT "coverageDays" FROM cap), (SELECT coverage_months FROM sig))
UNION ALL
SELECT 'bunzBalance_equals_capacity_plus_delivered',
       COALESCE((SELECT b."bunzBalance" = c."authorizedTotal" + d.amount FROM biz b, cap c, delivered d), false),
       format('bunzBalance=%s authorized=%s delivered=%s', (SELECT "bunzBalance" FROM biz), (SELECT "authorizedTotal" FROM cap), (SELECT amount FROM delivered))
UNION ALL
SELECT 'pilot_limits_within_capacity',
       COALESCE((SELECT l."maxEmissionBunz" <= c."authorizedTotal" AND l."maxRedemptionBunz" <= c."authorizedTotal" AND l."maxSettlementBunz" <= c."authorizedTotal" FROM lim l, cap c), false),
       format('emission=%s redemption=%s settlement=%s authorized=%s', (SELECT "maxEmissionBunz" FROM lim), (SELECT "maxRedemptionBunz" FROM lim), (SELECT "maxSettlementBunz" FROM lim), (SELECT "authorizedTotal" FROM cap))
UNION ALL
SELECT 'contract_status_approved',
       COALESCE((SELECT s.status = 'approved' FROM sig s), false),
       format('version=%s status=%s', (SELECT version FROM sig), (SELECT status FROM sig))
UNION ALL
SELECT 'contract_copy_delivered',
       COALESCE((SELECT s.copy_status = 'sent' FROM sig s), false),
       COALESCE((SELECT copy_status FROM sig), '—')
UNION ALL
SELECT 'no_pre_reset_transactions',
       COALESCE((SELECT COUNT(*) = 0 FROM tx t, reset r WHERE r.at IS NOT NULL AND t."createdAt" < r.at), true),
       format('pre_reset=%s', (SELECT COUNT(*) FROM tx t, reset r WHERE r.at IS NOT NULL AND t."createdAt" < r.at))
UNION ALL
SELECT 'ledger_wallet_credit_equals_delivered',
       COALESCE((SELECT lw.amount = d.amount FROM ledger_wallet lw, delivered d), false),
       format('wallet_credit=%s delivered=%s', (SELECT amount FROM ledger_wallet), (SELECT amount FROM delivered));
