import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Strip `sslmode` from the connection string: pg-connection-string v2.9+ warns
// that 'require'/'prefer' are aliases for 'verify-full' and will change in v3.
// TLS is configured explicitly below, so the query param is redundant.
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

const dbUrl = stripSslMode(
  process.env.CORE_DATABASE_URL || process.env.RESTAURANT_DATABASE_URL || process.env.DATABASE_URL,
);

const pool = new Pool({
  connectionString: dbUrl,
  ssl: dbUrl && (dbUrl.includes('neon.tech') || process.env.NODE_ENV === 'production')
    ? { rejectUnauthorized: false }
    : false,
});

export const db = drizzle(pool, { schema });
