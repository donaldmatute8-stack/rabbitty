import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@rabbitty/database-restaurant/schema';

const dbUrl = process.env.RESTAURANT_DATABASE_URL || process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: dbUrl,
  ssl: dbUrl && (dbUrl.includes('neon.tech') || process.env.NODE_ENV === 'production')
    ? { rejectUnauthorized: true }
    : false,
});

export const restaurantDb = drizzle(pool, { schema });
