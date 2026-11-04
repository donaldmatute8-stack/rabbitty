-- 0040_pos_terminals_and_niches.sql
-- Base del refactor POS/Admin + Paso 0 de NICHOS.
--
-- TODO es ADITIVO: tablas nuevas y columnas nullable. No cambia el
-- comportamiento actual (en producción el POS sigue usando la sesión de admin
-- hasta que el flag terminal_sessions esté activo).

-- ── PASO 0 · Nichos ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "niches" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "icon" text,
  "order" integer NOT NULL DEFAULT 0,
  "isActive" boolean NOT NULL DEFAULT true,
  -- Qué necesita el POS para este nicho (mesas, cocina, citas, inventario…).
  "capabilities" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" timestamp DEFAULT now()
);

ALTER TABLE "ownedBusinesses" ADD COLUMN IF NOT EXISTS "niche" text;

-- ── Terminales POS (Nivel A) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "pos_terminals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "businessId" uuid,
  "branchId" text,
  "name" text NOT NULL,
  "platform" text,
  -- Hash del secreto del dispositivo (NUNCA el secreto en claro).
  "deviceKeyHash" text NOT NULL,
  -- ACTIVE | REVOKED
  "status" text NOT NULL DEFAULT 'ACTIVE',
  "authorizedBy" uuid,
  "authorizedAt" timestamp DEFAULT now(),
  -- Autorización con vencimiento (se renueva desde el móvil del admin).
  "expiresAt" timestamp,
  "lastSeenAt" timestamp,
  "revokedAt" timestamp,
  "revokedBy" uuid
);

CREATE UNIQUE INDEX IF NOT EXISTS "pos_terminals_device_uq" ON "pos_terminals" ("deviceKeyHash");
CREATE INDEX IF NOT EXISTS "pos_terminals_branch_idx" ON "pos_terminals" ("branchId");

-- Sesión de TERMINAL (independiente del admin). El POS la usa para operar.
CREATE TABLE IF NOT EXISTS "pos_terminal_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "terminalId" uuid NOT NULL,
  "token" text NOT NULL UNIQUE,
  "expiresAt" timestamp NOT NULL,
  "createdAt" timestamp DEFAULT now(),
  "revokedAt" timestamp
);

CREATE INDEX IF NOT EXISTS "pos_terminal_sessions_terminal_idx" ON "pos_terminal_sessions" ("terminalId");

-- ── Sesión OPERATIVA del empleado (Nivel B) ────────────────────────────────
-- Usa el PIN individual que YA existe en staff.pinCode.
CREATE TABLE IF NOT EXISTS "pos_operator_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "terminalId" uuid NOT NULL,
  "staffId" text NOT NULL,
  "token" text NOT NULL UNIQUE,
  "startedAt" timestamp DEFAULT now(),
  "lastSeenAt" timestamp DEFAULT now(),
  "endedAt" timestamp
);

CREATE INDEX IF NOT EXISTS "pos_operator_sessions_terminal_idx" ON "pos_operator_sessions" ("terminalId");

-- ── Solicitudes de reautorización (Nivel C · recuperación) ─────────────────
CREATE TABLE IF NOT EXISTS "pos_auth_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "terminalId" uuid NOT NULL,
  -- Código corto que muestra el POS; de un solo uso y con expiración.
  "code" text NOT NULL UNIQUE,
  "requestedById" text,
  -- PENDING | APPROVED | DENIED | EXPIRED
  "status" text NOT NULL DEFAULT 'PENDING',
  "requestedHours" integer NOT NULL DEFAULT 12,
  "requestedAt" timestamp DEFAULT now(),
  "expiresAt" timestamp NOT NULL,
  "resolvedAt" timestamp,
  "resolvedBy" uuid
);

CREATE INDEX IF NOT EXISTS "pos_auth_requests_status_idx" ON "pos_auth_requests" ("status", "expiresAt");

-- ── Catálogo inicial de nichos ─────────────────────────────────────────────
INSERT INTO "niches" ("id", "name", "icon", "order", "capabilities") VALUES
  ('restaurant', 'Restaurante', 'utensils', 1,
   '{"tables":true,"kitchen":true,"menu":true,"reservations":true,"tips":true,"waiterApp":true,"inventory":true,"recipes":true}'::jsonb),
  ('cafe', 'Cafetería', 'coffee', 2,
   '{"tables":true,"kitchen":false,"menu":true,"reservations":false,"tips":true,"waiterApp":false,"inventory":true,"recipes":false}'::jsonb),
  ('bar', 'Bar', 'wine', 3,
   '{"tables":true,"kitchen":false,"menu":true,"reservations":false,"tips":true,"waiterApp":true,"inventory":true,"recipes":false,"happyHour":true}'::jsonb),
  ('bakery', 'Panadería / Postres', 'croissant', 4,
   '{"tables":false,"kitchen":false,"menu":true,"reservations":false,"tips":false,"inventory":true,"recipes":false}'::jsonb),
  ('pizza', 'Pizzería', 'pizza', 5,
   '{"tables":true,"kitchen":true,"menu":true,"reservations":false,"tips":true,"inventory":true,"recipes":true}'::jsonb),
  ('tacos', 'Taquería / Antojitos', 'flame', 6,
   '{"tables":true,"kitchen":true,"menu":true,"reservations":false,"tips":true,"inventory":true,"recipes":false}'::jsonb),
  ('barbershop', 'Barbería / Estética', 'scissors', 7,
   '{"tables":false,"kitchen":false,"menu":true,"reservations":true,"tips":true,"services":true,"staffCommission":true}'::jsonb),
  ('fitness', 'Gym / Fitness', 'dumbbell', 8,
   '{"tables":false,"kitchen":false,"menu":true,"reservations":true,"tips":false,"memberships":true,"services":true}'::jsonb),
  ('retail', 'Tienda / Retail', 'shopping-bag', 9,
   '{"tables":false,"kitchen":false,"menu":true,"reservations":false,"tips":false,"inventory":true,"barcode":true}'::jsonb),
  ('services', 'Servicios / Citas', 'calendar', 10,
   '{"tables":false,"kitchen":false,"menu":true,"reservations":true,"tips":true,"services":true,"staffCommission":true}'::jsonb),
  ('other', 'Otro', 'store', 99, '{}'::jsonb)
ON CONFLICT ("id") DO NOTHING;

-- Backfill conservador: el nicho actual se deriva de la categoría existente.
UPDATE "ownedBusinesses" SET "niche" = 'restaurant'
WHERE "niche" IS NULL AND "category" ILIKE '%restaurant%';
UPDATE "ownedBusinesses" SET "niche" = 'cafe'
WHERE "niche" IS NULL AND ("category" ILIKE '%caf%' OR "category" ILIKE '%cafeter%');
UPDATE "ownedBusinesses" SET "niche" = 'bar'
WHERE "niche" IS NULL AND ("category" ILIKE '%bar%' OR "category" ILIKE '%cantina%');
UPDATE "ownedBusinesses" SET "niche" = 'fitness'
WHERE "niche" IS NULL AND ("category" ILIKE '%fit%' OR "category" ILIKE '%gym%' OR "category" ILIKE '%crossfit%');
UPDATE "ownedBusinesses" SET "niche" = 'barbershop'
WHERE "niche" IS NULL AND ("category" ILIKE '%barber%' OR "category" ILIKE '%est%tica%');
UPDATE "ownedBusinesses" SET "niche" = 'other'
WHERE "niche" IS NULL;
