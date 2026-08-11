import { NextResponse } from "next/server";
import { getRestaurantDb } from "@rabbitty/api/db";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
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
    `);

    return NextResponse.json({ success: true, message: "Base de datos migrada exitosamente" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
