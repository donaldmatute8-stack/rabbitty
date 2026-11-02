\echo === [1] SAN-1: negocios con bunzBalance negativo (debe ser 0)
SELECT COUNT(*) AS negativos FROM "ownedBusinesses" WHERE COALESCE("bunzBalance",0) < 0;

\echo === [2] SAN-2: Rabbitters con saldo negativo (earned-spent < 0, debe ser 0)
SELECT COUNT(*) AS negativos FROM users WHERE COALESCE("totalBunzEarned",0) - COALESCE("totalBunzSpent",0) < 0;

\echo === [3] IDEM-1: ledger idempotencyKey duplicado (debe ser 0)
SELECT COUNT(*) FROM (SELECT "idempotencyKey" FROM ledger_entries WHERE "idempotencyKey" IS NOT NULL GROUP BY "idempotencyKey" HAVING COUNT(*) > 1) d;

\echo === [4] IDEM-2:Settles de intents SUCCEEDED/SETTLED con orderId que NO tengan payments row (debe ser 0)
SELECT COUNT(*) FROM "payment_intents" pi WHERE pi.status IN ('SUCCEEDED','SETTLED') AND pi."orderId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM payments p WHERE p."orderId" = pi."orderId" AND p.status='COMPLETED');

\echo === [5] Claimed-PVAULT: vaults PENDING vencidas sin procesar (cron las recupera; informativo)
SELECT COUNT(*) FROM "pendingVaults" WHERE status='PENDING' AND "expiresAt" < now();

\echo === [6] BUNZ-PAY: redenciones con método BUNZ sin entrada ledger SPEND asociada (debe ser 0)
SELECT COUNT(*) FROM payments p JOIN orders o ON o.id=p."orderId" WHERE p.method='BUNZ' AND p.status='COMPLETED' AND NOT EXISTS (SELECT 1 FROM ledger_entries l WHERE l."idempotencyKey" = 'stl_' || COALESCE(p.reference, p."id"));

\echo === [7] COUNTERS: muestra D-17 — top 5 usuarios con mayor varianza ledger vs contadores
WITH peruser AS (
  SELECT p."payeeSubjectId", SUM(CASE WHEN p.type='EARN' THEN p.amount ELSE -p.amount END) AS ledger_delta
  FROM ledger_entries p WHERE p."payeeSubjectId" LIKE 'usr_%' AND p.currency='BUNZ'
  GROUP BY 1
)
SELECT u.id, u.id::text AS usuario, COALESCE(peruser.ledger_delta,0) AS ledger_delta,
       (COALESCE(u."totalBunzEarned",0) - COALESCE(u."totalBunzSpent",0)) AS counter_delta,
       ABS((COALESCE(u."totalBunzEarned",0) - COALESCE(u."totalBunzSpent",0)) - COALESCE(peruser.ledger_delta,0)) AS varianza
FROM users u
LEFT JOIN peruser ON peruser."payeeSubjectId" = 'usr_' || u.id::text
WHERE u."totalBunzEarned" + u."totalBunzSpent" > 0
ORDER BY varianza DESC LIMIT 5;

\echo === [8] STOCK: top 5 negocios por disponibilidad de rescate (custödica snapshot)
SELECT id, name, COALESCE("bunzBalance",0) AS backing FROM "ownedBusinesses" ORDER BY COALESCE("bunzBalance",0) DESC LIMIT 5;
