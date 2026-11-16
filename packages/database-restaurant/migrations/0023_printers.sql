-- Catálogo de impresoras por sucursal (2026-11-16). Aditivo.
CREATE TABLE IF NOT EXISTS "printers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "branchId" text NOT NULL REFERENCES "branches"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "role" text NOT NULL DEFAULT 'RECEIPT',      -- RECEIPT | KITCHEN | BAR | EXPO
  "connection" text NOT NULL DEFAULT 'BLE',    -- BLE | SPP | USB | NETWORK
  "identifier" text,                           -- MAC / nombre BLE / IP
  "paperWidth" integer NOT NULL DEFAULT 58,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp DEFAULT now(),
  "updatedAt" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "printers_branch_idx" ON "printers" ("branchId");
