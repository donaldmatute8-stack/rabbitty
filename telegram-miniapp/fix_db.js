const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
async function run() {
  const client = await pool.connect();
  try {
    await client.query('ALTER TABLE "ownedBusinesses" ADD COLUMN "rarity" text DEFAULT \'common\' NOT NULL;');
    console.log("Column added!");
  } catch (e) {
    console.error(e.message);
  } finally {
    client.release();
    await pool.end();
  }
}
run();
