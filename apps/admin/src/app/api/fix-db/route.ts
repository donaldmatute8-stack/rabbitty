import { NextResponse } from "next/server";
import * as schemaCore from "@rabbitty/database-core/schema";
import * as schemaRest from "@rabbitty/database-restaurant/schema";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { drizzle as drizzleRest } from "drizzle-orm/postgres-js";
import { drizzle as drizzleCore } from "drizzle-orm/postgres-js";

export async function GET() {
  try {
    const url = process.env.RESTAURANT_DATABASE_URL || process.env.DATABASE_URL || process.env.CORE_DATABASE_URL;
    if (!url) throw new Error("No database URL");
    const client = postgres(url);
    const coreDb = drizzleCore(client, { schema: schemaCore });
    const restDb = drizzleRest(client, { schema: schemaRest });


    // 1. Create a dummy user
    const users = await coreDb.select().from(schemaCore.users);
    let userId = users.length > 0 ? users[0].id : "u1";
    if (users.length === 0) {
      await coreDb.insert(schemaCore.users).values({
        id: userId,
        username: "admin",
        firstName: "Admin",
        telegramId: "123",
        role: "ADMIN"
      }).onConflictDoNothing();
    }

    // 2. Create the business
    const businesses = await coreDb.select().from(schemaCore.ownedBusinesses);
    let businessId = businesses.length > 0 ? businesses[0].id : "b1";
    if (businesses.length === 0) {
      await coreDb.insert(schemaCore.ownedBusinesses).values({
        id: businessId,
        ownerId: userId,
        name: "Rabbitty Restaurant",
        category: "Food",
        address: "123 Main St",
        lat: 0,
        lng: 0,
        status: "APPROVED"
      }).onConflictDoNothing();
    }

    // 3. Create the restaurant
    const restaurants = await restDb.select().from(schemaRest.restaurants);
    let restaurantId = restaurants.length > 0 ? restaurants[0].id : "r1";
    if (restaurants.length === 0) {
      await restDb.insert(schemaRest.restaurants).values({
        id: restaurantId,
        businessId: businessId,
        name: "Rabbitty Restaurant",
        slug: "rabbitty-restaurant",
        isActive: true,
      }).onConflictDoNothing();
    }

    // 4. Create the branch 0b0b...
    const branchId = "0b0b7813-f0e0-45e1-abb8-f6639efd1244";
    const branches = await restDb.select().from(schemaRest.branches).where(eq(schemaRest.branches.id, branchId));
    let msg = "Branch already existed";
    if (branches.length === 0) {
      await restDb.insert(schemaRest.branches).values({
        id: branchId,
        restaurantId: restaurantId,
        name: "Sucursal Principal",
        address: "Address 1",
        isActive: true,
      }).onConflictDoNothing();
      msg = "Branch created successfully!";
    }

    return NextResponse.json({ success: true, message: msg });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}
