import { NextResponse } from "next/server";
import { auth } from "@rabbitty/auth";
import { getRestaurantDb, getCoreDb } from "@rabbitty/api/db";
import { users } from "@rabbitty/database-core";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const coreDb = getCoreDb();
    const [dbUser] = await coreDb.select().from(users).where(eq(users.id, session.user.id));
    if (!dbUser || dbUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = getRestaurantDb();

    // Add missing columns safely if they don't exist
    await db.execute(sql`
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
      ALTER TABLE "menu_item_ingredients" ADD COLUMN IF NOT EXISTS "subRecipeId" text;
      ALTER TABLE "menu_item_ingredients" ALTER COLUMN "inventoryItemId" DROP NOT NULL;
      ALTER TABLE "menu_item_ingredients" ALTER COLUMN "subRecipeId" DROP NOT NULL;
    `);

    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'menu_item_ingredients_at_least_one_check'
        ) THEN
          ALTER TABLE "menu_item_ingredients"
          ADD CONSTRAINT "menu_item_ingredients_at_least_one_check"
          CHECK (("inventoryItemId" IS NOT NULL) OR ("subRecipeId" IS NOT NULL));
        END IF;
      END $$;
    `);

    return NextResponse.json({ success: true, message: "Base de datos migrada exitosamente" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
