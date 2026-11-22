-- ── Marketplaces (Uber Eats y futuros agregadores) ──────────────────────────
--
-- Hasta hoy el único ingreso de pedidos externos era un webhook con bearer
-- estático que metía órdenes con `menuItemId` placeholder y sin canal, así que
-- cocina veía un UUID y no había forma de conciliar ni de marcar prepagado.
--
-- Este bloque deja la base lista para la Marketplace API de Uber Eats:
--   · conexión por sucursal (storeId de Uber, estado, modo de reparto)
--   · mapeo de catálogo (item de Uber ↔ platillo de Rabbitty)
--   · bitácora de webhooks (idempotencia y auditoría)
--   · canal y snapshot de nombre en la orden (comanda legible sin depender de
--     que el platillo exista en nuestro menú)
--
-- Todo es aditivo: ninguna tabla ni columna existente cambia de tipo o sentido.

CREATE TABLE IF NOT EXISTS "aggregator_connections" (
  "id" text PRIMARY KEY,
  "provider" text NOT NULL,
  "branchId" text NOT NULL REFERENCES "branches"("id") ON DELETE CASCADE,
  "storeId" text,
  "status" text NOT NULL DEFAULT 'PENDING',
  "autoAccept" boolean NOT NULL DEFAULT false,
  "menuSyncEnabled" boolean NOT NULL DEFAULT true,
  "deliveryMode" text NOT NULL DEFAULT 'PLATFORM',
  "lastSyncAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "aggregator_connections_provider_branch_uidx"
  ON "aggregator_connections" ("provider", "branchId");

CREATE UNIQUE INDEX IF NOT EXISTS "aggregator_connections_provider_store_uidx"
  ON "aggregator_connections" ("provider", "storeId")
  WHERE "storeId" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "aggregator_menu_map" (
  "id" text PRIMARY KEY,
  "connectionId" text NOT NULL REFERENCES "aggregator_connections"("id") ON DELETE CASCADE,
  "providerItemId" text NOT NULL,
  "providerName" text,
  "menuItemId" text REFERENCES "menu_items"("id") ON DELETE SET NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "aggregator_menu_map_uidx"
  ON "aggregator_menu_map" ("connectionId", "providerItemId");

CREATE INDEX IF NOT EXISTS "aggregator_menu_map_menu_idx"
  ON "aggregator_menu_map" ("menuItemId");

CREATE TABLE IF NOT EXISTS "aggregator_webhook_events" (
  "id" text PRIMARY KEY,
  "provider" text NOT NULL,
  "eventType" text,
  "externalId" text,
  "storeId" text,
  "payload" jsonb,
  "processed" boolean NOT NULL DEFAULT false,
  "error" text,
  "receivedAt" timestamp NOT NULL DEFAULT now()
);

-- Un mismo evento de Uber puede reintentarse: solo se procesa una vez.
CREATE UNIQUE INDEX IF NOT EXISTS "aggregator_webhook_events_uidx"
  ON "aggregator_webhook_events" ("provider", "eventType", "externalId")
  WHERE "externalId" IS NOT NULL;

-- Canal comercial de la orden: POS, APP, UBER_EATS, UBER_DIRECT, RAPPI…
-- Sirve para pintar el origen en POS/KDS y para no volver a cobrar un pedido
-- que el marketplace ya cobró.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "channel" text;

-- Nombre del platillo tal como lo mandó el marketplace (o el POS). El ticket y
-- la comanda lo usan cuando el item no existe en nuestro menú.
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "nameSnapshot" text;

-- Un pedido externo no puede duplicarse si el proveedor reintenta el webhook.
CREATE UNIQUE INDEX IF NOT EXISTS "orders_external_provider_id_uidx"
  ON "orders" ("externalProvider", "externalId")
  WHERE "externalId" IS NOT NULL;

COMMENT ON TABLE "aggregator_connections" IS
  'Conexión de una sucursal con un marketplace (Uber Eats). storeId = id de la tienda en el proveedor.';
COMMENT ON TABLE "aggregator_menu_map" IS
  'Mapeo catálogo del marketplace ↔ menú Rabbitty. Sin mapeo se usa el nombre del proveedor y un item placeholder.';
COMMENT ON TABLE "aggregator_webhook_events" IS
  'Bitácora de webhooks de agregadores: idempotencia, auditoría y reintentos.';
