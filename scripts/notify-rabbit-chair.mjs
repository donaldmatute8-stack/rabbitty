#!/usr/bin/env node
/**
 * ── Aviso de lanzamiento: Rabbit Chair ──────────────────────────────────────
 * Prepara (y opcionalmente envía) la notificación a los negocios sobre la
 * nueva experiencia. Pensado para correrse a mano cuando se autorice.
 *
 *   node scripts/notify-rabbit-chair.mjs --business <id>            (dry-run)
 *   node scripts/notify-rabbit-chair.mjs --business <id> --send
 *
 * Requiere: CORE_DATABASE_URL (o DATABASE_URL), y para enviar push:
 * RABBITTY_MINIAPP_URL (default https://app.rabbitty.me) + PUSH_SEND_SECRET.
 *
 * Escribe en `notifications` (in-app) y, con --send, dispara el push de la app.
 * No toca nada más del negocio.
 */
import crypto from "node:crypto";
import postgres from "postgres";

const args = process.argv.slice(2);
const val = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const has = (name) => args.includes(name);

const businessIds = args.filter((a, i) => i > 0 && args[i - 1] === "--business").filter(Boolean);
const send = has("--send");

if (businessIds.length === 0) {
  console.error("Uso: node scripts/notify-rabbit-chair.mjs --business <businessId> [--business <id>] [--send]");
  process.exit(1);
}

const url = process.env.CORE_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("Falta CORE_DATABASE_URL o DATABASE_URL");
  process.exit(1);
}

const TITLE = "La Silla llegó a Rabbitty";
const MESSAGE =
  "Rabbit Chair ya está en tu panel. Una silla, una luz y diez minutos: configura tu experiencia en Ajustes → Rabbit Chair.";

const sql = postgres(url, { max: 1 });
const appUrl = (process.env.RABBITTY_MINIAPP_URL || "https://app.rabbitty.me").replace(/\/$/, "");
const pushSecret = process.env.PUSH_SECRET || process.env.PUSH_SEND_SECRET;

for (const businessId of businessIds) {
  const [biz] = await sql`SELECT id, name, "ownerId" FROM "ownedBusinesses" WHERE id = ${businessId} LIMIT 1`;
  if (!biz) {
    console.log(`✗ ${businessId}: negocio no encontrado`);
    continue;
  }
  const [owner] = await sql`SELECT id, email FROM users WHERE id = ${biz.ownerId} LIMIT 1`;
  if (!owner) {
    console.log(`✗ ${biz.name}: sin usuario dueño`);
    continue;
  }

  console.log(`▸ ${biz.name} · dueño ${owner.email ?? owner.id}`);
  console.log(`  título:  ${TITLE}`);
  console.log(`  mensaje: ${MESSAGE}`);

  if (!send) {
    console.log("  (dry-run: no se escribe ni se envía nada)\n");
    continue;
  }

  await sql`
    INSERT INTO notifications ("id", "userId", "title", "message", "type", "route", "isRead", "createdAt")
    VALUES (${crypto.randomUUID()}, ${owner.id}, ${TITLE}, ${MESSAGE}, 'SYSTEM', '/', false, now())
  `;

  if (pushSecret) {
    const res = await fetch(`${appUrl}/api/notifications/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-push-secret": pushSecret },
      body: JSON.stringify({ userId: owner.id, title: TITLE, body: MESSAGE, data: { type: "SYSTEM", route: "/" } }),
    }).catch(() => null);
    console.log(`  push: ${res?.ok ? "enviado" : "falló"}`);
  } else {
    console.log("  push: omitido (falta PUSH_SEND_SECRET)");
  }
  console.log("");
}

await sql.end();
