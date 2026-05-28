import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

const dbUrl = process.env.NODE_ENV === "development" ? "file:./dev.db" : (process.env.DATABASE_URL || "file:./dev.db");

const client = createClient({
  url: dbUrl,
});

export const db = drizzle(client, { schema });
