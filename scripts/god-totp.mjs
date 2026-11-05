#!/usr/bin/env node
/**
 * ── god-totp.mjs ── Helper LOCAL para el 2FA de God Admin ──
 *
 * Lee GOD_ADMIN_TOTP_SECRET del entorno o de apps/admin/.env.local y muestra el
 * código TOTP actual (RFC 6238, SHA1, 6 dígitos, 30s). Nunca imprime el secreto.
 *
 * Uso: node scripts/god-totp.mjs
 */
import { readFileSync } from 'node:fs';
import crypto from 'node:crypto';

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

let secret = process.env.GOD_ADMIN_TOTP_SECRET || '';
if (!secret) {
  try {
    const env = readFileSync(new URL('../apps/admin/.env.local', import.meta.url), 'utf8');
    const line = env.split('\n').find((l) => l.trim().startsWith('GOD_ADMIN_TOTP_SECRET='));
    secret = (line || '').split('=').slice(1).join('=').trim().replace(/^"|"$/g, '');
  } catch {
    /* sin archivo */
  }
}
if (!secret) fail('No encontré GOD_ADMIN_TOTP_SECRET (env o apps/admin/.env.local).');

function base32Decode(s) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  const out = [];
  for (const c of s.replace(/=+$/, '').toUpperCase()) {
    const idx = alphabet.indexOf(c);
    if (idx === -1) continue;
    bits += idx.toString(2).padStart(5, '0');
    while (bits.length >= 8) {
      out.push(parseInt(bits.slice(0, 8), 2));
      bits = bits.slice(8);
    }
  }
  return Buffer.from(out);
}

const key = base32Decode(secret);
function totpAt(counter) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', key).update(buf).digest();
  const o = h[h.length - 1] & 0xf;
  const code =
    ((h[o] & 0x7f) << 24) | ((h[o + 1] ?? 0) << 16) | ((h[o + 2] ?? 0) << 8) | (h[o + 3] ?? 0);
  return String(code % 1000000).padStart(6, '0');
}

const counter = Math.floor(Date.now() / 30000);
const remaining = 30 - (Math.floor(Date.now() / 1000) % 30);
console.log(`God 2FA: ${totpAt(counter)}  (expira en ${remaining}s; siguiente ${totpAt(counter + 1)})`);
