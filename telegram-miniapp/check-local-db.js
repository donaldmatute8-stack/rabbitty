const { Database } = require('drizzle-orm/libsql');
const { createClient } = require('@libsql/client');

async function run() {
  try {
    const client = createClient({ url: 'file:./dev.db' });
    const res = await client.execute('SELECT * FROM "ownedBusinesses"');
    console.log('Local SQLite ownedBusinesses count:', res.rows.length);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  }
}

run();
