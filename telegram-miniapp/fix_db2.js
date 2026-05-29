const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE "ownedBusinesses" ADD COLUMN IF NOT EXISTS "givesBunz" boolean DEFAULT true NOT NULL;
      ALTER TABLE "ownedBusinesses" ADD COLUMN IF NOT EXISTS "acceptsBunz" boolean DEFAULT false NOT NULL;
      
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "hasMadeFirstTransaction" boolean DEFAULT false NOT NULL;
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "hasEarnedFirstBunz" boolean DEFAULT false NOT NULL;

      CREATE TABLE IF NOT EXISTS "reservations" (
        "id" text PRIMARY KEY,
        "userId" text NOT NULL,
        "businessId" text NOT NULL,
        "title" text NOT NULL,
        "bunzCost" integer NOT NULL,
        "status" text DEFAULT 'PENDING' NOT NULL,
        "date" timestamp DEFAULT now(),
        "createdAt" timestamp DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "referrals" (
        "id" text PRIMARY KEY,
        "inviterId" text NOT NULL,
        "invitedId" text NOT NULL,
        "status" text DEFAULT 'PENDING' NOT NULL,
        "rewardAmount" integer DEFAULT 50 NOT NULL,
        "createdAt" timestamp DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "notifications" (
        "id" text PRIMARY KEY,
        "userId" text NOT NULL,
        "title" text NOT NULL,
        "message" text NOT NULL,
        "isRead" boolean DEFAULT false NOT NULL,
        "type" text DEFAULT 'SYSTEM' NOT NULL,
        "createdAt" timestamp DEFAULT now()
      );
    `);
    console.log("DB updated successfully!");
  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    await pool.end();
  }
}
run();
