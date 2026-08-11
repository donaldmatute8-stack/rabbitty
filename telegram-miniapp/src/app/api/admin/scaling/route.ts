import { NextRequest, NextResponse } from "next/server";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from "drizzle-orm";
import * as coreSchema from "@rabbitty/database-core";
import { getVerifiedAdminId, isAdminAllowed } from "@/lib/adminAuth";

const TELEGRAM_ALERT_CHAT = process.env.SCALING_ALERT_CHAT_ID || "@mardelbull";

const THRESHOLDS = {
  users: { max: 5000, label: "Usuarios Registrados", unit: "usuarios", icon: "👤" },
  businesses: { max: 100, label: "Negocios Activos", unit: "", icon: "🏪" },
  monthlyTxns: { max: 50000, label: "Transacciones/Mes", unit: "txns", icon: "💳" },
  monthlyOrders: { max: 25000, label: "Ordenes POS/Mes", unit: "ordenes", icon: "📋" },
  dbSize: { max: 2048, label: "Base de Datos", unit: "MB", icon: "🗄️" },
};

function getDb() {
  const url = process.env.CORE_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("No database URL");
  const pool = new Pool({
    connectionString: url,
    ssl: url.includes("neon.tech") || process.env.NODE_ENV === "production"
      ? true : false,
  });
  return drizzle(pool, { schema: coreSchema });
}

async function sendTelegramAlert(metrics: { label: string; pct: number }[]) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return;
    const msg = `🚨 *Alerta de Escalado - Rabbitty*\n\nLas siguientes metricas han superado el 80%:\n\n${metrics.map(m => `• ${m.label}: ${m.pct.toFixed(0)}%`).join("\n")}\n\n_Revisa el panel de administración para mas detalles._`;
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_ALERT_CHAT, text: msg, parse_mode: "Markdown" }),
    });
  } catch (e) {
    console.error("Failed to send Telegram alert:", e);
  }
}

export async function GET(req: NextRequest) {
  if (!isAdminAllowed(getVerifiedAdminId(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const db = getDb();

    const { rows: [userCount] } = await db.execute(sql`SELECT COUNT(*)::int as count FROM users`);
    const { rows: [bizCount] } = await db.execute(sql`SELECT COUNT(*)::int as count FROM "ownedBusinesses"`);
    const { rows: [txnCount] } = await db.execute(sql`SELECT COUNT(*)::int as count FROM transactions WHERE "createdAt" > NOW() - INTERVAL '30 days'`);
    const { rows: [dbSize] } = await db.execute(sql`SELECT pg_database_size(current_database())::int / (1024*1024) as size_mb`);

    let orderCount = { count: 0 };
    try {
      const restUrl = process.env.RESTAURANT_DATABASE_URL;
      if (restUrl) {
        const restPool = new Pool({
          connectionString: restUrl,
          ssl: restUrl.includes("neon.tech") || process.env.NODE_ENV === "production"
            ? { rejectUnauthorized: false } : false,
        });
        const restDb = drizzle(restPool);
        const { rows: [res] } = await restDb.execute(sql`SELECT COUNT(*)::int as count FROM orders WHERE "createdAt" > NOW() - INTERVAL '30 days'`);
        orderCount = res as any;
        await restPool.end();
      }
    } catch {}

    const metrics = [
      { key: "users", ...THRESHOLDS.users, value: (userCount as any).count, pct: Math.min(100, ((userCount as any).count / THRESHOLDS.users.max) * 100) },
      { key: "businesses", ...THRESHOLDS.businesses, value: (bizCount as any).count, pct: Math.min(100, ((bizCount as any).count / THRESHOLDS.businesses.max) * 100) },
      { key: "monthlyTxns", ...THRESHOLDS.monthlyTxns, value: (txnCount as any).count, pct: Math.min(100, ((txnCount as any).count / THRESHOLDS.monthlyTxns.max) * 100) },
      { key: "monthlyOrders", ...THRESHOLDS.monthlyOrders, value: orderCount.count, pct: Math.min(100, (orderCount.count / THRESHOLDS.monthlyOrders.max) * 100) },
      { key: "dbSize", ...THRESHOLDS.dbSize, value: (dbSize as any).size_mb, pct: Math.min(100, ((dbSize as any).size_mb / THRESHOLDS.dbSize.max) * 100) },
    ];

    const over80 = metrics.filter(m => m.pct >= 80);
    if (over80.length > 0) {
      await sendTelegramAlert(over80);
    }

    await db.$client.end();

    return NextResponse.json({ metrics, alertTriggered: over80.length > 0 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
