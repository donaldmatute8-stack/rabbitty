#!/usr/bin/env node
/**
 * ── Anuncio 2: La Silla completa (cobro, radio, reportes) ───────────────────
 *
 *   node scripts/notify-rabbit-chair-update.mjs            (dry-run)
 *   node scripts/notify-rabbit-chair-update.mjs --send
 *   node scripts/notify-rabbit-chair-update.mjs --send --drain
 *
 * Envía:
 *   · in-app + push  → notifications_outbox (el worker entrega)
 *   · correo         → Resend
 *
 * Audiencia: dueños de negocio (ownedBusinesses.ownerId). Excluye negocios de
 * demostración (nombre con demo/test/sandbox) salvo --include-demo.
 *
 * Requiere: CORE_DATABASE_URL, RABBITTY_MINIAPP_URL, RESEND_API_KEY.
 * Para --drain: RABBITTY_API_SECRET o CRON_SECRET.
 */
import postgres from "postgres";

const args = process.argv.slice(2);
const send = args.includes("--send");
const drain = args.includes("--drain");
const includeDemo = args.includes("--include-demo");

const url = process.env.CORE_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("Falta CORE_DATABASE_URL / DATABASE_URL");
  process.exit(1);
}
const resendKey =
  process.env.RESEND_API_KEY || process.env.AUTH_RESEND_KEY || process.env.RESEND_KEY;

const TITLE = "La Silla, ahora completa";
const MESSAGE =
  "Cobro en el POS con tarjeta o efectivo e IVA por renglón, audiencia por radio, " +
  "staff extra con costo, reporte propio con CSV y créditos con historial. " +
  "Entra a tu panel para verlo.";

const EMAIL_HTML = `
<div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#111;max-width:580px;margin:0 auto">
  <p style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#b91c1c;font-weight:800;margin:0 0 6px">
    Rabbit Chair · La Silla
  </p>
  <h1 style="font-size:27px;line-height:1.2;margin:0 0 10px">La Silla ya está completa</h1>
  <p style="margin:0 0 18px;color:#444">
    Desde la primera versión aprendimos operando. Esta actualización cierra lo que faltaba:
    cobrar mejor, llegar a la gente correcta y saber qué pasó con cada lugar.
  </p>

  <h2 style="font-size:15px;margin:22px 0 8px">Lo nuevo</h2>
  <ul style="margin:0 0 18px;padding-left:18px;color:#444">
    <li style="margin-bottom:8px">
      <strong>Cobro en el POS con modal:</strong> monto editable, tarjeta o efectivo
      (si lo permites) y desglose de IVA. Queda en caja y en reportes como una venta real.
    </li>
    <li style="margin-bottom:8px">
      <strong>Audiencia por radio / proximidad:</strong> además de presencia, lista de espera
      y miembros, ahora puedes avisar a quienes han estado en negocios cerca del tuyo.
    </li>
    <li style="margin-bottom:8px">
      <strong>Un masivo al día:</strong> el aviso a “todos” queda limitado a 1 por día y
      100 destinatarios por defecto. Las audiencias dirigidas no gastan ese límite.
    </li>
    <li style="margin-bottom:8px">
      <strong>Multi-sucursal:</strong> si dos sucursales abren La Silla a la vez, el cliente
      elige dónde está. El enlace del push ya lo lleva a la sucursal correcta.
    </li>
    <li style="margin-bottom:8px">
      <strong>Staff extra con costo:</strong> asigna un bartender o barista, define minutos y
      la activación congela su costo. El reporte muestra costo de staff y margen neto.
    </li>
    <li style="margin-bottom:8px">
      <strong>Reporte propio de La Silla:</strong> ocupación, ingreso, aporte promedio, tiempo
      de servicio y fila, con alcance por sucursal o negocio y exportación CSV.
    </li>
    <li style="margin-bottom:8px">
      <strong>Créditos con historial:</strong> de dónde salió cada crédito y en qué activación
      se usó, con vencimiento y restantes.
    </li>
  </ul>

  <h2 style="font-size:15px;margin:22px 0 8px">Lo que ya funcionaba y ahora es más estable</h2>
  <ul style="margin:0 0 18px;padding-left:18px;color:#444">
    <li>Si se llena, La Silla queda <strong>agotada</strong> sin perder el tablero del POS.</li>
    <li>La fila avanza cada 5 minutos aunque no haya una caja abierta.</li>
    <li>Las notificaciones abren La Silla (antes podían terminar en una pantalla inexistente).</li>
  </ul>

  <p style="margin:24px 0 8px;color:#444">
    Si ya tienes una activación, entra a <strong>Marketing → Rabbit Chair</strong>.
    Si todavía no, actívala y crea la primera.
  </p>

  <p style="margin:24px 0">
    <a href="https://admin.rabbitty.me/marketing/rabbit-chair"
       style="background:#dc2626;color:#fff;text-decoration:none;font-weight:800;padding:12px 20px;border-radius:999px;display:inline-block">
      Abrir La Silla
    </a>
  </p>

  <p style="margin:0;color:#777;font-size:12px">
    ¿Dudas? Responde a este correo o escríbenos por el chat de soporte en la app.
  </p>
</div>`;

