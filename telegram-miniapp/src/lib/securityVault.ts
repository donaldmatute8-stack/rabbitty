/**
 * Rabbitty security vault (client-side).
 *
 * Importante: PIN y biometría son un "gate" local del dispositivo para autorizar
 * acciones sensibles (p. ej. enviar Bunz). La autorización real de la operación
 * sigue siendo del servidor; esto evita usos accidentales/no autorizados del
 * dispositivo desbloqueado.
 */

const PIN_V2_KEY = 'rabbitty_security_pin_v2';
const PIN_LEGACY_KEY = 'rabbitty_security_pin';
const PIN_LOCK_KEY = 'rabbitty_security_pin_lock';
const BIO_KEY = 'rabbitty_biometric_v2';

const PIN_LENGTH = 4;
const PBKDF2_ITERATIONS = 150_000;
const MAX_PIN_FAILS = 5;
const LOCK_MS = 60_000;

/* ───────────────────────── helpers ───────────────────────── */

function bytesToB64(bytes: Uint8Array): string {
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

function b64ToBytes(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64url(bytes: Uint8Array): string {
  return bytesToB64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlToBytes(s: string): Uint8Array {
  const norm = s.replace(/-/g, '+').replace(/_/g, '/');
  return b64ToBytes(norm + '='.repeat((4 - (norm.length % 4)) % 4));
}

const toBuffer = (u: Uint8Array): ArrayBuffer =>
  u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage lleno/bloqueado */ }
}

async function derivePinHash(pin: string, salt: Uint8Array, iterations: number): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: toBuffer(salt), iterations },
    keyMaterial,
    256,
  );
  return bytesToB64(new Uint8Array(bits));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ───────────────────────── PIN ───────────────────────── */

interface PinRecord { v: 2; salt: string; hash: string; iter: number }
interface PinLock { fails: number; until: number }

export const PIN_DIGITS = PIN_LENGTH;

export function hasPin(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean(localStorage.getItem(PIN_V2_KEY) || localStorage.getItem(PIN_LEGACY_KEY));
  } catch {
    return false;
  }
}

export async function setPin(pin: string): Promise<void> {
  if (!new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin)) throw new Error('PIN inválido');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePinHash(pin, salt, PBKDF2_ITERATIONS);
  writeJson(PIN_V2_KEY, { v: 2, salt: bytesToB64(salt), hash, iter: PBKDF2_ITERATIONS } satisfies PinRecord);
  try {
    localStorage.removeItem(PIN_LEGACY_KEY); // nunca más en texto plano
    localStorage.removeItem(PIN_LOCK_KEY);
  } catch { /* noop */ }
}

export function removePin(): void {
  try {
    localStorage.removeItem(PIN_V2_KEY);
    localStorage.removeItem(PIN_LEGACY_KEY);
    localStorage.removeItem(PIN_LOCK_KEY);
  } catch { /* noop */ }
}

export function pinLockRemainingMs(): number {
  const lock = readJson<PinLock>(PIN_LOCK_KEY);
  return lock && lock.until > Date.now() ? lock.until - Date.now() : 0;
}

export type PinVerifyResult =
  | { ok: true }
  | { ok: false; locked: boolean; remainingMs: number; attemptsLeft: number };

