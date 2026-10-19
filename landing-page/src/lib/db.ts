import postgres from 'postgres';

const dbUrl = process.env.CORE_DATABASE_URL || process.env.POSTGRES_URL;

export const sql = dbUrl
  ? postgres(dbUrl, {
      ssl: 'require',
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
    })
  : null;
