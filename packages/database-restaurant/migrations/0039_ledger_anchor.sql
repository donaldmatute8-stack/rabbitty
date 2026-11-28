-- 0039 · Anclaje del libro Bunz: unidades enteras, secuencia y épocas
--
-- Por qué existe: `amountUnits`, `seq`, `ledger_seq_allocator`, `chain_epochs` y
-- `chain_reconciliation_runs` ya viven en producción, pero se crearon a mano.
-- Un entorno nuevo NO reproducía la base (y de hecho localmente faltaba el
-- asignador, así que cualquier asiento fallaba).
--
-- Esta migración es ADITIVA e IDEMPOTENTE: no borra ni cambia datos existentes.
-- En producción no hace nada nuevo (todo existe); en un entorno limpio crea el
-- anclaje completo.
--
-- Contrato: la secuencia `seq` solo la consumen asientos REALES (sandbox = false).
-- La demo nunca consume número, y con `seq` nulo se queda fuera del epoch.

-- El runner (scripts/sql-migrate.mjs) ya envuelve el archivo en una transacción.

-- ── 1. Columnas ────────────────────────────────────────────────────────────
ALTER TABLE "ledger_entries"
  ADD COLUMN IF NOT EXISTS "sandbox" boolean NOT NULL DEFAULT false;
ALTER TABLE "ledger_entries"
  ADD COLUMN IF NOT EXISTS "amountUnits" bigint;
ALTER TABLE "ledger_entries"
  ADD COLUMN IF NOT EXISTS "seq" bigint;

-- ── 2. Backfill de unidades enteras ────────────────────────────────────────
UPDATE "ledger_entries"
   SET "amountUnits" = round("amount")::bigint
 WHERE "amountUnits" IS NULL;

ALTER TABLE "ledger_entries"
  ALTER COLUMN "amountUnits" SET NOT NULL;

-- ── 3. Funciones del libro ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ledger_entries_set_amount_units()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW."amountUnits" IS NULL THEN
    NEW."amountUnits" := round(NEW.amount)::bigint;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ledger_entries_append_only()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF current_setting('rabbitty.allow_ledger_mutation', true) = 'on' THEN
    RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  RAISE EXCEPTION 'ledger_entries: % sobre columna hasheada bloqueado', TG_OP
    USING HINT = 'Corrección excepcional: SET LOCAL rabbitty.allow_ledger_mutation = ''on'';';
END;
$function$;

CREATE OR REPLACE FUNCTION public.ledger_entries_assign_seq()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  nuevo bigint;
BEGIN
  IF NEW.sandbox THEN
    RETURN NEW;          -- la demo no consume número: queda seq = NULL
  END IF;

  IF NEW.seq IS NOT NULL THEN
    RETURN NEW;          -- backfill o importación explícita
  END IF;

  UPDATE ledger_seq_allocator
     SET last_seq = last_seq + 1
   WHERE id
  RETURNING last_seq INTO nuevo;

  IF nuevo IS NULL THEN
    RAISE EXCEPTION 'falta la fila única de ledger_seq_allocator';
  END IF;

  NEW.seq := nuevo;
  RETURN NEW;
END;
$function$;

-- ── 4. Asignador de secuencia (una sola fila) ──────────────────────────────
CREATE TABLE IF NOT EXISTS "ledger_seq_allocator" (
  "id"       boolean PRIMARY KEY DEFAULT true NOT NULL,
  "last_seq" bigint  NOT NULL DEFAULT 0,
  CONSTRAINT "ledger_seq_allocator_fila_unica" CHECK ("id")
);

INSERT INTO "ledger_seq_allocator" ("id") VALUES (true)
ON CONFLICT ("id") DO NOTHING;

-- ── 5. Backfill de seq para asientos reales anteriores ─────────────────────
-- La tabla es append-only: el backfill se hace con el permiso explícito. Todo
-- va en un DO para que el permiso dure exactamente lo que dura el backfill,
-- tanto si el runner abre transacción como si el archivo se corre a mano.
DO $$
BEGIN
  PERFORM set_config('rabbitty.allow_ledger_mutation', 'on', true);

  WITH ordenadas AS (
    SELECT "id", row_number() OVER (ORDER BY "createdAt", "id") AS rn
      FROM "ledger_entries"
     WHERE "sandbox" = false
       AND "seq" IS NULL
  )
  UPDATE "ledger_entries" l
     SET "seq" = o.rn
    FROM ordenadas o
   WHERE l."id" = o."id";

  UPDATE "ledger_seq_allocator"
     SET "last_seq" = GREATEST(
       "last_seq",
       COALESCE((SELECT max("seq") FROM "ledger_entries"), 0)
     );

  PERFORM set_config('rabbitty.allow_ledger_mutation', 'off', true);
END $$;

-- ── 6. Triggers ────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS "ledger_entries_amount_units" ON "ledger_entries";
CREATE TRIGGER "ledger_entries_amount_units"
  BEFORE INSERT OR UPDATE OF "amount" ON "ledger_entries"
  FOR EACH ROW EXECUTE FUNCTION public.ledger_entries_set_amount_units();

DROP TRIGGER IF EXISTS "ledger_entries_assign_seq" ON "ledger_entries";
CREATE TRIGGER "ledger_entries_assign_seq"
  BEFORE INSERT ON "ledger_entries"
  FOR EACH ROW EXECUTE FUNCTION public.ledger_entries_assign_seq();

