#!/usr/bin/env node
/**
 * ── update-log.mjs ── Ingesta local del Update Log ──
 *
 * Toma un markdown con frontmatter y lo upsertea por `slug` en la tabla
 * `updatePosts`. Corregir el texto NO cambia la URL pública, así que un enlace
 * ya enviado por broadcast sigue funcionando.
 *
 * Uso:
 *   BUNZY_CONNECT_SECRET=... node scripts/update-log.mjs --prod --file ./updates/1.5.0.md
 *   node scripts/update-log.mjs --prod --file ./updates/1.5.0.md --draft
 *   node scripts/update-log.mjs --prod --file ./updates/1.5.0.md --broadcast --business <id>
 *
 * Flags:
 *   --file <md>       (obligatorio) markdown con frontmatter
 *   --local | --prod  destino (default: local :3003)
 *   --draft           publica como DRAFT (no visible en /updates)
 *   --json            imprime el JSON de respuesta (incluye la URL)
 *
 * Frontmatter soportado:
 *   title, version, date, category (PRODUCT|IMPROVEMENT|FIX|SECURITY),
 *   tags: [a, b], summary, slug, coverUrl
 */
import { readFileSync } from 'node:fs';

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

const file = val('--file');
if (!file) fail('Falta --file <markdown>');

let raw = '';
try {
  raw = readFileSync(file, 'utf8');
} catch (err) {
  fail(`No se pudo leer ${file}: ${err.message}`);
}

/** Frontmatter simple (clave: valor / listas [a, b]). Sin dependencias. */
function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: text.trim() };
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let value = m[2].trim();
    if (value.startsWith('[') && value.endsWith(']')) {
      data[key] = value
        .slice(1, -1)
        .split(',')
        .map((v) => v.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
    } else {
      value = value.replace(/^['"]|['"]$/g, '');
      data[key] = value;
    }
  }
  return { data, body: match[2].trim() };
}

const { data, body } = parseFrontmatter(raw);
if (!data.title) fail('El frontmatter necesita "title".');
if (!body) fail('El markdown no tiene cuerpo (después del frontmatter).');

const payload = {
  slug: data.slug || undefined,
  version: data.version || undefined,
  title: data.title,
  summary: data.summary || undefined,
  body,
  category: (data.category || 'PRODUCT').toUpperCase(),
  tags: Array.isArray(data.tags) ? data.tags : [],
  coverUrl: data.coverUrl || undefined,
  publishedAt: data.date ? new Date(data.date).toISOString() : undefined,
  status: has('--draft') ? 'DRAFT' : 'PUBLISHED',
  createdBy: `local:${process.env.USER || 'cli'}`,
};

const prod = has('--prod');
const base = (val('--base') || (prod ? 'https://admin.rabbitty.me' : 'http://localhost:3003')).replace(/\/+$/, '');
const secret = process.env.UPDATE_LOG_SECRET || process.env.BUNZY_CONNECT_SECRET || '';
if (!secret) fail('Falta UPDATE_LOG_SECRET (o BUNZY_CONNECT_SECRET) en el entorno.');

const res = await fetch(`${base}/api/updates/ingest`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-update-log-secret': secret },
  body: JSON.stringify(payload),
});

const text = await res.text();
let json = null;
try {
  json = JSON.parse(text);
} catch {
  /* respuesta no JSON */
}

if (!res.ok) {
  fail(`HTTP ${res.status}: ${json?.error || text.slice(0, 200)}`);
}

if (has('--json')) {
  console.log(JSON.stringify(json, null, 2));
} else {
  console.log(`✓ ${json.status} · ${json.slug}`);
  console.log(`  ${json.url}`);
  console.log('');
  console.log('  Para el broadcast (CTA):');
  console.log(`    --cta-label "Ver la novedad" --cta-url "${json.url}"`);
}
