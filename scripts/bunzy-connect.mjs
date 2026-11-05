#!/usr/bin/env node
/**
 * ── bunzy-connect.mjs ── CLI local para publicar un mensaje institucional ──
 *
 * Seguro por defecto: sin `--publish` hace SOLO preview (no escribe nada).
 * Nunca imprime el secreto. Muestra entorno + host de DB antes de escribir.
 *
 * Uso:
 *   BUNZY_CONNECT_SECRET=... node scripts/bunzy-connect.mjs \
 *     --business <businessId> --category PRODUCT --title "..." --body "..." --dry-run
 *
 *   BUNZY_CONNECT_SECRET=... node scripts/bunzy-connect.mjs \
 *     --business <businessId> --file ./tmp/update.json --publish
 *
 *   # programar (ISO 8601)
 *   ... --schedule 2026-11-06T15:00:00-06:00 --publish
 *
 *   # usuario individual
 *   ... --user <userId> --publish
 *
 * Flags: --local (default) | --prod · --dry-run · --publish · --business <id>
 *        --user <id> · --audience all-affiliates --allow-mass
 *        --category PRODUCT|TIP|NEWS|SYSTEM · --title · --body · --file <json>
 *        --cta-label · --cta-url · --request-key · --schedule <iso>
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
const allowMass = has('--allow-mass');
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
const scheduledAt = val('--schedule', payload.scheduledAt || null);
const businessId = val('--business', payload.businessId || null);
const userId = val('--user', payload.userId || null);
const audienceFlag = String(val('--audience', '') || '').toLowerCase();
const allAffiliates = audienceFlag.includes('affiliate') || has('--all-affiliates');
const allRabbiters = audienceFlag.includes('rabbitter') || has('--all-rabbitters');
const mass = allAffiliates || allRabbiters;

if (!title.trim() || !body.trim()) fail('Faltan --title y --body (o --file con title/body).');
if (mass && (businessId || userId)) fail('Usa --business/--user O --audience all-*, no ambos.');
if (!mass && !businessId && !userId) fail('Falta --business <id> o --user <id>.');
if (businessId && userId) fail('Usa solo uno: --business o --user.');
if (scheduledAt && Number.isNaN(Date.parse(scheduledAt))) fail('--schedule no es una fecha ISO válida.');
if (publish && mass && !allowMass) fail('El envío masivo requiere --allow-mass (y BUNZY_CONNECT_ALLOW_MASS=1 en el server).');

const scope = allRabbiters ? 'ALL_RABBITTERS' : allAffiliates ? 'ALL_AFFILIATES' : userId ? 'USER' : 'BUSINESS';
const audience = {
  scope,
  ...(scope === 'BUSINESS' ? { businessId } : {}),
  ...(scope === 'USER' ? { userId } : {}),
};

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
console.log(`Tablas:    ${meta.tablesReady ? 'listas' : 'FALTAN (aplica 0045/0046)'}`);
console.log(`Remitente: ${meta.sender}`);
console.log('');

if (!meta.tablesReady && publish) {
  fail('Las tablas de Bunzy Connect no existen. Aplica las migraciones antes de publicar.');
}

const requestBody = {
  category,
  title,
  body,
  ctaLabel,
  ctaUrl,
  requestKey,
  scheduledAt,
  audience,
  allowMass: mass ? true : undefined,
  dryRun: !publish,
};

console.log('── Mensaje ──');
console.log(`Categoría: ${category}`);
console.log(`Título:    ${title}`);
console.log(`Cuerpo:    ${body.slice(0, 160)}${body.length > 160 ? '…' : ''}`);
console.log(`CTA:       ${ctaLabel || '—'} ${ctaUrl || ''}`);
console.log(`Programado:${scheduledAt ? ` ${scheduledAt}` : ' inmediato'}`);
console.log(`Destino:   ${allRabbiters ? 'TODOS los Rabbitters' : allAffiliates ? 'TODOS los afiliados' : userId ? `usuario ${userId}` : `negocio ${businessId}`}`);
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
  console.log(`Audiencia: ${data.audienceCount} destinatario(s)`);
  for (const s of data.sample || []) console.log(`  · ${s.name} (${s.id})`);
  console.log(`Tarjeta:   [${data.preview?.category}] ${data.preview?.title}`);
  console.log('');
  console.log('Para publicar de verdad: agrega --publish (pedirá confirmación).');
  process.exit(0);
}

const rl = createInterface({ input: stdin, output: stdout });
const expected = mass
  ? prod
    ? 'PUBLICAR MASIVO'
    : 'CONFIRMAR MASIVO'
  : prod
    ? 'PUBLICAR EN PRODUCCION'
    : 'CONFIRMAR';
console.log(`⚠️  Vas a ESCRIBIR en ${meta.environment} · DB ${meta.dbHost}.`);
if (mass) console.log(allRabbiters ? '⚠️  Es un envío MASIVO a todos los Rabbitters.' : '⚠️  Es un envío MASIVO a todos los afiliados aprobados.');
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
if (data.queued) console.log('  Encolado: el worker procesará las entregas por lotes (cron cada 5 min).');
if (data.scheduledAt) console.log(`  Programado para: ${data.scheduledAt}`);
console.log(`  Audiencia: ${data.audienceCount} · Publicados: ${data.published}`);
for (const d of data.deliveries || []) {
  console.log(`  · ${d.recipientId} → ${d.status}${d.replayed ? ' (replay)' : ''} · msg ${d.messageId || '—'}`);
}
for (const s of data.skipped || []) {
  console.log(`  · ${s.recipientId} omitido (${s.reason})`);
}
console.log('');
console.log('Reintentar el mismo comando NO duplica (requestKey + delivery unique).');
