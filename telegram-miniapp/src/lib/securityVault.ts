/**
 * Rabbitty security vault (client-side).
 *
 * Arquitectura de seguridad:
 * - Prioridad nativa (iOS / Android): @aparajita/capacitor-biometric-auth
 * - Telegram Mini App: BiometricManager oficial
 * - Web: WebAuthn con verificación real de autenticador de plataforma
 * - Gate local: Face ID / Touch ID / PIN para autorizar acciones sensibles (transferencias, configuración crítica).
 * - La autorización final de saldos y operaciones vive en el backend.
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
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
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
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage lleno o restringido */
  }
}

async function derivePinHash(pin: string, salt: Uint8Array, iterations: number): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: toBuffer(salt), iterations },
    keyMaterial,
    256
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

interface PinRecord {
  v: 2;
  salt: string;
  hash: string;
  iter: number;
}
interface PinLock {
  fails: number;
  until: number;
}

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
  writeJson(PIN_V2_KEY, {
    v: 2,
    salt: bytesToB64(salt),
    hash,
    iter: PBKDF2_ITERATIONS,
  } satisfies PinRecord);
  try {
    localStorage.removeItem(PIN_LEGACY_KEY);
    localStorage.removeItem(PIN_LOCK_KEY);
  } catch {
    /* noop */
  }
}

export function removePin(): void {
  try {
    localStorage.removeItem(PIN_V2_KEY);
    localStorage.removeItem(PIN_LEGACY_KEY);
    localStorage.removeItem(PIN_LOCK_KEY);
  } catch {
    /* noop */
  }
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
    // Migración legacy
    let legacy: string | null = null;
    try {
      legacy = localStorage.getItem(PIN_LEGACY_KEY);
    } catch {}
    if (legacy && constantTimeEqual(legacy, pin)) {
      valid = true;
      await setPin(pin);
    }
  }

  if (valid) {
    try {
      localStorage.removeItem(PIN_LOCK_KEY);
    } catch {}
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

export type BiometricStatus =
  | 'unsupported' // Hardware no disponible o plugin ausente
  | 'not_configured' // Hardware existe pero el usuario no tiene Face ID/huella enrolada
  | 'permission_denied' // Permiso denegado
  | 'ready' // Listo para autenticar
  | 'enrolled' // Activo en Rabbitty
  | 'error';

interface BioRecord {
  backend: BiometricBackend;
  active: boolean;
  credId?: string;
  userId?: string;
  updatedAt?: number;
}

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
  const w = window as unknown as {
    Telegram?: { WebApp?: { BiometricManager?: TgBiometricManager; initData?: string } };
  };
  return w.Telegram?.WebApp?.BiometricManager || null;
}

