import 'server-only';
import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { and, eq, gt } from 'drizzle-orm';
import { db } from '@/db';
import { users, verificationTokens } from '@/db/schema';
import { sendEmail, getTwoFactorEmailTemplate } from '@/lib/email';
import { hashOtp, rateLimit } from '@/lib/otp';

export type TwoFactorMethod = 'email' | 'phone' | 'totp';
export type UserRow = typeof users.$inferSelect;

const CODE_TTL_MS = 10 * 60 * 1000;
const VERIFY_LIMIT = 8;
const VERIFY_WINDOW_MS = 10 * 60 * 1000;

/* ───────────── TOTP (RFC 6238, SHA-1, 6 dígitos, 30 s) ───────────── */

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(s: string): Buffer {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of s.replace(/=+$/, '').toUpperCase()) {
    const idx = B32.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function hotp(secret: Buffer, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', secret).update(msg).digest();
  const o = h[h.length - 1] & 0xf;
  const bin = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return (bin % 1_000_000).toString().padStart(6, '0');
}

export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

export function buildOtpAuthUrl(secret: string, account: string): string {
  const issuer = 'Rabbitty';
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

export function verifyTotpCode(secret: string, code: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const key = base32Decode(secret);
  const step = Math.floor(Date.now() / 30_000);
  let ok = false;
  for (const drift of [-1, 0, 1]) {
    const expected = hotp(key, step + drift);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(code))) ok = true;
  }
  return ok;
}

/* ─────────────
 * Cifrado en reposo del secreto TOTP.
 * Debe ser idéntico a packages/api/src/services/crypto.ts (admin): AES-256-CBC, `iv:hex`,
 * clave ENCRYPTION_KEY. Así un mismo authenticator sirve en admin y en la mini app.
 * ───────────── */

function encKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  if (!envKey) return crypto.createHash('sha256').update('rabbitty-default-dev-secret-key-32bytes').digest();
  if (envKey.length === 64) return Buffer.from(envKey, 'hex');
  return crypto.createHash('sha256').update(envKey).digest();
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', encKey(), iv);
  const enc = cipher.update(plain, 'utf8', 'hex') + cipher.final('hex');
  return `${iv.toString('hex')}:${enc}`;
}

export function decryptSecret(stored: string): string | null {
  const [ivHex, encHex] = stored.split(':');
  if (!ivHex || !encHex) return stored; // compat: secreto sin cifrar
  try {
    const decipher = crypto.createDecipheriv('aes-256-cbc', encKey(), Buffer.from(ivHex, 'hex'));
    return decipher.update(encHex, 'hex', 'utf8') + decipher.final('utf8');
  } catch {
    return null;
  }
}

/* ───────────── Métodos habilitados ───────────── */

export function otpMethods(user: Pick<UserRow, 'twoFactorMethods'>): Array<'email' | 'phone'> {
  try {
    const parsed = JSON.parse(user.twoFactorMethods || '[]');
    return Array.isArray(parsed) ? parsed.filter((m): m is 'email' | 'phone' => m === 'email' || m === 'phone') : [];
  } catch {
    return [];
  }
}

export function enabledMethods(user: Pick<UserRow, 'twoFactorMethods' | 'totpEnabled' | 'totpSecret'>): TwoFactorMethod[] {
  const list: TwoFactorMethod[] = [...otpMethods(user)];
  if (user.totpEnabled && user.totpSecret) list.push('totp');
  return list;
}

export function maskEmail(email: string): string {
  return email.replace(/^(.)(.*)(@.*)$/, (_m, a, _b, d) => `${a}***${d}`);
}

export function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, '');
  return d.length > 4 ? `••••${d.slice(-4)}` : '••••';
}

/* ───────────── Entrega de códigos (email / SMS / Telegram) ───────────── */

function challengeId(userId: string, method: 'email' | 'phone') {
  return `2fa:${userId}:${method}`;
}

/** SignalWire (API LaML, compatible con Twilio). Requiere SIGNALWIRE_PROJECT_ID, SIGNALWIRE_API_TOKEN, SIGNALWIRE_SPACE_URL y SIGNALWIRE_FROM_NUMBER. */
function smsConfigured() {
  return Boolean(
    process.env.SIGNALWIRE_PROJECT_ID &&
    process.env.SIGNALWIRE_API_TOKEN &&
    process.env.SIGNALWIRE_SPACE_URL &&
    process.env.SIGNALWIRE_FROM_NUMBER,
  );
}

export function phoneChannel(user: Pick<UserRow, 'phoneNumber' | 'telegramId'>): 'sms' | 'telegram' | null {
  if (user.phoneNumber && smsConfigured()) return 'sms';
  if (user.telegramId && process.env.TELEGRAM_BOT_TOKEN) return 'telegram';
  return null;
}