export async function verifyPin(pin: string): Promise<PinVerifyResult> {
  const remaining = pinLockRemainingMs();
  if (remaining > 0) return { ok: false, locked: true, remainingMs: remaining, attemptsLeft: 0 };

  let valid = false;
  const record = readJson<PinRecord>(PIN_V2_KEY);

  if (record) {
    const computed = await derivePinHash(pin, b64ToBytes(record.salt), record.iter);
    valid = constantTimeEqual(computed, record.hash);
  } else {
    // Migración: PIN guardado en texto plano por versiones anteriores
    let legacy: string | null = null;
    try { legacy = localStorage.getItem(PIN_LEGACY_KEY); } catch { /* noop */ }
    if (legacy && constantTimeEqual(legacy, pin)) {
      valid = true;
      await setPin(pin); // re-guardar hasheado y borrar el texto plano
    }
  }

  if (valid) {
    try { localStorage.removeItem(PIN_LOCK_KEY); } catch { /* noop */ }
    return { ok: true };
  }

  const prev = readJson<PinLock>(PIN_LOCK_KEY);
  const fails = (prev?.fails ?? 0) + 1;
  if (fails >= MAX_PIN_FAILS) {
    writeJson(PIN_LOCK_KEY, { fails: 0, until: Date.now() + LOCK_MS } satisfies PinLock);
    return { ok: false, locked: true, remainingMs: LOCK_MS, attemptsLeft: 0 };
  }
  writeJson(PIN_LOCK_KEY, { fails, until: 0 } satisfies PinLock);
  return { ok: false, locked: false, remainingMs: 0, attemptsLeft: MAX_PIN_FAILS - fails };
}

/* ───────────────────────── Biometría ───────────────────────── */

export type BiometricBackend = 'native' | 'telegram' | 'webauthn' | 'none';

interface BioRecord { backend: BiometricBackend; credId?: string; userId?: string }

interface TgBiometricManager {
  isInited: boolean;
  isBiometricAvailable: boolean;
  biometricType: 'finger' | 'face' | 'unknown';
  isAccessRequested: boolean;
  isAccessGranted: boolean;
  isBiometricTokenSaved: boolean;
  init(cb?: () => void): void;
  requestAccess(params: { reason?: string }, cb?: (granted: boolean) => void): void;
  authenticate(params: { reason?: string }, cb?: (ok: boolean, token?: string) => void): void;
  updateBiometricToken(token: string, cb?: (ok: boolean) => void): void;
  openSettings(): void;
}

function getTgBiometric(): TgBiometricManager | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { Telegram?: { WebApp?: { BiometricManager?: TgBiometricManager; initData?: string } } };
  const wa = w.Telegram?.WebApp;
  return wa && wa.BiometricManager ? wa.BiometricManager : null;
}

function tgInit(bm: TgBiometricManager): Promise<void> {
  return new Promise((resolve) => {
    if (bm.isInited) return resolve();
    const timer = setTimeout(resolve, 3000);
    bm.init(() => { clearTimeout(timer); resolve(); });
  });
}

async function isNativeApp(): Promise<boolean> {
  const { PlatformBridge } = await import('@/lib/platform');
  return PlatformBridge.isNative();
}

export interface BiometricSupport {
  backend: BiometricBackend;
  available: boolean;
  /** "Face ID", "Huella", "Biometría del dispositivo"… */
  label: string;
}

export async function detectBiometric(): Promise<BiometricSupport> {
  if (typeof window === 'undefined') return { backend: 'none', available: false, label: 'Biometría' };

  if (await isNativeApp()) {
    try {
      const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
      const check = await BiometricAuth.checkBiometry();
      return { backend: 'native', available: check.isAvailable, label: 'Face ID / Touch ID' };
    } catch {
      return { backend: 'native', available: false, label: 'Face ID / Touch ID' };
    }
  }

  const bm = getTgBiometric();
  if (bm) {
    try {
      await tgInit(bm);
      if (bm.isBiometricAvailable) {
        const label = bm.biometricType === 'face' ? 'Face ID' : bm.biometricType === 'finger' ? 'Huella digital' : 'Biometría del dispositivo';
        return { backend: 'telegram', available: true, label };
      }
    } catch {
      // Fallback a webauthn
    }
  }

  if (typeof PublicKeyCredential !== 'undefined') {
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      try {
        const ok = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (ok) return { backend: 'webauthn', available: true, label: 'Face ID / Touch ID' };
      } catch { /* noop */ }
    }
    // Safari iOS / WebKit allows PublicKeyCredential creation even if the pre-check returns false or is not configured
    return { backend: 'webauthn', available: true, label: 'Face ID / Touch ID' };
  }
  return { backend: 'none', available: false, label: 'Biometría' };
}

