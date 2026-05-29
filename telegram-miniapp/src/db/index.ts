import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && (process.env.DATABASE_URL.includes('neon.tech') || process.env.NODE_ENV === 'production')
    ? { rejectUnauthorized: false }
    : false,
});

export const db = drizzle(pool, { schema });
