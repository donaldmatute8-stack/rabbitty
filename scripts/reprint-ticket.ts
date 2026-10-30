/**
 * Reimpresión de ticket — lee la conexión EXCLUSIVAMENTE de CORE_DATABASE_URL.
 * Nunca hardcodear credenciales (STRIX-0002).
 * Uso: CORE_DATABASE_URL="postgres://..." npx tsx scripts/reprint-ticket.ts <orderId>
 */
import { Pool } from "pg";

async function main() {
  const orderId = process.argv[2];
  const coreUrl = process.env.CORE_DATABASE_URL;
  const restaurantUrl = process.env.RESTAURANT_DATABASE_URL;
  if (!orderId || !coreUrl || !restaurantUrl) {
    console.error("Uso: CORE_DATABASE_URL=... RESTAURANT_DATABASE_URL=... npx tsx scripts/reprint-ticket.ts <orderId>");
    process.exit(1);
  }
  const core = new Pool({ connectionString: coreUrl, max: 1 });
  const rest = new Pool({ connectionString: restaurantUrl, max: 1 });
  try {
    const [order] = (await rest.query(`SELECT * FROM orders WHERE id = $1`, [orderId])).rows;
    if (!order) throw new Error("Orden no encontrada");
    console.log(JSON.stringify({ id: order.id, total: order.total, status: order.status, bunzReward: order.bunzReward }, null, 2));
  } finally {
    await core.end();
    await rest.end();
  }
}
main();
