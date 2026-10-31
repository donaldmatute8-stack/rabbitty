import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@rabbitty/database-restaurant/schema';

function stripSslMode(raw?: string): string | undefined {
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    if (!url.searchParams.has('sslmode')) return raw;
    url.searchParams.delete('sslmode');
    return url.toString();
  } catch {
    return raw;
  }
}

const dbUrl = stripSslMode(process.env.RESTAURANT_DATABASE_URL || process.env.DATABASE_URL);

const pool = new Pool({
  connectionString: dbUrl,
  ssl: dbUrl && (dbUrl.includes('neon.tech') || process.env.NODE_ENV === 'production')
    ? { rejectUnauthorized: false }
    : false,
});

export const restaurantDb = drizzle(pool, { schema });