async function sendSms(to: string, body: string): Promise<boolean> {
  const project = process.env.SIGNALWIRE_PROJECT_ID!;
  const token = process.env.SIGNALWIRE_API_TOKEN!;
  const space = process.env.SIGNALWIRE_SPACE_URL!.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const form = new URLSearchParams({ To: to, From: process.env.SIGNALWIRE_FROM_NUMBER!, Body: body });
  try {
    const res = await fetch(`https://${space}/api/laml/2010-04-01/Accounts/${project}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${project}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form,
    });
    if (!res.ok) console.error('[2FA] SignalWire error', res.status);
    return res.ok;
  } catch (err) {
    console.error('[2FA] SignalWire exception', err);
    return false;
  }
}

async function sendTelegram(chatId: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function sendChallenge(
  user: UserRow,
  method: 'email' | 'phone',
  purpose: 'enroll' | 'action',
): Promise<{ ok: true; channel: 'email' | 'sms' | 'telegram'; hint: string } | { ok: false; status: number; error: string }> {
  const cooldown = await rateLimit(`2fa_send:${user.id}:${method}`, 1, 45_000);
  if (!cooldown.ok) return { ok: false, status: 429, error: `Espera ${cooldown.retryAfterSec} s para pedir otro código.` };
  const daily = await rateLimit(`2fa_send_day:${user.id}`, 20, 60 * 60 * 1000);
  if (!daily.ok) return { ok: false, status: 429, error: 'Demasiados códigos solicitados. Intenta más tarde.' };

  const code = crypto.randomInt(100000, 1000000).toString();
  const id = challengeId(user.id, method);

  let channel: 'email' | 'sms' | 'telegram';
  let hint: string;
  let delivered = false;

  if (method === 'email') {
    if (!user.email || user.email.endsWith('@phone.rabbitty.me')) {
      return { ok: false, status: 400, error: 'Tu cuenta no tiene un correo real vinculado.' };
    }
    channel = 'email';
    hint = maskEmail(user.email);
    const res = await sendEmail({
      to: user.email,
      subject: `🔐 ${code} es tu código de verificación Rabbitty`,
      html: getTwoFactorEmailTemplate(code, purpose === 'enroll' ? 'activar la verificación en dos pasos' : 'autorizar una operación en tu cuenta'),
    });
    delivered = res.ok;
  } else {
    const ch = phoneChannel(user);
    if (!ch) return { ok: false, status: 400, error: 'No hay un canal disponible: vincula tu número o Telegram.' };
    const text = `Rabbitty: tu código de verificación es ${code}. Expira en 10 minutos. No lo compartas.`;
    if (ch === 'sms') {
      channel = 'sms';
      hint = maskPhone(user.phoneNumber!);
      delivered = await sendSms(user.phoneNumber!, text);
    } else {
      channel = 'telegram';
      hint = 'tu Telegram';
      delivered = await sendTelegram(user.telegramId!, `🔐 ${text}`);
    }
  }

  if (!delivered) return { ok: false, status: 502, error: 'No pudimos enviar el código. Inténtalo de nuevo en un momento.' };

  await db.delete(verificationTokens).where(eq(verificationTokens.identifier, id));
  await db.insert(verificationTokens).values({
    identifier: id,
    token: hashOtp(id, code),
    expires: new Date(Date.now() + CODE_TTL_MS),
  });
  return { ok: true, channel, hint };
}

async function consumeChallenge(userId: string, method: 'email' | 'phone', code: string): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false;
  const id = challengeId(userId, method);
  const deleted = await db
    .delete(verificationTokens)
    .where(and(eq(verificationTokens.identifier, id), eq(verificationTokens.token, hashOtp(id, code)), gt(verificationTokens.expires, new Date())))
    .returning({ token: verificationTokens.token });
  return deleted.length > 0;
}

/** Verifica un código de segundo factor. Aplica límite de intentos por usuario. */
export async function verifySecondFactor(
  user: Pick<UserRow, 'id' | 'totpSecret'>,
  method: TwoFactorMethod,
  code: string,
): Promise<boolean> {
  const limit = await rateLimit(`2fa_verify:${user.id}`, VERIFY_LIMIT, VERIFY_WINDOW_MS);
  if (!limit.ok) return false;
  const clean = String(code ?? '').replace(/\s/g, '');
  if (method === 'totp') {
    const secret = user.totpSecret ? decryptSecret(user.totpSecret) : null;
    return secret ? verifyTotpCode(secret, clean) : false;
  }
  return consumeChallenge(user.id, method, clean);
}

/**
 * Guard para operaciones sensibles en servidor. Devuelve null si se puede continuar
 * o una respuesta 403 con code `2FA_REQUIRED` / `2FA_INVALID`.
 */
export async function requireSecondFactor(userId: string, provided: unknown): Promise<NextResponse | null> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });

  const methods = enabledMethods(user);
  if (methods.length === 0) return null;

  const p = provided as { method?: string; code?: string } | undefined;
  if (!p || !p.method || !p.code) {
    return NextResponse.json(
      { error: 'Se requiere verificación en dos pasos.', code: '2FA_REQUIRED', methods },
      { status: 403 },
    );
  }
  const method = p.method as TwoFactorMethod;
  if (!methods.includes(method) || !(await verifySecondFactor(user, method, p.code))) {
    return NextResponse.json({ error: 'Código de verificación incorrecto o expirado.', code: '2FA_INVALID', methods }, { status: 403 });
  }
  return null;
}
