#!/usr/bin/env node
/**
 * ── bunzy-release.mjs ── Hook de release para Bunzy Connect ──
 *
 * Toma un archivo markdown (release notes / changelog), extrae título y cuerpo y
 * lo publica como actualización de producto. Delega en bunzy-connect.mjs para
 * conservar preview, confirmación, idempotencia y el secreto fuera de logs.
 *
 * Uso:
 *   BUNZY_CONNECT_SECRET=... node scripts/bunzy-release.mjs \
 *     --version 1.5.0 --file ./RELEASE.md --business <businessId> --publish
 *
 * Flags: --version <v> · --file <md> · --business <id> | --user <id> |
 *        --all-affiliates --allow-mass · --prod · --publish
 */
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

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

const version = val('--version');
const file = val('--file');
if (!version) fail('Falta --version (se usa para el requestKey idempotente).');
if (!file) fail('Falta --file con las release notes en markdown.');

let raw = '';
try {
  raw = readFileSync(file, 'utf8');
} catch (err) {
  fail(`No se pudo leer ${file}: ${err.message}`);
}

const lines = raw.split(/\r?\n/);
const titleLine = lines.find((l) => /^#\s+/.test(l.trim()));
const title = (titleLine ? titleLine.replace(/^#\s+/, '') : `Actualización ${version}`).trim().slice(0, 80);
const body = lines
  .filter((l) => l !== titleLine)
  .join('\n')
  .replace(/^#{1,6}\s*/gm, '')
  .replace(/^\s*[-*]\s+/gm, '• ')
  .replace(/`/g, '')
  .trim()
  .slice(0, 4000);

if (body.length < 10) fail('El archivo no tiene suficiente contenido para el cuerpo.');

const payload = {
  category: 'PRODUCT',
  title,
  body,
  ctaLabel: 'Ver novedades',
  ctaUrl: 'https://rabbitty.me',
  requestKey: `release:${version}`,
};
const tmpFile = join(tmpdir(), `bunzy-release-${version.replace(/[^a-zA-Z0-9._-]/g, '_')}.json`);
writeFileSync(tmpFile, JSON.stringify(payload, null, 2), 'utf8');

const childArgs = ['scripts/bunzy-connect.mjs', '--category', 'PRODUCT', '--file', tmpFile, '--request-key', `release:${version}`];
if (val('--business')) childArgs.push('--business', val('--business'));
if (val('--user')) childArgs.push('--user', val('--user'));
if (has('--all-affiliates')) childArgs.push('--audience', 'all-affiliates');
if (has('--allow-mass')) childArgs.push('--allow-mass');
if (has('--prod')) childArgs.push('--prod');
if (has('--publish')) childArgs.push('--publish');

console.log(`Release ${version} · ${title}`);
const result = spawnSync(process.execPath, childArgs, { stdio: 'inherit', env: process.env });

try {
  unlinkSync(tmpFile);
} catch {
  /* noop */
}

process.exit(result.status ?? 1);
