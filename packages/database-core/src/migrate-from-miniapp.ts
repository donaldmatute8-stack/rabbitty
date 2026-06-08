import { drizzle as coreDrizzle } from "drizzle-orm/node-postgres";
import { Pool as CorePool } from "pg";
import { drizzle as miniDrizzle } from "drizzle-orm/node-postgres";
import { Pool as MiniPool } from "pg";
import * as miniSchema from "./miniapp-schema";
import * as coreSchema from "./schema";

const CORE_URL = process.env.CORE_DATABASE_URL;
const MINI_URL = process.env.DATABASE_URL;
if (!CORE_URL) throw new Error("CORE_DATABASE_URL not set");
if (!MINI_URL) throw new Error("DATABASE_URL not set");

const needsSSL = (url: string) => url.includes("neon.tech") || url.includes("ssl");
const corePool = new CorePool({ connectionString: CORE_URL, ssl: needsSSL(CORE_URL) ? { rejectUnauthorized: false } : false });
const miniPool = new MiniPool({ connectionString: MINI_URL, ssl: needsSSL(MINI_URL) ? { rejectUnauthorized: false } : false });
const core = coreDrizzle(corePool, { schema: coreSchema });
const mini = miniDrizzle(miniPool, { schema: miniSchema });

const TABLE_ORDER = [
  "levels",
  "achievements",
  "hatTricks",
  "users",
  "ownedBusinesses",
  "conversations",
  "notifications",
  "qrSessions",
  "referrals",
  "reservations",
  "transactions",
  "messages",
  "pendingVaults",
  "userHatTricks",
  "userAchievements",
  "webSessions",
] as const;

const TABLE_CONFIG: Record<string, { select: any; insert: (row: any) => any }> = {
  levels: {
    select: miniSchema.levels,
    insert: (r: any) => r,
  },
  achievements: {
    select: miniSchema.achievements,
    insert: (r: any) => r,
  },
  hatTricks: {
    select: miniSchema.hatTricks,
    insert: (r: any) => r,
  },
  users: {
    select: miniSchema.users,
    insert: (r: any) => ({
      ...r,
      email: r.email ?? null,
      totalBunzSpent: r.totalBunzSpent ?? 0,
    }),
  },
  ownedBusinesses: {
    select: miniSchema.ownedBusinesses,
    insert: (r: any) => r,
  },
  conversations: {
    select: miniSchema.conversations,
    insert: (r: any) => r,
  },
  notifications: {
    select: miniSchema.notifications,
    insert: (r: any) => r,
  },
  qrSessions: {
    select: miniSchema.qrSessions,
    insert: (r: any) => r,
  },
  referrals: {
    select: miniSchema.referrals,
    insert: (r: any) => r,
  },
  reservations: {
    select: miniSchema.reservations,
    insert: (r: any) => r,
  },
  transactions: {
    select: miniSchema.transactions,
    insert: (r: any) => r,
  },
  messages: {
    select: miniSchema.messages,
    insert: (r: any) => r,
  },
  pendingVaults: {
    select: miniSchema.pendingVaults,
    insert: (r: any) => r,
  },
  userHatTricks: {
    select: miniSchema.userHatTricks,
    insert: (r: any) => r,
  },
  userAchievements: {
    select: miniSchema.userAchievements,
    insert: (r: any) => r,
  },
  webSessions: {
    select: miniSchema.webSessions,
    insert: (r: any) => r,
  },
};

async function migrate() {
  for (const tableName of TABLE_ORDER) {
    const cfg = TABLE_CONFIG[tableName];
    console.log(`Migrating ${tableName}...`);

    const rows = await mini.select().from(cfg.select);
    console.log(`  Read ${rows.length} rows from mini app DB`);

    if (rows.length === 0) {
      console.log(`  Skipping (empty)`);
      continue;
    }

    const chunkSize = 100;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize).map(cfg.insert);
      await core.insert(coreSchema[tableName as keyof typeof coreSchema]).values(chunk as any).onConflictDoNothing();
    }

    console.log(`  Inserted ${rows.length} rows into core DB`);
  }

  console.log("Migration complete!");
}

migrate()
  .catch(console.error)
  .finally(() => {
    corePool.end();
    miniPool.end();
  });