export async function isBiometricEnabled(): Promise<boolean> {
  const rec = readJson<BioRecord>(BIO_KEY);
  if (!rec || rec.backend === 'none') return false;
  if (rec.backend === 'telegram') {
    const bm = getTgBiometric();
    if (!bm) return false;
    await tgInit(bm);
    return bm.isBiometricAvailable && bm.isAccessGranted && bm.isBiometricTokenSaved;
  }
  return true;
}

export interface BioOutcome { ok: boolean; message: string }

function webauthnMessage(err: unknown): string {
  const name = err && typeof err === 'object' && 'name' in err ? String((err as { name?: unknown }).name) : '';
  if (name === 'NotAllowedError') return 'Cancelaste la verificación o el sistema la rechazó. Inténtalo de nuevo.';
  if (name === 'SecurityError') return 'Este contexto no permite biometría (requiere HTTPS).';
  if (name === 'NotSupportedError') return 'Este dispositivo no soporta biometría en el navegador.';
  if (name === 'InvalidStateError') return 'Ya existe una credencial para este dispositivo. Desactiva y vuelve a activar.';
  return 'No se pudo completar la biometría.';
}

export async function enableBiometric(): Promise<BioOutcome> {
  const support = await detectBiometric();
  if (!support.available) {
    return {
      ok: false,
      message: support.backend === 'telegram'
        ? 'Telegram no reporta biometría disponible. Actívala en Ajustes de tu teléfono y de Telegram.'
        : 'Este dispositivo no tiene biometría disponible o no está configurada en el sistema.',
    };
  }

  /* Native (Capacitor): la verificación real debe pasar antes de activar */
  if (support.backend === 'native') {
    const { PlatformBridge } = await import('@/lib/platform');
    const res = await PlatformBridge.authenticateBiometric('Activa la seguridad biométrica de Rabbitty');
    if (!res.success) return { ok: false, message: 'No se pudo verificar tu biometría. Inténtalo de nuevo.' };
    writeJson(BIO_KEY, { backend: 'native' } satisfies BioRecord);
    return { ok: true, message: `${support.label} activado.` };
  }

  /* Telegram Mini App: BiometricManager oficial */
  if (support.backend === 'telegram') {
    const bm = getTgBiometric()!;
    const granted = bm.isAccessGranted || await new Promise<boolean>((resolve) => {
      bm.requestAccess({ reason: 'Rabbitty usará tu biometría para autorizar envíos de Bunz.' }, resolve);
    });
    if (!granted) {
      return { ok: false, message: 'Permiso denegado. Puedes habilitarlo en los ajustes de biometría de Telegram.' };
    }
    const token = b64url(crypto.getRandomValues(new Uint8Array(32)));
    const saved = await new Promise<boolean>((resolve) => bm.updateBiometricToken(token, resolve));
    if (!saved) return { ok: false, message: 'No se pudo guardar la clave biométrica. Inténtalo de nuevo.' };
    writeJson(BIO_KEY, { backend: 'telegram' } satisfies BioRecord);
    return { ok: true, message: `${support.label} activado.` };
  }

  /* WebAuthn: crear credencial y verificarla de inmediato */
  try {
    const userId = crypto.getRandomValues(new Uint8Array(16));
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge: toBuffer(crypto.getRandomValues(new Uint8Array(32))),
        rp: { name: 'Rabbitty' },
        user: { id: toBuffer(userId), name: `rabbitty-${b64url(userId).slice(0, 10)}`, displayName: 'Rabbitty' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'preferred', userVerification: 'required' },
        timeout: 60_000,
        attestation: 'none',
      },
    })) as PublicKeyCredential | null;
    if (!credential) return { ok: false, message: 'El navegador no devolvió una credencial.' };
    writeJson(BIO_KEY, { backend: 'webauthn', credId: b64url(new Uint8Array(credential.rawId)), userId: b64url(userId) } satisfies BioRecord);
    return { ok: true, message: `${support.label} activado.` };
  } catch (err) {
    return { ok: false, message: webauthnMessage(err) };
  }
}

