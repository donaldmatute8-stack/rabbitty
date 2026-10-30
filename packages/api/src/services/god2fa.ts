import crypto from "crypto";

/**
 * ── God Admin 2FA (TOTP + Passkey biométrico) ──
 * Única fuente de identidad God Admin + verificación TOTP + cookie firmada de
 * "2FA verificado en esta sesión". El secreto vive SOLO en envs del servidor
 * (GOD_ADMIN_TOTP_SECRET): nadie puede cambiarlo desde la UI — solo quien
 * administra las variables de entorno del deploy.
 */

export const GOD_ADMIN_EMAILS = ["marco.munoz9@gmail.com", "admin@rabbitty.com"];
export const GOD_ADMIN_USERNAMES = ["deltoro", "mardelbull"];

export function isGodAdminIdentity(email?: string | null, name?: string | null): boolean {
  const e = (email || "").trim().toLowerCase();
  const n = (name || "").trim().toLowerCase();
  return GOD_ADMIN_EMAILS.includes(e) || GOD_ADMIN_USERNAMES.includes(n);
}

// ── TOTP (RFC 6238, SHA1, 6 dígitos, 30s, ventana ±1) — sin dependencias ──
function base32Decode(s: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  const bytes: number[] = [];
  for (const c of s.replace(/=+$/, "").toUpperCase()) {
    const idx = alphabet.indexOf(c);
    if (idx === -1) continue;
    bits += idx.toString(2).padStart(5, "0");
    while (bits.length >= 8) {
      bytes.push(parseInt(bits.slice(0, 8), 2));
      bits = bits.slice(8);
    }
  }
  return Buffer.from(bytes);
}

function totpAt(secretBase32: string, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const key = base32Decode(secretBase32);
  if (key.length === 0) return "000000";
  const h = crypto.createHmac("sha1", key).update(buf).digest();
  const o = h[h.length - 1]! & 0xf;
  const code =
    ((h[o]! & 0x7f) << 24) | ((h[o + 1] ?? 0) << 16) | ((h[o + 2] ?? 0) << 8) | (h[o + 3] ?? 0);
  return String(code % 1000000).padStart(6, "0");
}

export function verifyGodAdminTotp(code: string, secretBase32?: string | null): boolean {
  const secret = secretBase32 || process.env.GOD_ADMIN_TOTP_SECRET;
  if (!secret) return false;
  const clean = (code || "").replace(/\D/g, "");
  if (clean.length !== 6) return false;
  const counter = Math.floor(Date.now() / 30000);
  // ventana ±1 paso (30s antes/después) para relojes desincronizados
  return clean === totpAt(secret, counter) || clean === totpAt(secret, counter - 1) || clean === totpAt(secret, counter + 1);
}

export function godAdminTotpConfigured(): boolean {
  return Boolean(process.env.GOD_ADMIN_TOTP_SECRET);
}

// ── Cookie firmada de sesión 2FA (12h) ──
export const GOD_2FA_COOKIE = "god2fa";
const COOKIE_TTL_MS = 12 * 60 * 60 * 1000;

function signingKey(): string {
  const secret = process.env.GOD_ADMIN_TOTP_SECRET;
  // Producción sin secret = HMAC forjable con la key de dev conocida → fail-fast
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("GOD_ADMIN_TOTP_SECRET requerido en producción (god2fa)");
  }
  return secret || "dev-only-god2fa-signing-key";
}

export function issueGod2faCookieValue(): string {
  const exp = Date.now() + COOKIE_TTL_MS;
  const mac = crypto.createHmac("sha256", signingKey()).update(String(exp)).digest("hex");
  return `${exp}.${mac}`;
}

