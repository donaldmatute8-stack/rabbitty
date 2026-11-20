import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { resolveDbUrl, logDbResolution, needsSsl } from './config';

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
  ssl: needsSsl(dbUrl) ? { rejectUnauthorized: false } : false,
});

export const db = drizzle(pool, { schema });

// Columnas de soporte (SLA) en `conversations`: el esquema compartido las
// declara, así que deben existir antes de cualquier SELECT. Idempotente y
// best-effort: si falla, las consultas de soporte fallarán pero el resto de la
// app sigue funcionando.
const SUPPORT_COLUMNS = [
  `ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "supportStatus" text DEFAULT 'OPEN' NOT NULL`,
  `ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "supportPriority" text DEFAULT 'NORMAL' NOT NULL`,
  `ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "supportFirstResponseAt" timestamp`,
  `ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "supportResolvedAt" timestamp`,
  `ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "supportAssignee" text`,
];
void (async () => {
  for (const statement of SUPPORT_COLUMNS) {
    try {
      await pool.query(statement);
    } catch (err) {
      console.error('[DB] support column migration failed:', err);
    }
  }
})();

/** De dónde salió la conexión (para `/api/health?config=1`, sin tocar la base). */
export const coreDbConfig = { source: resolved.source, missing: resolved.missing };
