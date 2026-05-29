import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

require('dotenv').config({ path: '.env.local' });

async function migrate() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();
  try {
    const sqlPath = path.join(__dirname, 'gamification_migration.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    
    console.log('Running migration...');
    await client.query(sql);
    console.log('Migration successful!');
  } catch (e) {
    console.error('Migration failed', e);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