function tgInit(bm: TgBiometricManager): Promise<void> {
  return new Promise((resolve) => {
    if (bm.isInited) return resolve();
    const timer = setTimeout(resolve, 3000);
    bm.init(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function isNativeApp(): Promise<boolean> {
  const { PlatformBridge } = await import('@/lib/platform');
  return PlatformBridge.isNative();
}

export interface BiometricSupport {
  backend: BiometricBackend;
  available: boolean;
  status: BiometricStatus;
  label: string;
}

export async function detectBiometric(): Promise<BiometricSupport> {
  if (typeof window === 'undefined') {
    return { backend: 'none', available: false, status: 'unsupported', label: 'Biometría' };
  }

  // 1. PRIORIDAD NATIVA (iOS / Android Capacitor)
  if (await isNativeApp()) {
    try {
      const { BiometricAuth, BiometryType } = await import('@aparajita/capacitor-biometric-auth');
      const check = await BiometricAuth.checkBiometry();
      if (check.isAvailable && check.biometryType !== BiometryType.none) {
        const label =
          check.biometryType === BiometryType.faceId
            ? 'Face ID'
            : check.biometryType === BiometryType.touchId
            ? 'Touch ID'
            : 'Biometría del dispositivo';
        return { backend: 'native', available: true, status: 'ready', label };
      }
      return {
        backend: 'native',
        available: false,
        status: 'not_configured',
        label: 'Face ID / Touch ID',
      };
    } catch {
      // Plugin nativo no disponible en este build
      return { backend: 'native', available: false, status: 'unsupported', label: 'Face ID / Touch ID' };
    }
  }

  // 2. TELEGRAM MINI APP
  const bm = getTgBiometric();
  if (bm) {
    try {
      await tgInit(bm);
      if (bm.isBiometricAvailable) {
        const label =
          bm.biometricType === 'face'
            ? 'Face ID'
            : bm.biometricType === 'finger'
            ? 'Huella digital'
            : 'Biometría (Telegram)';
        return { backend: 'telegram', available: true, status: 'ready', label };
      }
      return { backend: 'telegram', available: false, status: 'not_configured', label: 'Face ID (Telegram)' };
    } catch {
      return { backend: 'telegram', available: false, status: 'error', label: 'Face ID (Telegram)' };
    }
  }

  // 3. NAVEGADOR WEB (WebAuthn Platform Authenticator comprobado)
  if (
    typeof window !== 'undefined' &&
    window.PublicKeyCredential &&
    typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
  ) {
    try {
      const ok = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (ok) {
        return { backend: 'webauthn', available: true, status: 'ready', label: 'Face ID / Touch ID' };
      }
    } catch {}
  }

  // Si no está verificado, ser HONESTO: no fingir soporte
  return { backend: 'none', available: false, status: 'unsupported', label: 'Biometría' };
}

export async function isBiometricEnabled(): Promise<boolean> {
  const rec = readJson<BioRecord>(BIO_KEY);
  if (!rec || !rec.active || rec.backend === 'none') return false;

  if (rec.backend === 'native') {
    if (!(await isNativeApp())) return false;
    try {
      const { BiometricAuth, BiometryType } = await import('@aparajita/capacitor-biometric-auth');
      const check = await BiometricAuth.checkBiometry();
      return check.isAvailable && check.biometryType !== BiometryType.none;
    } catch {
      return false;
    }
  }

  if (rec.backend === 'telegram') {
    const bm = getTgBiometric();
    if (!bm) return false;
    await tgInit(bm);
    return bm.isBiometricAvailable && bm.isAccessGranted && bm.isBiometricTokenSaved;
  }

  return Boolean(rec.credId);
}

export interface BioOutcome {
  ok: boolean;
  message: string;
}

export async function enableBiometric(): Promise<BioOutcome> {
  const support = await detectBiometric();
  if (!support.available) {
    return {
      ok: false,
      message:
        support.status === 'not_configured'
          ? 'Configura Face ID o huella en los Ajustes de tu dispositivo primero.'
          : 'La biometría no está disponible en este dispositivo.',
    };
  }

  // 1. Native (Capacitor): AUTENTICAR REALMENTE ANTES DE ENROLAR
  if (support.backend === 'native') {
    try {
      const { PlatformBridge } = await import('@/lib/platform');
      const res = await PlatformBridge.authenticateBiometric('Activa la seguridad biométrica de Rabbitty');
      if (res.success) {
        writeJson(BIO_KEY, {
          backend: 'native',
          active: true,
          updatedAt: Date.now(),
        } satisfies BioRecord);
        return { ok: true, message: `${support.label} activado exitosamente.` };
      }
      return {
        ok: false,
        message: 'No se pudo verificar tu biometría. Inténtalo de nuevo o usa un PIN.',
      };
    } catch {
      return { ok: false, message: 'Error al activar biometría nativa.' };
    }
  }

  // 2. Telegram Mini App
  if (support.backend === 'telegram') {
    const bm = getTgBiometric()!;
    const granted =
      bm.isAccessGranted ||
      (await new Promise<boolean>((resolve) => {
        bm.requestAccess({ reason: 'Rabbitty usará tu biometría para autorizar envíos de Bunz.' }, resolve);
      }));
    if (!granted) {
      return { ok: false, message: 'Permiso denegado en Telegram.' };
    }
    const token = b64url(crypto.getRandomValues(new Uint8Array(32)));
    const saved = await new Promise<boolean>((resolve) => bm.updateBiometricToken(token, resolve));
    if (!saved) return { ok: false, message: 'No se pudo guardar la clave biométrica en Telegram.' };
    writeJson(BIO_KEY, { backend: 'telegram', active: true, updatedAt: Date.now() } satisfies BioRecord);
    return { ok: true, message: `${support.label} activado exitosamente.` };
  }

  // 3. WebAuthn
  try {
    const userId = crypto.getRandomValues(new Uint8Array(16));
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge: toBuffer(crypto.getRandomValues(new Uint8Array(32))),
        rp: { name: 'Rabbitty' },
        user: {
          id: toBuffer(userId),
          name: `rabbitty-${b64url(userId).slice(0, 8)}`,
          displayName: 'Rabbitty User',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
        timeout: 30_000,
      },
    })) as PublicKeyCredential | null;

    if (credential) {
      writeJson(BIO_KEY, {
        backend: 'webauthn',
        active: true,
        credId: b64url(new Uint8Array(credential.rawId)),
        userId: b64url(userId),
        updatedAt: Date.now(),
      } satisfies BioRecord);
      return { ok: true, message: `${support.label} activado.` };
    }
    return { ok: false, message: 'No se pudo crear la credencial biométrica.' };
  } catch {
    return { ok: false, message: 'La verificación biométrica web fue cancelada o no está permitida.' };
  }
}

export async function verifyBiometric(reason = 'Confirma tu identidad para continuar'): Promise<BioOutcome> {
  const isEnabled = await isBiometricEnabled();
  if (!isEnabled) return { ok: false, message: 'La biometría no está activada.' };

  const rec = readJson<BioRecord>(BIO_KEY);
  if (!rec) return { ok: false, message: 'Configuración biométrica no encontrada.' };

  if (rec.backend === 'native') {
    const { PlatformBridge } = await import('@/lib/platform');
    const res = await PlatformBridge.authenticateBiometric(reason);
    return res.success
      ? { ok: true, message: 'Verificación exitosa.' }
      : { ok: false, message: res.error || 'Verificación cancelada.' };
  }

  if (rec.backend === 'telegram') {
    const bm = getTgBiometric();
    if (!bm) return { ok: false, message: 'Biometría de Telegram no disponible.' };
    await tgInit(bm);
    const ok = await new Promise<boolean>((resolve) =>
      bm.authenticate({ reason }, (authenticated) => resolve(Boolean(authenticated)))
    );
    return ok ? { ok: true, message: 'Verificación exitosa.' } : { ok: false, message: 'Verificación cancelada.' };
  }

  if (rec.backend === 'webauthn' && rec.credId) {
    try {
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: toBuffer(crypto.getRandomValues(new Uint8Array(32))),
          allowCredentials: [{ type: 'public-key', id: toBuffer(b64urlToBytes(rec.credId)) }],
          userVerification: 'required',
          timeout: 45_000,
        },
      });
      return assertion ? { ok: true, message: 'Verificación exitosa.' } : { ok: false, message: 'Verificación fallida.' };
    } catch {
      return { ok: false, message: 'Verificación biométrica cancelada.' };
    }
  }

  return { ok: false, message: 'Método biométrico no soportado.' };
}

