import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@rabbitty/database-restaurant/schema';
import { resolveDbUrl, logDbResolution } from './config';

// Ver `./config`: fail-fast si falta la URL en runtime desplegado (sin esto,
// `pg` apunta en silencio a 127.0.0.1:5432 y el checkout/POS revientan con
// ECONNREFUSED en lugar de un error de configuración legible).
//
// Mientras core y restaurante vivan en la MISMA base (hoy: un solo `neondb`),
// `CORE_DATABASE_URL` sirve de último recurso: así un entorno sólo necesita UNA
// variable y nadie puede dejar el lado restaurante sin conexión por olvidar la
// segunda (eso tumbó el pedido del cliente el 2026-11-17).
const resolved = resolveDbUrl(
  [
    ['RESTAURANT_DATABASE_URL', process.env.RESTAURANT_DATABASE_URL],
    ['DATABASE_URL', process.env.DATABASE_URL],
    ['CORE_DATABASE_URL', process.env.CORE_DATABASE_URL],
  ],
  'restaurant',
);
logDbResolution('restaurant', resolved);
const dbUrl = resolved.url;

export const restaurantPool = new Pool({
  connectionString: dbUrl,
  ssl: dbUrl && (dbUrl.includes('neon.tech') || process.env.NODE_ENV === 'production')
    ? { rejectUnauthorized: false }
    : false,
});

export const restaurantDb = drizzle(restaurantPool, { schema });
