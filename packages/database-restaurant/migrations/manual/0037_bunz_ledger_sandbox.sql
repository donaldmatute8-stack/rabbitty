-- 0037 · bunz_ledger_entries.sandbox
--
-- Motivo: la demo de App Review escribe asientos en el libro Bunz. Sin una marca
-- explícita, el check por cuenta del gate tiene que adivinar la demo por `refId`,
-- que es frágil. Con `sandbox` la exclusión es una condición, no una heurística.
--
-- No cambia importes, grupos ni el flujo de escritura.

ALTER TABLE "bunz_ledger_entries"
  ADD COLUMN IF NOT EXISTS sandbox boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN "bunz_ledger_entries".sandbox IS
  'true = demo/App Review. Se excluye del check por cuenta del gate.';

-- Backfill: los asientos de la demo ya existen y se identifican por su refId
-- y por el asiento de ledger sandbox con el mismo referenceId.
UPDATE "bunz_ledger_entries" b
   SET sandbox = true
 WHERE b.sandbox = false
   AND (
     b."refId" = 'appreview-demo-500'
     OR b."refId" LIKE 'appreview-%'
     OR EXISTS (
       SELECT 1
         FROM ledger_entries l
        WHERE l."referenceId" = b."refId"
          AND l.sandbox = true
     )
   );
