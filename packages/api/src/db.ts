import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as restaurantSchema from "@rabbitty/database-restaurant";
import * as coreSchema from "@rabbitty/database-core";

let restaurantClient: ReturnType<typeof postgres> | null = null;
let restaurantDbInstance: ReturnType<typeof drizzle> | null = null;
let coreClient: ReturnType<typeof postgres> | null = null;
let coreDbInstance: ReturnType<typeof drizzle> | null = null;

let migrationPromise: Promise<void> | null = null;

async function ensureRestaurantColumns(client: ReturnType<typeof postgres>) {
  try {
    await client`
      ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'MXN' NOT NULL;
      ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "taxRate" real DEFAULT 0.16 NOT NULL;
      ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "timezone" text DEFAULT 'America/Mexico_City' NOT NULL;
      ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "defaultRewardRate" integer DEFAULT 20 NOT NULL;
      ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "acceptsBunz" boolean DEFAULT true NOT NULL;
      ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "happyHourStart" text;
      ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "happyHourEnd" text;
      ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "happyHourRewardRate" integer;
      ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "printerType" text;
      ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "printerConfig" jsonb;
      ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "legalName" text;
      ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "rfc" text;
      ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "taxRegime" text;
      ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "logoUrl" text;
      ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "email" text;
      ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "phone" text;
      ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "ticketFooter" text;
    `;
  } catch (e) {
    console.warn("Auto-migration notice (restaurants):", e);
  }
}

export function getRestaurantDb() {
  if (!restaurantDbInstance) {
    const url = process.env.RESTAURANT_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error("RESTAURANT_DATABASE_URL not set");
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
    const url = process.env.CORE_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error("CORE_DATABASE_URL not set");
    coreClient = postgres(url);
    coreDbInstance = drizzle(coreClient, { schema: coreSchema });
  }
  return coreDbInstance;
}

export async function closeRestaurantDb() {
  if (restaurantClient) await restaurantClient.end();
}

export async function closeCoreDb() {
  if (coreClient) await coreClient.end();
}
