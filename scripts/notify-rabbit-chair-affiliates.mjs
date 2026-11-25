#!/usr/bin/env node
/**
 * ── Anuncio: Rabbit Chair (La Silla) a afiliados ────────────────────────────
 *
 *   node scripts/notify-rabbit-chair-affiliates.mjs            (dry-run)
 *   node scripts/notify-rabbit-chair-affiliates.mjs --send
 *
 * Envía:
 *   · in-app + push  → notifications_outbox (el worker entrega)
 *   · correo         → Resend
 *
 * Audiencia: dueños de negocios (ownedBusinesses.ownerId). Excluye negocios de
 * demostración (nombre con demo/test/sandbox) salvo --include-demo.
 *
 * Requiere: CORE_DATABASE_URL, RABBITTY_MINIAPP_URL, PUSH_SEND_SECRET y
 * RESEND_API_KEY (o AUTH_RESEND_KEY).
 */
import postgres from "postgres";

const args = process.argv.slice(2);
const send = args.includes("--send");
const includeDemo = args.includes("--include-demo");

const url = process.env.CORE_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("Falta CORE_DATABASE_URL / DATABASE_URL");
  process.exit(1);
}
const resendKey =
  process.env.RESEND_API_KEY || process.env.AUTH_RESEND_KEY || process.env.RESEND_KEY;

const TITLE = "Rabbit Chair: la experiencia ya está en tu panel";
const MESSAGE =
  "Ya puedes activar Rabbit Chair (La Silla): una silla, una luz, diez minutos y diez lugares. " +
  "Configura formato, cupo, carta y bartender; lanza el aviso con push y cobra el aporte en caja. " +
  "Entra a Marketing → Rabbit Chair para activarla.";

const EMAIL_HTML = `
<div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#111;max-width:560px;margin:0 auto">
  <p style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#b91c1c;font-weight:800;margin:0 0 6px">
    Rabbit Chair · La Silla
  </p>
  <h1 style="font-size:26px;line-height:1.2;margin:0 0 10px">Una silla. Una luz. Diez minutos.</h1>
  <p style="margin:0 0 16px;color:#444">
    Ya está disponible en tu panel. Es una activación secreta: el cliente no habla, configura su bebida
    desde el teléfono, paga con tarjeta y se va cuando suena el final.
  </p>

  <h2 style="font-size:15px;margin:22px 0 8px">Qué puedes hacer</h2>
  <ul style="margin:0 0 16px;padding-left:18px;color:#444">
    <li><strong>Elegir el formato:</strong> una silla de uno en uno, varias a la vez, por oleadas o parejas.</li>
    <li><strong>Definir la carta:</strong> café, coctelería o ambas. Si hay alcohol, se marca +18.</li>
    <li><strong>Poner el mínimo:</strong> aporte libre desde $50, solo con tarjeta.</li>
    <li><strong>Sortear la fecha</strong> con un clic (dentro de una ventana) o lanzarla cuando quieras.</li>
    <li><strong>Avisar por push</strong> a los Rabbitters que han estado en tu negocio.</li>
    <li><strong>Operar desde el POS:</strong> apartar lugar, sentar, marcar servido y arrancar el cronómetro de 10 minutos.</li>
    <li><strong>Cobrar el aporte en caja</strong> y verlo en tus reportes como cualquier venta.</li>
    <li><strong>Lista de espera:</strong> si se llena, el siguiente recibe aviso cuando se libere un lugar.</li>
  </ul>

  <h2 style="font-size:15px;margin:22px 0 8px">Cómo activarla</h2>
  <ol style="margin:0 0 16px;padding-left:18px;color:#444">
    <li>Entra a <strong>Marketing → Rabbit Chair</strong>.</li>
    <li>Pulsa <strong>Activar Rabbit Chair</strong>.</li>
    <li>Crea tu activación (formato, cupo, aporte, duración, carta, bartender).</li>
    <li>Toca <strong>Sortear</strong> o <strong>Lanzar ahora</strong>. En ese momento sale el aviso.</li>
  </ol>

  <p style="margin:0 0 8px;color:#444">
    Los créditos de activación te los da Rabbitty por hito; no se compran ni tienen que ver con Bunz.
  </p>

  <p style="margin:26px 0">
    <a href="https://admin.rabbitty.me/marketing/rabbit-chair"
       style="background:#dc2626;color:#fff;text-decoration:none;font-weight:800;padding:12px 20px;border-radius:999px;display:inline-block">
      Abrir Rabbit Chair
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
         u."email",
         u."telegramId"
    FROM "ownedBusinesses" b
    JOIN users u ON u."id" = b."ownerId"
   ORDER BY b."createdAt" ASC
`;

const audience = rows.filter((r) => {
  if (includeDemo) return true;
  return !/demo|test|sandbox|prueba/i.test(String(r.business_name || ""));
});

console.log(`Afiliados: ${rows.length} · a enviar: ${audience.length}${send ? " (ENVÍO REAL)" : " (dry-run)"}\n`);

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
         ${JSON.stringify({ kind: "rabbit_chair_launch" })}::jsonb,
         ${`rabbit_chair_launch:${r.business_id}`}, 'high', 'QUEUED', now())
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
          subject: "Rabbit Chair: una silla, una luz, diez minutos",
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
await sql.end();
