import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as restaurantSchema from "@rabbitty/database-restaurant";
import * as coreSchema from "@rabbitty/database-core";

let restaurantClient: ReturnType<typeof postgres> | null = null;
let restaurantDbInstance: ReturnType<typeof drizzle> | null = null;
let coreClient: ReturnType<typeof postgres> | null = null;
let coreDbInstance: ReturnType<typeof drizzle> | null = null;

let migrationPromise: Promise<void> | null = null;
let coreMigrationPromise: Promise<void> | null = null;

// Columnas de CORE que se agregan de forma idempotente al arrancar el admin.
// El esquema de core no tiene runner de migraciones en el deploy, así que las
// columnas nuevas de soporte se aseguran aquí (ADD COLUMN IF NOT EXISTS).
const CORE_COLUMNS: string[] = [
  `ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "supportStatus" text DEFAULT 'OPEN' NOT NULL`,
  `ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "supportPriority" text DEFAULT 'NORMAL' NOT NULL`,
  `ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "supportFirstResponseAt" timestamp`,
  `ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "supportResolvedAt" timestamp`,
  `ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "supportAssignee" text`,
];

async function ensureCoreColumns(client: ReturnType<typeof postgres>) {
  for (const statement of CORE_COLUMNS) {
    try {
      await client.unsafe(statement);
    } catch (err) {
      console.error("[DB] core column migration failed:", statement, err);
    }
  }
}

const RESTAURANT_COLUMNS: string[] = [
  `ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'MXN' NOT NULL`,
  `ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "taxRate" real DEFAULT 0.16 NOT NULL`,
  `ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "timezone" text DEFAULT 'America/Mexico_City' NOT NULL`,
  `ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "defaultRewardRate" integer DEFAULT 20 NOT NULL`,
  `ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "acceptsBunz" boolean DEFAULT true NOT NULL`,
  `ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "happyHourStart" text`,
  `ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "happyHourEnd" text`,
  `ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "happyHourRewardRate" integer`,
  `ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "printerType" text`,
  `ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "printerConfig" jsonb`,
  `ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "legalName" text`,
  `ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "rfc" text`,
  `ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "taxRegime" text`,
  `ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "logoUrl" text`,
  `ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "email" text`,
  `ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "phone" text`,
  `ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "ticketFooter" text`,
  `ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "isActive" boolean DEFAULT true NOT NULL`,
  `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deliveryAddress" text`,
  `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "externalProvider" text`,
  `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deliveryFee" real NOT NULL DEFAULT 0`,
  `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deliveryAddressData" jsonb`,
  `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "prepEtaMinutes" integer`,
  `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "prepEtaAt" timestamp`,
  `ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "feePaidBy" text NOT NULL DEFAULT 'BUSINESS'`,
  `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "externalId" text`,
  `CREATE TABLE IF NOT EXISTS "deliveries" (
    "id" text PRIMARY KEY,
    "orderId" text NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
    "branchId" text NOT NULL,
    "provider" text NOT NULL,
    "providerDeliveryId" text,
    "status" text NOT NULL DEFAULT 'REQUESTED',
    "courierName" text,
    "courierPhone" text,
    "trackingUrl" text,
    "feeCents" integer,
    "currency" text NOT NULL DEFAULT 'MXN',
    "notes" text,
    "externalPayload" jsonb,
    "createdAt" timestamp DEFAULT now(),
    "updatedAt" timestamp DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "deliveries_order_uidx" ON "deliveries" ("orderId")`,
  `CREATE INDEX IF NOT EXISTS "deliveries_status_idx" ON "deliveries" ("status")`,
  `CREATE INDEX IF NOT EXISTS "deliveries_provider_delivery_idx" ON "deliveries" ("providerDeliveryId")`,
  `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "etaMinutes" integer`,
  `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "etaAt" timestamp`,
  `ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "createdAt" timestamp DEFAULT now()`,
  `ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp DEFAULT now()`,
];

async function ensureRestaurantColumns(client: ReturnType<typeof postgres>) {
  // ── DDL EN RUNTIME: apagado por defecto (2026-11-16) ──────────────────────
  //
  // Este bloque hace `ALTER TABLE` / `CREATE TABLE` cuando la app arranca. Eso
  // obliga a que el runtime use el rol DUEÑO de la base, que puede hacer
  // `DROP TABLE`: cualquier bug tiene permiso de destrucción total.
  //
  // El esquema ahora lo gobiernan las migraciones: `preDeployCommand` aplica
  // `packages/*/migrations` y `schema-guard` verifica que el código y la base
  // coincidan antes de promover un despliegue. Por eso el DDL de aquí sobra.
  //
  // Escape hatch: `DB_RUNTIME_DDL=1` lo reactiva (solo para una base nueva sin
  // migraciones). No usarlo en producción.
  if (process.env.DB_RUNTIME_DDL !== "1") return;

  // Configurar client_min_messages = 'warning' para que postgres no envíe spam de
  // NOTICE 42701 ("column already exists, skipping") en los logs de producción (Railway).
  try {
    await client.unsafe("SET client_min_messages = 'warning'");
    for (const statement of RESTAURANT_COLUMNS) {
      await client.unsafe(statement);
    }
  } catch (e) {
    console.warn("Auto-migration notice (restaurants):", e);
  } finally {
    try {
      await client.unsafe("RESET client_min_messages");
    } catch {}
  }
}

export function getRestaurantDb() {
  if (!restaurantDbInstance) {
    const url = process.env.RESTAURANT_DATABASE_URL || process.env.CORE_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) {
      throw new Error(
        "[DB_CONFIG] Falta la conexión a la base de datos del restaurante. " +
          "Define RESTAURANT_DATABASE_URL (o CORE_DATABASE_URL / DATABASE_URL / POSTGRES_URL).",
      );
    }
    restaurantClient = postgres(url);
    restaurantDbInstance = drizzle(restaurantClient, { schema: restaurantSchema });
    if (!migrationPromise) {
      migrationPromise = ensureRestaurantColumns(restaurantClient);
    }
  }
  return restaurantDbInstance;
}

export function getCoreDb() {
  if (!coreDbInstance) {
    const url = process.env.CORE_DATABASE_URL || process.env.RESTAURANT_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) {
      throw new Error(
        "[DB_CONFIG] Falta la conexión a la base de datos core. " +
          "Define CORE_DATABASE_URL (o RESTAURANT_DATABASE_URL / DATABASE_URL / POSTGRES_URL).",
      );
    }
    coreClient = postgres(url);
    coreDbInstance = drizzle(coreClient, { schema: coreSchema });
    if (!coreMigrationPromise) {
      coreMigrationPromise = ensureCoreColumns(coreClient);
    }
  }
  return coreDbInstance;
}

/**
 * Asegura que las columnas de CORE existan antes de consultarlas.
 * El admin arranca la migración al crear la conexión; aquí se espera a que
 * termine para que la primera petición no vea columnas inexistentes.
 */
export async function ensureCoreColumnsReady() {
  const db = getCoreDb();
  if (coreMigrationPromise) await coreMigrationPromise;
  return db;
}

export async function closeRestaurantDb() {
  if (restaurantClient) await restaurantClient.end();
}

export async function closeCoreDb() {
  if (coreClient) await coreClient.end();
}
