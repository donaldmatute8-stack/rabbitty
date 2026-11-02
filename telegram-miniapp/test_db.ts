import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './src/db/schema';
import { desc } from "drizzle-orm";

async function main() {
  const dbUrl = process.env.CORE_DATABASE_URL;
  console.log("Connecting with URL host:", dbUrl ? new URL(dbUrl).host : "NONE");
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });
  const db = drizzle(pool, { schema });
  const devices = await db
    .select({
      platform: schema.pushDevices.platform,
      isActive: schema.pushDevices.isActive,
      token: schema.pushDevices.token,
      userId: schema.pushDevices.userId,
      updatedAt: schema.pushDevices.updatedAt,
    })
    .from(schema.pushDevices)
    .orderBy(desc(schema.pushDevices.updatedAt))
    .limit(10);
  console.log("DEVICES_FOUND:", JSON.stringify(devices, null, 2));
  await pool.end();
}
main().catch(err => {
  console.error("DB Error:", err);
  process.exit(1);
});
