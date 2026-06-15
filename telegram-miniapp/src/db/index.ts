import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const dbUrl = process.env.CORE_DATABASE_URL || process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: dbUrl,
  ssl: dbUrl && (dbUrl.includes('neon.tech') || process.env.NODE_ENV === 'production')
    ? { rejectUnauthorized: true }
    : false,
});

export const db = drizzle(pool, { schema });