export async function verifyBiometric(reason = 'Confirma tu identidad para continuar'): Promise<BioOutcome> {
  const rec = readJson<BioRecord>(BIO_KEY);
  if (!rec || rec.backend === 'none') return { ok: false, message: 'La biometría no está activada.' };

  if (rec.backend === 'native') {
    const { PlatformBridge } = await import('@/lib/platform');
    const res = await PlatformBridge.authenticateBiometric(reason);
    return res.success ? { ok: true, message: 'Verificación exitosa.' } : { ok: false, message: 'Verificación cancelada o fallida.' };
  }

  if (rec.backend === 'telegram') {
    const bm = getTgBiometric();
    if (!bm) return { ok: false, message: 'Biometría de Telegram no disponible.' };
    await tgInit(bm);
    const ok = await new Promise<boolean>((resolve) => bm.authenticate({ reason }, (authenticated) => resolve(Boolean(authenticated))));
    return ok ? { ok: true, message: 'Verificación exitosa.' } : { ok: false, message: 'Verificación cancelada o fallida.' };
  }

  try {
    if (!rec.credId) return { ok: false, message: 'Credencial no encontrada. Vuelve a activar la biometría.' };
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: toBuffer(crypto.getRandomValues(new Uint8Array(32))),
        allowCredentials: [{ type: 'public-key', id: toBuffer(b64urlToBytes(rec.credId)) }],
        userVerification: 'required',
        timeout: 60_000,
      },
    });
    return assertion ? { ok: true, message: 'Verificación exitosa.' } : { ok: false, message: 'Verificación fallida.' };
  } catch (err) {
    return { ok: false, message: webauthnMessage(err) };
  }
}

export function disableBiometric(): void {
  try {
    localStorage.removeItem(BIO_KEY);
    // limpiar claves de versiones anteriores
    localStorage.removeItem('rabbitty_faceid_cred');
  } catch { /* noop */ }
}

/** True si hay al menos un método de seguridad local activo (sync, solo PIN o registro biométrico). */
export function hasAnyLocalSecurity(): boolean {
  if (typeof window === 'undefined') return false;
  const rec = readJson<BioRecord>(BIO_KEY);
  return hasPin() || Boolean(rec && rec.backend !== 'none');
}

/**
 * Autoriza una acción sensible: biometría primero (si está activa) y PIN como respaldo.
 * `askPin` muestra la UI de PIN y devuelve el valor ingresado (o null si cancela).
 */
export async function authorizeSensitiveAction(
  askPin: (opts: { lockedMs: number }) => Promise<string | null>,
  reason = 'Autoriza esta operación',
): Promise<{ ok: boolean; reason?: 'cancelled' | 'locked' | 'wrong_pin' | 'none' }> {
  if (!hasAnyLocalSecurity()) return { ok: true, reason: 'none' };

  if (await isBiometricEnabled()) {
    const bio = await verifyBiometric(reason);
    if (bio.ok) return { ok: true };
    if (!hasPin()) return { ok: false, reason: 'cancelled' };
    // biometría falló/cancelada → cae al PIN
  }

  if (hasPin()) {
    for (;;) {
      const entered = await askPin({ lockedMs: pinLockRemainingMs() });
      if (entered === null) return { ok: false, reason: 'cancelled' };
      const res = await verifyPin(entered);
      if (res.ok) return { ok: true };
      if (res.locked) return { ok: false, reason: 'locked' };
      // PIN incorrecto: la UI vuelve a pedirlo mostrando intentos restantes en el siguiente ciclo
    }
  }

  return { ok: false, reason: 'cancelled' };
}