export function disableBiometric(): void {
  try {
    localStorage.removeItem(BIO_KEY);
    localStorage.removeItem('rabbitty_faceid_cred');
  } catch {}
}

/** Comprueba si el usuario tiene PIN o biometría activa configurada localmente. */
export function hasAnyLocalSecurity(): boolean {
  if (typeof window === 'undefined') return false;
  const rec = readJson<BioRecord>(BIO_KEY);
  return hasPin() || Boolean(rec && rec.active && rec.backend !== 'none');
}

/**
 * Gate local para proteger transferencias y operaciones sensibles.
 * 1. Intenta biometría (Face ID / Huella) si está activa.
 * 2. Si falla o no está activa, solicita PIN.
 * 3. Si el usuario no tiene ninguna seguridad local y la acción requiere protección,
 *    le solicita definir un PIN de 4 dígitos al vuelo para blindar su cuenta.
 */
export async function authorizeSensitiveAction(
  askPin: (opts: { lockedMs: number; isSetup?: boolean; title?: string; description?: string }) => Promise<string | null>,
  reason = 'Autoriza esta operación',
  options: { requireProtection?: boolean } = { requireProtection: true }
): Promise<{ ok: boolean; reason?: 'cancelled' | 'locked' | 'wrong_pin' | 'none' }> {
  // 1. Biometría si está habilitada
  if (await isBiometricEnabled()) {
    const bio = await verifyBiometric(reason);
    if (bio.ok) return { ok: true };
    // Si cancela biometría y no hay PIN, cancelar
    if (!hasPin() && !options.requireProtection) return { ok: false, reason: 'cancelled' };
    // Cae al PIN de respaldo
  }

  // 2. PIN si ya está configurado
  if (hasPin()) {
    for (;;) {
      const remaining = pinLockRemainingMs();
      if (remaining > 0) return { ok: false, reason: 'locked' };

      const entered = await askPin({ lockedMs: remaining });
      if (entered === null) return { ok: false, reason: 'cancelled' };
      const res = await verifyPin(entered);
      if (res.ok) return { ok: true };
      if (res.locked) return { ok: false, reason: 'locked' };
    }
  }

  // 3. Usuario sin seguridad local configurada:
  // Si la acción requiere protección (envío de Bunz), solicitar definir un PIN
  if (options.requireProtection) {
    const newPin = await askPin({
      lockedMs: 0,
      isSetup: true,
      title: 'Protege tu transferencia',
      description: 'Crea un PIN de 4 dígitos para autorizar y proteger tus Bunz.',
    });
    if (!newPin) return { ok: false, reason: 'cancelled' };
    await setPin(newPin);
    return { ok: true };
  }

  return { ok: true, reason: 'none' };
}