const sql = postgres(url, { max: 1 });

const rows = await sql`
  SELECT b."id" AS business_id,
         b."name" AS business_name,
         u."id" AS user_id,
         u."email"
    FROM "ownedBusinesses" b
    JOIN users u ON u."id" = b."ownerId"
   ORDER BY b."createdAt" ASC
`;

const audience = rows.filter((r) => {
  if (includeDemo) return true;
  return !/demo|test|sandbox|prueba/i.test(String(r.business_name || ""));
});

console.log(
  `Afiliados: ${rows.length} · a enviar: ${audience.length}${send ? " (ENVÍO REAL)" : " (dry-run)"}\n`,
);

let emails = 0;
let inbox = 0;

for (const r of audience) {
  console.log(`▸ ${r.business_name} · ${r.email || "(sin correo)"}`);
  if (!send) continue;

  // 1) In-app + push por el outbox (el worker entrega y deduplica).
  try {
    await sql`
      INSERT INTO "notifications_outbox"
        ("id","userId","type","title","message","route","data","dedupeKey","priority","status","runAfter")
      VALUES
        (gen_random_uuid()::text, ${r.user_id}, 'SYSTEM', ${TITLE}, ${MESSAGE},
         ${`/rabbit-chair?business=${r.business_id}`},
         ${JSON.stringify({ kind: "rabbit_chair_update" })}::jsonb,
         ${`rabbit_chair_update_2026_11_25:${r.business_id}`}, 'high', 'QUEUED', now())
      ON CONFLICT ("dedupeKey") DO NOTHING
    `;
    inbox++;
  } catch (e) {
    console.error(`  in-app falló: ${e.message}`);
  }

  // 2) Correo
  if (r.email && resendKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Rabbitty <hola@rabbitty.me>",
          to: [r.email],
          subject: "La Silla ya está completa: cobro, radio y reportes",
          html: EMAIL_HTML,
        }),
      });
      if (res.ok) emails++;
      else console.error(`  correo falló: HTTP ${res.status}`);
    } catch (e) {
      console.error(`  correo falló: ${e.message}`);
    }
  }
}

console.log(`\nResumen: in-app ${send ? inbox : 0} · correos ${send ? emails : 0}`);

// Drena el outbox de inmediato (in-app + push) si hay secreto.
if (send && drain) {
  const appUrl = process.env.RABBITTY_MINIAPP_URL || "https://app.rabbitty.me";
  const secret = process.env.RABBITTY_API_SECRET || process.env.CRON_SECRET;
  if (!secret) {
    console.warn("Sin RABBITTY_API_SECRET/CRON_SECRET: el worker lo tomará en ≤5 min.");
  } else {
    try {
      const res = await fetch(`${appUrl.replace(/\/$/, "")}/api/cron/notifications-worker?limit=40`, {
        headers: { Authorization: `Bearer ${secret}` },
      });
      console.log(`Worker: HTTP ${res.status} ${(await res.text()).slice(0, 180)}`);
    } catch (e) {
      console.warn(`Worker falló: ${e.message} (se reintenta por cron)`);
    }
  }
}

await sql.end();