export function verifyGod2faCookieValue(value: string | undefined | null): boolean {
  if (!value) return false;
  const [expRaw, mac] = value.split(".");
  const exp = Number(expRaw);
  if (!exp || !mac || exp < Date.now()) return false;
  const expected = crypto.createHmac("sha256", signingKey()).update(String(exp)).digest("hex");
  const a = Buffer.from(mac, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ── Rate limit de intentos 2FA — Redis compartido (REDIS_URL) con fallback en memoria ──
let _redis: import("ioredis").default | null = null;
function getRedis() {
  if (_redis !== null) return _redis;
  const url = process.env.REDIS_URL;
  if (!url) { _redis = null; return null; }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Redis = require("ioredis");
    const client = new Redis(url, { maxRetriesPerRequest: 1, connectTimeout: 2000, enableOfflineQueue: false, lazyConnect: false });
    client.on("error", (e: unknown) => console.error("[god2fa] Redis error:", e));
    _redis = client;
  } catch {
    _redis = null;
  }
  return _redis;
}
const memoryAttempts = new Map<string, { count: number; resetAt: number }>();

export async function check2faRateLimit(key: string): Promise<boolean> {
  const redis = getRedis();
  if (redis) {
    try {
      const rk = `god2fa:${key}`;
      const count = await redis.incr(rk);
      if (count === 1) await redis.expire(rk, 5 * 60);
      return count <= 8; // 8 intentos / 5 min, compartido entre réplicas
    } catch (err) {
      console.error("[god2fa] Redis rate limit error, fallback memoria:", err);
    }
  }
  const now = Date.now();
  const entry = memoryAttempts.get(key);
  if (!entry || now > entry.resetAt) {
    memoryAttempts.set(key, { count: 1, resetAt: now + 5 * 60 * 1000 });
    return true;
  }
  entry.count += 1;
  return entry.count <= 8;
}

// ── Passkeys (WebAuthn) — verificación server-side mínima (ES256 + CBOR) ──
export interface StoredPasskey {
  credId: string; // base64url
  publicKeyJwk: { kty: string; crv: string; x: string; y: string };
  signCount: number;
  label: string;
  createdAt: string;
}

export function b64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}
export function b64urlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Decodificador CBOR mínimo (lo necesario para authData/COSE keys)
function cborDecode(buf: Buffer, offset = 0): { value: unknown; offset: number } {
  const byte0 = buf[offset] ?? 0;
  const major = byte0 >> 5;
  const info = byte0 & 0x1f;
  const readN = (n: number): number => {
    let v = 0;
    for (let i = 0; i < n; i++) v = v * 256 + (buf[offset + 1 + i] ?? 0);
    return v;
  };
  let len = info;
  let headerSize = 1;
  if (info >= 24 && info <= 27) {
    const byteLen = info === 24 ? 1 : info === 25 ? 2 : info === 26 ? 4 : 8;
    len = readN(byteLen);
    headerSize = 1 + byteLen;
  }
  const start = offset + headerSize;

  if (major === 0) return { value: len, offset: start }; // uint
  if (major === 1) return { value: -1 - len, offset: start }; // negint
  if (major === 2) return { value: buf.subarray(start, start + len), offset: start + len }; // bytes
  if (major === 3) return { value: buf.subarray(start, start + len).toString("utf8"), offset: start + len }; // text
  if (major === 5) { // map
    const out: Record<string, unknown> = {};
    let cur = start;
    for (let i = 0; i < len; i++) {
      const k = cborDecode(buf, cur);
      const v = cborDecode(buf, k.offset);
      out[String(k.value)] = v.value;
      cur = v.offset;
    }
    return { value: out, offset: cur };
  }
  if (major === 4) { // array
    const out: unknown[] = [];
    let cur = start;
    for (let i = 0; i < len; i++) {
      const v = cborDecode(buf, cur);
      out.push(v.value);
      cur = v.offset;
    }
    return { value: out, offset: cur };
  }
  return { value: null, offset: start };
}

export function parseAuthData(authData: Buffer): {
  rpIdHash: Buffer;
  flags: number;
  signCount: number;
  credId?: Buffer;
  coseKey?: Record<string, unknown>;
} {
  const rpIdHash = authData.subarray(0, 32);
  const flags = authData[32] ?? 0;
  const signCount = authData.length >= 37 ? authData.readUInt32BE(33) : 0;
  let credId: Buffer | undefined;
  let coseKey: Record<string, unknown> | undefined;
  if (flags & 0x40) { // attested credential data presente
    let off = 37;
    const aaguid = authData.subarray(off, off + 16);
    off += 16;
    const credIdLen = authData.length >= off + 2 ? authData.readUInt16BE(off) : 0;
    off += 2;
    credId = authData.subarray(off, off + credIdLen);
    off += credIdLen;
    const decoded = cborDecode(authData, off);
    coseKey = decoded.value as Record<string, unknown>;
    void aaguid;
  }
  return { rpIdHash, flags, signCount, credId, coseKey };
}

