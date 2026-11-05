#!/usr/bin/env node
/**
 * ── bunzy-connect.mjs ── CLI local para publicar un mensaje institucional ──
 *
 * Seguro por defecto: sin `--publish` hace SOLO preview (no escribe nada).
 * Nunca imprime el secreto. Muestra entorno + host de DB antes de escribir.
 *
 * Uso:
 *   BUNZY_CONNECT_SECRET=... node scripts/bunzy-connect.mjs \
 *     --business <businessId> --category PRODUCT \
 *     --title "Título" --body "Cuerpo" --dry-run
 *
 *   BUNZY_CONNECT_SECRET=... node scripts/bunzy-connect.mjs \
 *     --business <businessId> --file ./tmp/update.json --publish
 *
 * Flags: --local (default) | --prod · --dry-run · --publish · --business <id>
 *        --category PRODUCT|TIP|NEWS|SYSTEM · --title · --body · --file <json>
 *        --cta-label · --cta-url · --request-key
 */
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const args = process.argv.slice(2);
const has = (name) => args.includes(name);
const val = (name, fallback = null) => {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  const next = args[i + 1];
  return next && !next.startsWith('--') ? next : fallback;
};

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

if (has('--help') || has('-h')) {
  console.log(readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0].replace('/**', ''));
  process.exit(0);
}

const prod = has('--prod');
const publish = has('--publish');
const base = prod ? 'https://admin.rabbitty.me' : 'http://localhost:3003';
const secret = process.env.BUNZY_CONNECT_SECRET || '';
if (!secret) fail('Falta BUNZY_CONNECT_SECRET en el entorno (no lo pegues en el código).');

const file = val('--file');
let payload = {};
if (file) {
  try {
    payload = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    fail(`No se pudo leer ${file}: ${err.message}`);
  }
}

const category = (val('--category', payload.category || 'PRODUCT') || 'PRODUCT').toUpperCase();
const title = val('--title', payload.title || '') || '';
const body = val('--body', payload.body || '') || '';
const ctaLabel = val('--cta-label', payload.ctaLabel || null);
const ctaUrl = val('--cta-url', payload.ctaUrl || null);
const requestKey = val('--request-key', payload.requestKey || null);
const businessId = val('--business', payload.businessId || null);

if (has('--audience') && String(val('--audience')).toLowerCase().startsWith('all')) {
  fail('C0 solo permite un negocio. Usa --business <businessId>.');
}
if (!title.trim() || !body.trim()) fail('Faltan --title y --body (o --file con title/body).');
if (publish && !businessId) fail('Falta --business <businessId> para publicar en C0.');

const headers = { 'x-bunzy-connect-secret': secret, 'Content-Type': 'application/json' };

async function getMeta() {
  const res = await fetch(`${base}/api/bunzy/connect?meta=1`, { headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) fail(`No autorizado o API no disponible (HTTP ${res.status}).`);
  return data;
}

const meta = await getMeta();
console.log('── Destino ──');
console.log(`Entorno:   ${meta.environment || 'unknown'}`);
console.log(`API:       ${base}`);
console.log(`DB host:   ${meta.dbHost || 'desconocido'}`);
console.log(`Tablas:    ${meta.tablesReady ? 'listas' : 'FALTAN (aplica 0045_bunzy_connect.sql)'}`);
console.log(`Remitente: ${meta.sender}`);
console.log('');

if (!meta.tablesReady && publish) {
  fail('Las tablas de Bunzy Connect no existen. Aplica la migración 0045 antes de publicar.');
}

const audience = { scope: 'BUSINESS', businessId };
const requestBody = {
  category,
  title,
  body,
  ctaLabel,
  ctaUrl,
  requestKey,
  audience,
  dryRun: !publish,
};

console.log('── Mensaje ──');
console.log(`Categoría: ${category}`);
console.log(`Título:    ${title}`);
console.log(`Cuerpo:    ${body.slice(0, 160)}${body.length > 160 ? '…' : ''}`);
console.log(`CTA:       ${ctaLabel || '—'} ${ctaUrl || ''}`);
console.log(`Destino:   negocio ${businessId}`);
console.log('');

if (!publish) {
  const res = await fetch(`${base}/api/bunzy/connect`, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) fail(`Preview falló (HTTP ${res.status}): ${data.error || 'sin detalle'}`);
  console.log('── Preview (solo lectura, nada escrito) ──');
  console.log(`Audiencia: ${data.audienceCount} negocio(s)`);
  for (const s of data.sample || []) console.log(`  · ${s.name} (${s.id})`);
  console.log(`Tarjeta:   [${data.preview?.category}] ${data.preview?.title}`);
  console.log('');
  console.log('Para publicar de verdad: agrega --publish (pedirá confirmación).');
  process.exit(0);
}

const rl = createInterface({ input: stdin, output: stdout });
const expected = prod ? 'PUBLICAR EN PRODUCCION' : 'CONFIRMAR';
console.log(`⚠️  Vas a ESCRIBIR en ${meta.environment} · DB ${meta.dbHost}.`);
const answer = await rl.question(`Escribe "${expected}" para continuar: `);
rl.close();
if (answer.trim() !== expected) fail('Confirmación incorrecta. No se publicó nada.');

const res = await fetch(`${base}/api/bunzy/connect`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ ...requestBody, dryRun: false, confirm: 'PUBLICAR' }),
});
const data = await res.json().catch(() => ({}));
if (!res.ok) fail(`Publicación falló (HTTP ${res.status}): ${data.error || 'sin detalle'}`);

console.log('');
console.log(`✓ Broadcast ${data.broadcastId} · ${data.status}`);
console.log(`  Audiencia: ${data.audienceCount} · Publicados: ${data.published}`);
for (const d of data.deliveries || []) {
  console.log(`  · ${d.recipientId} → ${d.status}${d.replayed ? ' (replay)' : ''} · msg ${d.messageId || '—'}`);
}
console.log('');
console.log('Reintentar el mismo comando NO duplica (requestKey + delivery unique).');
