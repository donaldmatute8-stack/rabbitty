import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { resolveDbUrl, logDbResolution } from './config';

// La URL se resuelve en `./config`: si falta en runtime desplegado lanza un
// error de configuración explícito en vez de dejar que `pg` caiga a localhost.
const resolved = resolveDbUrl(
  [
    ['CORE_DATABASE_URL', process.env.CORE_DATABASE_URL],
    ['RESTAURANT_DATABASE_URL', process.env.RESTAURANT_DATABASE_URL],
    ['DATABASE_URL', process.env.DATABASE_URL],
  ],
  'core',
);
logDbResolution('core', resolved);
const dbUrl = resolved.url;

export const pool = new Pool({
  connectionString: dbUrl,
  ssl: dbUrl && (dbUrl.includes('neon.tech') || process.env.NODE_ENV === 'production')
    ? { rejectUnauthorized: false }
    : false,
});

export const db = drizzle(pool, { schema });