// COSE key (EC2, ES256) -> JWK
export function coseKeyToJwk(cose: Record<string, unknown>): StoredPasskey["publicKeyJwk"] | null {
  const alg = cose["3"]; // key 3 = alg
  const kty = cose["1"]; // key 1 = kty
  if (Number(kty) !== 2 || Number(alg) !== -7) return null; // EC2 / ES256
  const x = cose["-2"] as Buffer;
  const y = cose["-1"] as Buffer;
  if (!Buffer.isBuffer(x) || !Buffer.isBuffer(y)) return null;
  return {
    kty: "EC",
    crv: "P-256",
    x: b64urlEncode(x),
    y: b64urlEncode(y),
  };
}

export function verifyPasskeySignature(
  jwk: StoredPasskey["publicKeyJwk"],
  authenticatorData: Buffer,
  clientDataJSON: Buffer,
  signature: Buffer
): boolean {
  try {
    const key = crypto.createPublicKey({ key: jwk as crypto.JsonWebKey, format: "jwk" });
    const clientHash = crypto.createHash("sha256").update(clientDataJSON).digest();
    const signed = Buffer.concat([authenticatorData, clientHash]);
    // WebAuthn ES256 = ASN.1 DER ECDSA signature sobre sha256(authData || sha256(clientDataJSON))
    return crypto.verify("sha256", signed, key, signature);
  } catch {
    return false;
  }
}

export function expectedRpIdHash(rpId: string): Buffer {
  return crypto.createHash("sha256").update(rpId).digest();
}

// Retos WebAuthn en memoria (TTL 2 min)
const challenges = new Map<string, { challenge: string; expiresAt: number }>();
export function createWebauthnChallenge(key: string): string {
  const challenge = b64urlEncode(crypto.randomBytes(32));
  challenges.set(key, { challenge, expiresAt: Date.now() + 2 * 60 * 1000 });
  return challenge;
}
export function popWebauthnChallenge(key: string, presented: string): boolean {
  const entry = challenges.get(key);
  challenges.delete(key);
  if (!entry || entry.expiresAt < Date.now()) return false;
  return entry.challenge === presented;
}

/** Decodifica el attestationObject CBOR completo (para el registro WebAuthn). */
export function cborDecodeFull(buf: Buffer): unknown {
  return cborDecode(buf, 0).value;
}

// ── Impersonación (Vista Tenant) — cookie firmada solo para God Admin + 2FA ──
export const GOD_IMP_COOKIE = "godimp";
const IMP_TTL_MS = 8 * 60 * 60 * 1000; // 8h

export function issueImpersonationCookieValue(businessId: string, branchId: string): string {
  const exp = Date.now() + IMP_TTL_MS;
  const payload = `${businessId}|${branchId}|${exp}`;
  const mac = crypto.createHmac("sha256", signingKey()).update(payload).digest("hex");
  return `${payload}|${mac}`;
}

export function verifyImpersonationCookieValue(
  value: string | undefined | null
): { businessId: string; branchId: string } | null {
  if (!value) return null;
  const parts = value.split("|");
  if (parts.length !== 4) return null;
  const businessId = parts[0] ?? "";
  const branchId = parts[1] ?? "";
  const expRaw = parts[2] ?? "";
  const mac = parts[3] ?? "";
  const exp = Number(expRaw);
  if (!businessId || !branchId || !exp || exp < Date.now()) return null;
  const expected = crypto
    .createHmac("sha256", signingKey())
    .update(`${businessId}|${branchId}|${expRaw}`)
    .digest("hex");
  const a = Buffer.from(mac, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return { businessId, branchId };
}
