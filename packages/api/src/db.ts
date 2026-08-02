import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as restaurantSchema from "@rabbitty/database-restaurant";
import * as coreSchema from "@rabbitty/database-core";

let restaurantClient: ReturnType<typeof postgres> | null = null;
let restaurantDbInstance: ReturnType<typeof drizzle> | null = null;
let coreClient: ReturnType<typeof postgres> | null = null;
let coreDbInstance: ReturnType<typeof drizzle> | null = null;

export function getRestaurantDb() {
  if (!restaurantDbInstance) {
    const url = process.env.RESTAURANT_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error("RESTAURANT_DATABASE_URL not set");
    restaurantClient = postgres(url);
    restaurantDbInstance = drizzle(restaurantClient, { schema: restaurantSchema });
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