DROP TRIGGER IF EXISTS "ledger_entries_append_only" ON "ledger_entries";
CREATE TRIGGER "ledger_entries_append_only"
  BEFORE DELETE ON "ledger_entries"
  FOR EACH ROW EXECUTE FUNCTION public.ledger_entries_append_only();

DROP TRIGGER IF EXISTS "ledger_entries_append_only_cols" ON "ledger_entries";
CREATE TRIGGER "ledger_entries_append_only_cols"
  BEFORE UPDATE OF "seq", "id", "payerSubjectId", "payeeSubjectId", "amount", "amountUnits", "type", "currency"
  ON "ledger_entries"
  FOR EACH ROW EXECUTE FUNCTION public.ledger_entries_append_only();

-- ── 7. Restricciones ───────────────────────────────────────────────────────
DO $$
BEGIN
  ALTER TABLE "ledger_entries"
    ADD CONSTRAINT "ledger_amount_units_coherent"
    CHECK ("amountUnits" = round("amount")::bigint);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ledger_entries"
    ADD CONSTRAINT "ledger_currency_bunz" CHECK ("currency" = 'BUNZ');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ledger_entries"
    ADD CONSTRAINT "ledger_real_tiene_seq" CHECK ("sandbox" OR "seq" IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ledger_entries"
    ADD CONSTRAINT "ledger_subject_canonico"
    CHECK ("payerSubjectId" ~ '^(usr|biz|sys)_[A-Za-z0-9_-]+$'
       AND "payeeSubjectId" ~ '^(usr|biz|sys)_[A-Za-z0-9_-]+$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 8. Índices del libro ───────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS "ledger_entries_seq_key"
  ON "ledger_entries" ("seq");
CREATE INDEX IF NOT EXISTS "ledger_entries_payer_idx"
  ON "ledger_entries" ("payerSubjectId", "seq");
CREATE INDEX IF NOT EXISTS "ledger_entries_payee_idx"
  ON "ledger_entries" ("payeeSubjectId", "seq");
CREATE INDEX IF NOT EXISTS "ledger_entries_real_idx"
  ON "ledger_entries" ("seq") WHERE NOT "sandbox";

-- ── 9. Épocas del ancla ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "chain_epochs" (
  "id"                      text    PRIMARY KEY NOT NULL,
  "chain_id"                integer NOT NULL,
  "from_seq"                bigint  NOT NULL,
  "to_seq"                  bigint  NOT NULL,
  "leaf_count"              integer NOT NULL,
  "from_entry_seq"          bigint  NOT NULL,
  "to_entry_seq"            bigint  NOT NULL,
  "root"                    text    NOT NULL,
  "prev_root"               text    NOT NULL,
  "amount_scale"            integer NOT NULL DEFAULT 18,
  "leaf_version"            smallint NOT NULL DEFAULT 2,
  "account_salt"            text    NOT NULL,
  "account_salt_commitment" text    NOT NULL,
  "manifest_cid"            text,
  "manifest_hash"           text    NOT NULL,
  "anchor_tx"               text,
  "anchored_at"             timestamp with time zone,
  "created_at"              timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "chain_epochs_amount_scale" CHECK ("amount_scale" >= 0 AND "amount_scale" <= 18),
  CONSTRAINT "chain_epochs_entradas_coherentes" CHECK ("to_entry_seq" >= "from_entry_seq"),
  CONSTRAINT "chain_epochs_hojas_coherentes" CHECK ("leaf_count" = ("to_seq" - "from_seq") + 1),
  CONSTRAINT "chain_epochs_leaf_version" CHECK ("leaf_version" >= 1),
  CONSTRAINT "chain_epochs_rango_valido" CHECK ("to_seq" >= "from_seq")
);

-- El mapeo asiento→hoja es parte del contrato del árbol: 2 hojas por asiento.
DO $$
BEGIN
  ALTER TABLE "chain_epochs"
    ADD CONSTRAINT "chain_epochs_mapeo"
    CHECK ("from_seq" = (("from_entry_seq" - 1) * 2) + 1
       AND "to_seq" = (("to_entry_seq" - 1) * 2) + 2);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "chain_epochs_salt_unica"
  ON "chain_epochs" ("account_salt");
CREATE UNIQUE INDEX IF NOT EXISTS "chain_epochs_rango_unico"
  ON "chain_epochs" ("chain_id", "from_seq", "to_seq");

CREATE TABLE IF NOT EXISTS "chain_reconciliation_runs" (
  "id"           text    PRIMARY KEY NOT NULL,
  "epoch_id"     text    NOT NULL,
  "status"       text    NOT NULL,
  "local_root"   text,
  "onchain_root" text,
  "diff_count"   integer NOT NULL DEFAULT 0,
  "entries_read" integer,
  "error"        text,
  "started_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "finished_at"  timestamp with time zone,
  CONSTRAINT "chain_reconciliation_status_valido"
    CHECK ("status" = ANY (ARRAY['OK'::text, 'MISMATCH'::text, 'ERROR'::text])),
  CONSTRAINT "chain_reconciliation_runs_epoch_id_fkey"
    FOREIGN KEY ("epoch_id") REFERENCES "chain_epochs"("id")
);

CREATE INDEX IF NOT EXISTS "chain_reconciliation_por_epoch"
  ON "chain_reconciliation_runs" ("epoch_id", "started_at" DESC);
