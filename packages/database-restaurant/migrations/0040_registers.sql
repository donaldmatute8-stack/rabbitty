-- 0040 · Catálogo de cajas (registers)
--
-- Por qué: `cash_shifts.registerId` y `pos_terminals.registerId` ya distinguen
-- cajas, pero como texto libre ("MAIN"). Sin catálogo no se puede nombrar una
-- caja, asignarle terminales ni saber qué cajas existen en la sucursal.
--
-- Decisión: `registers.code` es el valor que guardan las terminales y los
-- turnos (compatibilidad total con "MAIN"). `id` es interno. No hay FK desde
-- `registerId` para no romper datos existentes.
--
-- Aditiva e idempotente.

CREATE TABLE IF NOT EXISTS "registers" (
  "id"         text PRIMARY KEY,
  "branchId"   text NOT NULL REFERENCES "branches"("id") ON DELETE CASCADE,
  "code"       text NOT NULL,
  "name"       text NOT NULL,
  "location"   text,
  "isActive"   boolean NOT NULL DEFAULT true,
  "sortOrder"  integer NOT NULL DEFAULT 0,
  "createdAt"  timestamp DEFAULT now(),
  "updatedAt"  timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "registers_branch_code_uidx"
  ON "registers" ("branchId", lower("code"));

CREATE INDEX IF NOT EXISTS "registers_branch_idx"
  ON "registers" ("branchId", "isActive", "sortOrder");

-- Toda sucursal existente arranca con su caja principal (código MAIN, el mismo
-- que ya usan las terminales y turnos).
INSERT INTO "registers" ("id", "branchId", "code", "name", "sortOrder")
SELECT gen_random_uuid()::text, b.id, 'MAIN', 'Caja principal', 0
  FROM "branches" b
 WHERE NOT EXISTS (
   SELECT 1 FROM "registers" r
    WHERE r."branchId" = b.id AND lower(r."code") = 'main'
 );
