import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as restaurantSchema from "@rabbitty/database-restaurant";

let client: ReturnType<typeof postgres> | null = null;

export function getTestDb() {
  const url = process.env.RESTAURANT_DATABASE_URL;
  if (!url) throw new Error("RESTAURANT_DATABASE_URL not set");
  if (!client) {
    client = postgres(url);
  }
  return drizzle(client, { schema: restaurantSchema });
}

export async function closeTestDb() {
  if (client) await client.end();
}

export async function createTestContext() {
  const db = getTestDb();
  return {
    userId: "test-user",
    user: { id: "test-user", name: "Test", email: "test@rabbitty.me" },
    restaurantDb: db,
    coreDb: db,
    branchId: process.env.BRANCH_ID ?? "b1",
  };
}
