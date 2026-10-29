# DOCUMENTO TEMPORAL DE REFERENCIA: CARACTERÍSTICAS CORE
Generado: 2026-10-29T05:20:55.134Z

Este archivo contiene el código fuente literal completo de todos los archivos involucrados en:
1. **Activación de Face ID y Biométricos**
2. **Escaneo de Códigos QR y Rabbitty Code Personalizado (Neón)**
3. **GPS, Geolocalización y Motor de Proximidad**

---

## Tabla de Contenidos
1. [telegram-miniapp/ios/App/App/Info.plist](#telegram-miniappiosAppAppInfoplist) - *1. Face ID y Biométricos*
2. [telegram-miniapp/ios/App/CapApp-SPM/Package.swift](#telegram-miniappiosAppCapApp-SPMPackageswift) - *1. Face ID y Biométricos*
3. [telegram-miniapp/src/lib/securityVault.ts](#telegram-miniappsrclibsecurityVaultts) - *1. Face ID y Biométricos*
4. [telegram-miniapp/src/components/security/PinPromptModal.tsx](#telegram-miniappsrccomponentssecurityPinPromptModaltsx) - *1. Face ID y Biométricos*
5. [telegram-miniapp/src/components/security/SmartBiometricPrompt.tsx](#telegram-miniappsrccomponentssecuritySmartBiometricPrompttsx) - *1. Face ID y Biométricos*
6. [telegram-miniapp/src/lib/scannerResolver.ts](#telegram-miniappsrclibscannerResolverts) - *2. Escaneo de QR y Rabbitty Code Personalizado*
7. [telegram-miniapp/src/components/ui/RabbittyCode.tsx](#telegram-miniappsrccomponentsuiRabbittyCodetsx) - *2. Escaneo de QR y Rabbitty Code Personalizado*
8. [telegram-miniapp/src/lib/rabbittyCodeCodec.ts](#telegram-miniappsrclibrabbittyCodeCodects) - *2. Escaneo de QR y Rabbitty Code Personalizado*
9. [telegram-miniapp/src/features/transactions/QRScanner.tsx](#telegram-miniappsrcfeaturestransactionsQRScannertsx) - *2. Escaneo de QR y Rabbitty Code Personalizado*
10. [telegram-miniapp/src/app/scan/page.tsx](#telegram-miniappsrcappscanpagetsx) - *2. Escaneo de QR y Rabbitty Code Personalizado*
11. [telegram-miniapp/src/app/business/scan/page.tsx](#telegram-miniappsrcappbusinessscanpagetsx) - *2. Escaneo de QR y Rabbitty Code Personalizado*
12. [telegram-miniapp/src/app/api/rabbitty-code/lookup/route.ts](#telegram-miniappsrcappapirabbitty-codelookuproutets) - *2. Escaneo de QR y Rabbitty Code Personalizado*
13. [telegram-miniapp/src/lib/platform.ts](#telegram-miniappsrclibplatformts) - *3. GPS, Ubicación y Proximidad*
14. [telegram-miniapp/src/features/map/InteractiveMap.tsx](#telegram-miniappsrcfeaturesmapInteractiveMaptsx) - *3. GPS, Ubicación y Proximidad*
15. [telegram-miniapp/src/features/map/nativeMapBridge.ts](#telegram-miniappsrcfeaturesmapnativeMapBridgets) - *3. GPS, Ubicación y Proximidad*
16. [telegram-miniapp/src/app/api/location/ping/route.ts](#telegram-miniappsrcappapilocationpingroutets) - *3. GPS, Ubicación y Proximidad*

---

# ========================================================
# 1. Face ID y Biométricos
# ========================================================


<a id="telegram-miniappiosAppAppInfoplist"></a>
## Archivo: `telegram-miniapp/ios/App/App/Info.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CAPACITOR_DEBUG</key>
	<string>$(CAPACITOR_DEBUG)</string>
	<key>CFBundleDevelopmentRegion</key>
	<string>en</string>
	<key>CFBundleDisplayName</key>
        <string>Rabbitty</string>
	<key>CFBundleExecutable</key>
	<string>$(EXECUTABLE_NAME)</string>
	<key>CFBundleIdentifier</key>
	<string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
	<key>CFBundleInfoDictionaryVersion</key>
	<string>6.0</string>
	<key>CFBundleName</key>
	<string>$(PRODUCT_NAME)</string>
	<key>CFBundlePackageType</key>
	<string>APPL</string>
	<key>CFBundleShortVersionString</key>
	<string>$(MARKETING_VERSION)</string>
	<key>CFBundleVersion</key>
	<string>$(CURRENT_PROJECT_VERSION)</string>
	<key>LSRequiresIPhoneOS</key>
	<true/>
	<key>UIApplicationSceneManifest</key>
	<dict>
		<key>UIApplicationSupportsMultipleScenes</key>
    <false/>
    <key>UISceneConfigurations</key>
    <dict>
      <key>UIWindowSceneSessionRoleApplication</key>
      <array>
        <dict>
            <key>UISceneConfigurationName</key>
            <string>Default Configuration</string>
            <key>UISceneDelegateClassName</key>
            <string>$(PRODUCT_MODULE_NAME).SceneDelegate</string>
            <key>UISceneStoryboardFile</key>
            <string>Main</string>
        </dict>
      </array>
    </dict>
	</dict>
	<key>UILaunchStoryboardName</key>
	<string>LaunchScreen</string>
	<key>UIMainStoryboardFile</key>
	<string>Main</string>
	<key>UIRequiredDeviceCapabilities</key>
	<array>
		<string>armv7</string>
	</array>
	<key>UISupportedInterfaceOrientations</key>
	<array>
		<string>UIInterfaceOrientationPortrait</string>
	</array>
	<key>UISupportedInterfaceOrientations~ipad</key>
	<array>
		<string>UIInterfaceOrientationPortrait</string>
	</array>
	<key>UIRequiresFullScreen</key>
	<true/>
	<key>UIViewControllerBasedStatusBarAppearance</key>
	<true/>
	<key>NSFaceIDUsageDescription</key>
	<string>Rabbitty usa Face ID para autorizar tus transferencias de Bunz y proteger tu cuenta.</string>
	<key>NSCameraUsageDescription</key>
	<string>Rabbitty requiere acceso a la cámara para escanear tu Rabbitty Code y tickets de recompensa Bunz.</string>
	<key>NSLocationWhenInUseUsageDescription</key>
	<string>Rabbitty necesita tu ubicación para mostrarte los comercios y cafeterías con cashback más cercanos en el mapa.</string>
	<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
	<string>Rabbitty utiliza tu ubicación para alertarte de recompensas y bonos Bunz al visitar negocios afiliados.</string>
	<key>NSMicrophoneUsageDescription</key>
	<string>Rabbitty utiliza el micrófono para permitirte hablar y hacer preguntas por voz a Bunzy.</string>
	<key>NSSpeechRecognitionUsageDescription</key>
	<string>Rabbitty utiliza el reconocimiento de voz para transcribir tus consultas y comandos a Bunzy.</string>
	<key>CFBundleURLTypes</key>
	<array>
		<dict>
			<key>CFBundleURLName</key>
			<string>com.rabbitty.app</string>
			<key>CFBundleURLSchemes</key>
			<array>
				<string>rabbitty</string>
			</array>
		</dict>
	</array>
	<key>UIBackgroundModes</key>
	<array>
		<string>remote-notification</string>
	</array>
</dict>
</plist>
```

---

<a id="telegram-miniappiosAppCapApp-SPMPackageswift"></a>
## Archivo: `telegram-miniapp/ios/App/CapApp-SPM/Package.swift`

```swift
// swift-tools-version: 5.9
import PackageDescription

// DO NOT MODIFY THIS FILE - managed by Capacitor CLI commands
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.5.3"),
        .package(name: "AparajitaCapacitorBiometricAuth", path: "../../../../node_modules/.pnpm/@aparajita+capacitor-biometric-auth@10.0.0/node_modules/@aparajita/capacitor-biometric-auth"),
        .package(name: "CapacitorApp", path: "../../../../node_modules/.pnpm/@capacitor+app@8.1.2_@capacitor+core@8.5.3/node_modules/@capacitor/app"),
        .package(name: "CapacitorBrowser", path: "../../../../node_modules/.pnpm/@capacitor+browser@8.0.5_@capacitor+core@8.5.3/node_modules/@capacitor/browser"),
        .package(name: "CapacitorHaptics", path: "../../../../node_modules/.pnpm/@capacitor+haptics@8.0.0_@capacitor+core@8.5.3/node_modules/@capacitor/haptics"),
        .package(name: "CapacitorPreferences", path: "../../../../node_modules/.pnpm/@capacitor+preferences@8.0.0_@capacitor+core@8.5.3/node_modules/@capacitor/preferences"),
        .package(name: "CapacitorPushNotifications", path: "../../../../node_modules/.pnpm/@capacitor+push-notifications@8.1.3_@capacitor+core@8.5.3/node_modules/@capacitor/push-notifications"),
        .package(name: "CapacitorShare", path: "../../../../node_modules/.pnpm/@capacitor+share@8.0.3_@capacitor+core@8.5.3/node_modules/@capacitor/share")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "AparajitaCapacitorBiometricAuth", package: "AparajitaCapacitorBiometricAuth"),
                .product(name: "CapacitorApp", package: "CapacitorApp"),
                .product(name: "CapacitorBrowser", package: "CapacitorBrowser"),
                .product(name: "CapacitorHaptics", package: "CapacitorHaptics"),
                .product(name: "CapacitorPreferences", package: "CapacitorPreferences"),
                .product(name: "CapacitorPushNotifications", package: "CapacitorPushNotifications"),
                .product(name: "CapacitorShare", package: "CapacitorShare")
            ]
        )
    ]
)
```

---

<a id="telegram-miniappsrclibsecurityVaultts"></a>
## Archivo: `telegram-miniapp/src/lib/securityVault.ts`

```typescript
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
```

---

<a id="telegram-miniappsrccomponentssecurityPinPromptModaltsx"></a>
## Archivo: `telegram-miniapp/src/components/security/PinPromptModal.tsx`

```tsx
'use client';

import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PIN_DIGITS } from '@/lib/securityVault';

interface PinPromptProps {
  lockedMs: number;
  title?: string;
  description?: string;
  isSetup?: boolean;
  onDone: (v: string | null) => void;
}

function PinPrompt({ lockedMs, title, description, isSetup, onDone }: PinPromptProps) {
  const [value, setValue] = useState('');
  const locked = lockedMs > 0;

  const defaultTitle = isSetup ? 'Crea tu PIN de seguridad' : 'Autoriza con tu PIN';
  const defaultDesc = locked
    ? `Bloqueado temporalmente. Inténtalo en ${Math.ceil(lockedMs / 1000)} s.`
    : isSetup
    ? `Define un PIN de ${PIN_DIGITS} dígitos para proteger tus envíos de Bunz.`
    : `Ingresa tu PIN de ${PIN_DIGITS} dígitos para continuar.`;

  return (
    <div
      className="fixed inset-0 z-10000 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.65)' }}
      onClick={() => onDone(null)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title || defaultTitle}
        className="w-full max-w-sm px-5 pt-5 pb-7 sm:rounded-3xl rounded-t-3xl flex flex-col gap-4 border border-pink-500/30"
        style={{ background: 'var(--bg-primary, #090214)', color: 'var(--text-primary, #fff)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="m-0 text-[17px] font-extrabold">{title || defaultTitle}</h3>
          <p className="m-0 mt-1 text-[13px]" style={{ color: 'var(--text-muted, #aaa)' }}>
            {description || defaultDesc}
          </p>
        </div>
        <input
          autoFocus
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={PIN_DIGITS}
          disabled={locked}
          value={value}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '');
            setValue(v);
            if (v.length === PIN_DIGITS) onDone(v);
          }}
          className="w-full rounded-xl px-3 py-3 text-center text-2xl tracking-[10px] outline-none bg-black/40 text-pink-400 font-bold"
          style={{ boxShadow: 'inset 0 0 0 1px var(--border-subtle, rgba(244,63,94,0.3))' }}
        />
        <button
          type="button"
          onClick={() => onDone(null)}
          className="rounded-full py-2.5 text-[14px] font-bold border-none cursor-pointer bg-white/5 hover:bg-white/10 active:scale-95 transition-all"
          style={{ color: 'var(--text-secondary, #ccc)' }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

/** Muestra el modal de PIN y resuelve con el PIN ingresado o null si se cancela. */
export function promptForPin(opts: {
  lockedMs: number;
  title?: string;
  description?: string;
  isSetup?: boolean;
}): Promise<string | null> {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const finish = (v: string | null) => {
      resolve(v);
      setTimeout(() => {
        root.unmount();
        host.remove();
      }, 0);
    };
    root.render(
      <PinPrompt
        lockedMs={opts.lockedMs}
        title={opts.title}
        description={opts.description}
        isSetup={opts.isSetup}
        onDone={finish}
      />
    );
  });
}
```

---

<a id="telegram-miniappsrccomponentssecuritySmartBiometricPrompttsx"></a>
## Archivo: `telegram-miniapp/src/components/security/SmartBiometricPrompt.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScanFace, X, ArrowRight, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { detectBiometric, isBiometricEnabled, enableBiometric } from '@/lib/securityVault';
import { PlatformBridge } from '@/lib/platform';
import { useToast } from '@/contexts/ToastContext';
import { SmartPromptOrchestrator } from '@/lib/smartPromptOrchestrator';

const BIOMETRIC_PROMPT_KEY = 'rabbitty_biometric_prompt_handled_v2';
const DISMISSED_COOLDOWN_MS = 24 * 60 * 60 * 1000; // Si el usuario descartó, volver a recordar tras 24h si sigue sin Face ID

export function SmartBiometricPrompt() {
  const [show, setShow] = useState(false);
  const [label, setLabel] = useState('Face ID');
  const [isApple, setIsApple] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();

  useEffect(() => {
    let alive = true;
    let timer: NodeJS.Timeout | null = null;

    const checkEligibility = async () => {
      // 1. Si ya tiene biometría activa, no mostrar nada
      const enabled = await isBiometricEnabled();
      if (!alive) return;
      if (enabled) {
        localStorage.setItem(BIOMETRIC_PROMPT_KEY, 'enabled');
        return;
      }

      // 2. Si ya fue manejado recientemente (ej: habilitado o descartado con cooldown de 24h)
      const handled = localStorage.getItem(BIOMETRIC_PROMPT_KEY);
      if (handled === 'enabled') return;
      if (handled) {
        const dismissedAt = parseInt(handled, 10);
        if (!isNaN(dismissedAt) && Date.now() - dismissedAt < DISMISSED_COOLDOWN_MS) {
          return;
        }
      }

      // 3. Verificar si el dispositivo soporta biometría
      const support = await detectBiometric();
      if (!alive) return;

      if (!support.available) {
        return;
      }

      const appleDevice = typeof navigator !== 'undefined' && /iPhone|iPad|Macintosh/i.test(navigator.userAgent);
      setIsApple(appleDevice);
      setLabel(appleDevice ? 'Face ID / Apple ID' : support.label || 'Biometría');

      if (!SmartPromptOrchestrator.canShow('faceid')) return;

      const triggerPrompt = () => {
        if (timer) clearTimeout(timer);
        // Dar 5.5s de respiro natural para que el usuario explore el feed
        timer = setTimeout(() => {
          if (alive && SmartPromptOrchestrator.acquireLock('faceid')) {
            setShow(true);
          }
        }, 5500);
      };

      // Si el ritual de bienvenida aún no se ha visto, esperar a que termine
      const ritualSeen = typeof window !== 'undefined' && localStorage.getItem('rabbitty_welcome_ritual_seen_v3');
      if (!ritualSeen) {
        const onRitualFinished = () => {
          window.removeEventListener('rabbitty:welcome-ritual-completed', onRitualFinished);
          triggerPrompt();
        };
        window.addEventListener('rabbitty:welcome-ritual-completed', onRitualFinished);
        // Respaldo de seguridad por si no hubo evento (WelcomeRitual dura ~15.5s + fade)
        timer = setTimeout(() => {
          window.removeEventListener('rabbitty:welcome-ritual-completed', onRitualFinished);
          if (alive && SmartPromptOrchestrator.acquireLock('faceid')) {
            setShow(true);
          }
        }, 18000);
      } else {
        // Si el ritual ya fue visto en visitas anteriores, esperar 5.5s después de entrar al feed
        triggerPrompt();
      }
    };

    checkEligibility();

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const handleDismiss = () => {
    PlatformBridge.hapticFeedback('light');
    SmartPromptOrchestrator.releaseLock();
    localStorage.setItem(BIOMETRIC_PROMPT_KEY, String(Date.now()));
    setShow(false);
  };

  const handleActivateNow = async () => {
    if (busy) return;
    setBusy(true);
    PlatformBridge.hapticFeedback('medium');

    try {
      const res = await enableBiometric();
      if (res.ok) {
        PlatformBridge.hapticFeedback('success');
        SmartPromptOrchestrator.releaseLock();
        localStorage.setItem(BIOMETRIC_PROMPT_KEY, 'enabled');
        showToast(`${label} activado con éxito.`, 'success');
        setShow(false);
      } else {
        PlatformBridge.hapticFeedback('warning');
        showToast(res.message || 'No se pudo activar la biometría.', 'error');
        // Si cancela el diálogo nativo, permitimos que quede en la pantalla o se cierre
      }
    } catch {
      showToast('Error al intentar activar biometría.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleGoToSettings = () => {
    PlatformBridge.hapticFeedback('light');
    localStorage.setItem(BIOMETRIC_PROMPT_KEY, 'settings_redirect');
    setShow(false);
    router.push('/security');
  };

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-9999 flex items-end sm:items-center justify-center p-4 pointer-events-none">
          {/* Backdrop con desenfoque suave */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleDismiss}
            className="absolute inset-0 bg-black/60 backdrop-blur-xs pointer-events-auto"
          />

          {/* Tarjeta de notificación Smart con diseño X / iOS glass */}
          <motion.div
            initial={{ y: 50, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 50, opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            role="dialog"
            aria-label="Activar Face ID"
            className="relative pointer-events-auto w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-white/10 flex flex-col gap-4 text-white overflow-hidden"
            style={{
              background: 'linear-gradient(145deg, rgba(24, 24, 30, 0.96) 0%, rgba(12, 12, 16, 0.98) 100%)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
            }}
          >
            {/* Botón cerrar sutil */}
            <button
              type="button"
              onClick={handleDismiss}
              className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors border-none cursor-pointer"
            >
              <X size={15} />
            </button>

            {/* Cabecera con Icono de Face ID */}
            <div className="flex items-center gap-3 pr-6">
              <div className="w-12 h-12 rounded-2xl bg-[#E91E63]/15 text-[#E91E63] border border-[#E91E63]/30 flex items-center justify-center shrink-0">
                <ScanFace size={26} strokeWidth={2.2} />
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#E91E63] flex items-center gap-1">
                    <ShieldCheck size={12} /> Máxima Seguridad
                  </span>
                </div>
                <h3 className="m-0 text-[16px] font-black tracking-tight leading-snug">
                  ¿Activar {label}?
                </h3>
              </div>
            </div>

            {/* Descripción */}
            <p className="m-0 text-[13px] text-white/70 leading-relaxed">
              {isApple
                ? 'Protege tus Bunz y autoriza envíos al instante con tu rostro usando tu clave segura guardada en tu Apple ID.'
                : 'Protege tu cuenta y autoriza envíos de Bunz de forma rápida y segura con tu sensor biométrico.'}
            </p>

            {/* Acciones */}
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={handleActivateNow}
                disabled={busy}
                className="w-full py-3 px-4 rounded-xl font-black text-sm bg-linear-to-r from-[#E91E63] to-[#FF4081] text-white border-none cursor-pointer active:scale-[0.98] transition-all shadow-lg shadow-[#E91E63]/30 flex items-center justify-center gap-2"
              >
                <ScanFace size={16} />
                <span>{busy ? 'Activando…' : `Activar ${isApple ? 'Face ID' : 'Biometría'}`}</span>
              </button>

              <div className="flex items-center justify-between px-1 pt-1">
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="text-xs font-bold text-white/45 hover:text-white/75 bg-transparent border-none cursor-pointer py-1"
                >
                  Ahora no (Omitir)
                </button>

                <button
                  type="button"
                  onClick={handleGoToSettings}
                  className="text-xs font-bold text-pink-400/90 hover:text-pink-300 bg-transparent border-none cursor-pointer py-1 flex items-center gap-1"
                >
                  <span>Ver en Ajustes</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
```

---

# ========================================================
# 2. Escaneo de QR y Rabbitty Code Personalizado
# ========================================================


<a id="telegram-miniappsrclibscannerResolverts"></a>
## Archivo: `telegram-miniapp/src/lib/scannerResolver.ts`

```typescript
/**
 * ── Rabbitty Unified Scanner Resolver ──
 * Fuente única de la verdad para interpretar, decodificar y resolver
 * cualquier código escaneado en el ecosistema Rabbitty:
 * - Códigos QR estándar (rabbitty://pay, claimToken, tableId, magic-link)
 * - Identificadores de usuario (@handle, UUID, teléfono, telegramId)
 * - Pósters de afiliados y promociones (download?ref=..., /affiliate/...)
 * - Rabbitty Code neón de 6 dígitos decodificado por cámara o canvas
 */

export interface ScanUser {
  id: string;
  username?: string | null;
  name: string;
  handle: string;
}

export interface ScanBusiness {
  id: string;
  name: string;
  checkIn?: boolean;
}

export interface ScanMagicLink {
  token: string;
  sid: string;
}

export interface ScanTable {
  tableId: string;
  branchId?: string;
}

export interface ScanQrLogin {
  qrToken: string;
  sessionId: string;
}

export type ScanType =
  | 'payment_intent'
  | 'user'
  | 'business'
  | 'magic_link'
  | 'claim'
  | 'table'
  | 'qrlogin'
  | 'url'
  | 'raw'
  | 'unrecognized';

export interface ScanResolution {
  success: boolean;
  type: ScanType;
  raw: string;
  user?: ScanUser;
  business?: ScanBusiness;
  magicLink?: ScanMagicLink;
  claimToken?: string;
  table?: ScanTable;
  qrLogin?: ScanQrLogin;
  intent?: string;
  url?: string;
  error?: string;
}

/**
 * Resuelve cualquier payload escaneado (texto de QR estándar, URL, @usuario o código numérico).
 * Consulta el resolver del servidor de forma transparente cuando se requiere validación DB.
 */
function getEndpoint(path: string): string {
  if (typeof window !== 'undefined' && window.location) {
    return path;
  }
  return `https://rabbitty.me${path}`;
}

export async function resolveScannedPayload(input: string | number): Promise<ScanResolution> {
  const isNumber = typeof input === 'number' || (typeof input === 'string' && /^\d{5,6}$/.test(input.trim()));
  const rawText = typeof input === 'string' ? input.trim() : String(input);

  if (!rawText && typeof input !== 'number') {
    return { success: false, type: 'unrecognized', raw: '', error: 'Código vacío' };
  }

  // ── 1. Código numérico de 6 dígitos (RabbittyCode barras de neón o teclado) ──
  if (isNumber) {
    const codeNum = Number(input);
    try {
      const res = await fetch(getEndpoint('/api/rabbitty-code/lookup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeNum }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.success) {
        if (data.type === 'user' && data.user) {
          return { success: true, type: 'user', raw: rawText, user: data.user };
        }
        if (data.type === 'business' && data.businessId) {
          return {
            success: true,
            type: 'business',
            raw: rawText,
            business: { id: data.businessId, name: data.name || 'Negocio Afiliado', checkIn: data.checkIn },
          };
        }
        if (data.type === 'qrlogin' && data.qrToken) {
          return {
            success: true,
            type: 'qrlogin',
            raw: rawText,
            qrLogin: { qrToken: data.qrToken, sessionId: data.sessionId },
          };
        }
      }
    } catch (err) {
      console.warn('[ScannerResolver] Error resolving numeric code:', err);
    }
  }

  // ── 2. Protocolo nativo: rabbitty://pay ──
  if (/^rabbitty:\/\/pay/i.test(rawText)) {
    try {
      const norm = rawText.replace(/^rabbitty:\/\/pay\??/i, '');
      const params = new URLSearchParams(norm);
      const intent = params.get('intent');
      const to = params.get('to');

      if (intent) {
        return { success: true, type: 'payment_intent', raw: rawText, intent };
      }
      if (to) {
        const cleanedTo = decodeURIComponent(to).trim();
        // Resolución SERVER: el id devuelto es el UUID real (el mint lo exige).
        // Si el servidor no responde, entregamos el handle con flag para que el
        // consumidor no lo use como id sin resolver.
        try {
          const res = await fetch(getEndpoint('/api/rabbitty-code/lookup'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: rawText }),
          });
          const data = await res.json().catch(() => ({}));
          if (data?.success && data.type === 'user' && data.user) {
            return { success: true, type: 'user', raw: rawText, user: data.user };
          }
          if (data?.success && data.type === 'business' && data.businessId) {
            return { success: true, type: 'business', raw: rawText, business: { id: data.businessId, name: data.name || 'Negocio Afiliado' } };
          }
        } catch (err) {
          console.warn('[ScannerResolver] pay?to resolve failed:', err);
        }
        return {
          success: false,
          type: 'user',
          raw: rawText,
          error: 'No se pudo resolver al usuario (sin conexión o no registrado)',
          user: { id: cleanedTo, handle: cleanedTo.startsWith('@') ? cleanedTo : `@${cleanedTo}`, name: cleanedTo },
        };
      }
    } catch {}
  }

  // ── 3. Magic Link de sincronización de terminal (iPad / Mostrador) ──
  if (rawText.includes('/magic-link') && rawText.includes('token=') && rawText.includes('sid=')) {
    try {
      const url = new URL(rawText, typeof window !== 'undefined' ? window.location.origin : 'https://rabbitty.me');
      const token = url.searchParams.get('token');
      const sid = url.searchParams.get('sid');
      if (token && sid) {
        return { success: true, type: 'magic_link', raw: rawText, magicLink: { token, sid } };
      }
    } catch {}
  }

  // ── 4. Reclamo de ticket / QR de caja (claimToken) ──
  if (rawText.includes('claimToken=') || rawText.includes('claim=')) {
    try {
      const params = new URLSearchParams(rawText.includes('?') ? rawText.split('?')[1] : rawText);
      const token = params.get('claimToken') || params.get('claim');
      if (token) {
        return { success: true, type: 'claim', raw: rawText, claimToken: token };
      }
    } catch {}
  }

  // ── 5. Mesa / Restaurante (tableId) ──
  if (rawText.includes('tableId=') || rawText.includes('/qr/table/')) {
    try {
      let tableId = '';
      let branchId: string | undefined = undefined;

      if (rawText.includes('/qr/table/')) {
        const match = rawText.match(/\/qr\/table\/([^/?&#\s]+)/i);
        if (match) tableId = match[1];
      }
      if (!tableId) {
        const params = new URLSearchParams(rawText.includes('?') ? rawText.split('?')[1] : rawText);
        tableId = params.get('tableId') || '';
        branchId = params.get('branchId') || params.get('branch') || undefined;
      }

      if (tableId) {
        return { success: true, type: 'table', raw: rawText, table: { tableId, branchId } };
      }
    } catch {}
  }

  // ── 6. Check-in de sucursal / mostrador directo (branchId sin mesa) ──
  if (rawText.includes('branchId=') || rawText.includes('branch=')) {
    try {
      const params = new URLSearchParams(rawText.includes('?') ? rawText.split('?')[1] : rawText);
      const branchId = params.get('branchId') || params.get('branch');
      if (branchId && !params.get('tableId') && !params.get('claimToken')) {
        const res = await fetch(getEndpoint('/api/rabbitty-code/lookup'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: rawText }),
        });
        const d = await res.json().catch(() => ({}));
        if (d?.success && d.businessId) {
          return {
            success: true,
            type: 'business',
            raw: rawText,
            business: { id: d.businessId, name: d.name || 'Negocio Afiliado', checkIn: true },
          };
        }
      }
    } catch {}
  }

  // ── 7. Handle de usuario directo (@usuario o UUID) ──
  if (rawText.startsWith('@') || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawText)) {
    try {
      const res = await fetch(getEndpoint('/api/rabbitty-code/lookup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawText }),
      });
      const d = await res.json().catch(() => ({}));
      if (d?.success && d.type === 'user' && d.user) {
        return { success: true, type: 'user', raw: rawText, user: d.user };
      }
    } catch {}
  }

  // ── 8. Consulta de respaldo en el backend para cualquier texto / URL ──
  try {
    const res = await fetch('/api/rabbitty-code/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: rawText }),
    });
    const d = await res.json().catch(() => ({}));
    if (d?.success) {
      if (d.type === 'user' && d.user) {
        return { success: true, type: 'user', raw: rawText, user: d.user };
      }
      if (d.type === 'business' && d.businessId) {
        return {
          success: true,
          type: 'business',
          raw: rawText,
          business: { id: d.businessId, name: d.name || 'Negocio Afiliado', checkIn: d.checkIn },
        };
      }
      if (d.type === 'url' && d.url) {
        return { success: true, type: 'url', raw: rawText, url: d.url };
      }
    }
  } catch (err) {
    console.warn('[ScannerResolver] Fallback lookup error:', err);
  }

  // ── 9. URL genérica o texto crudo ──
  if (rawText.startsWith('http://') || rawText.startsWith('https://')) {
    return { success: true, type: 'url', raw: rawText, url: rawText };
  }

  return { success: true, type: 'raw', raw: rawText };
}

```

---

<a id="telegram-miniappsrccomponentsuiRabbittyCodetsx"></a>
## Archivo: `telegram-miniapp/src/components/ui/RabbittyCode.tsx`

```tsx
import React, { useMemo } from 'react';
import { barsFromCode, code6FromData } from '@/lib/rabbittyCodeCodec';

interface RabbittyCodeProps {
  data: string;
  size?: number;
  showCardFrame?: boolean;
  className?: string;
}

export default function RabbittyCode({ data, size = 260, showCardFrame = true, className = '' }: RabbittyCodeProps) {
  // ── Barras machine-readable: codifican el código de 6 dígitos del payload ──
  // (decodificable por el escáner de la app; ver lib/rabbittyCodeCodec.ts)
  const waveBars = useMemo(() => barsFromCode(code6FromData(String(data ?? ''))), [data]);

  // Generate unique concentric ring dash/dot configurations for this user code
  const ringConfigs = useMemo(() => {
    return [
      { r: 24, dash: '6 4', speed: 8 },
      { r: 36, dash: '12 6', speed: 12 },
      { r: 48, dash: '8 8', speed: 10 },
      { r: 60, dash: '16 4 4 4', speed: 15 },
      { r: 72, dash: '10 5', speed: 9 },
      { r: 84, dash: '20 8', speed: 14 },
    ];
  }, [data]);

  return (
    <div className={`relative inline-flex flex-col items-center justify-center ${className}`} style={{ width: size, height: showCardFrame ? size * 1.5 : size }}>
      {showCardFrame && (
        <>
          {/* Top Neon Bunny Geometry - Crown of the Card */}
          <div className="absolute -top-10 z-30 pointer-events-none drop-shadow-[0_0_16px_rgba(244,63,94,0.9)]">
            <img 
              src="/Rabbitty_vector.png" 
              alt="Rabbitty Vector" 
              className="w-[84px] h-[98px] object-contain filter drop-shadow-[0_0_10px_#F43F5E]" 
            />
          </div>

        </>
      )}

      {/* Main Glass Card Frame */}
      <div
        className={`relative w-full h-full rounded-[38px] overflow-hidden flex items-center justify-center p-5 transition-all duration-300 ${showCardFrame
            ? 'bg-gradient-to-b from-[#19092B]/95 via-[#110520]/95 to-[#07020D]/98 border-2 border-pink-500/40 shadow-[0_0_60px_rgba(233,30,99,0.3)] backdrop-blur-2xl'
            : 'bg-[#0B0416] border border-pink-500/30 rounded-[32px]'
          }`}
      >
        {/* Glowing Background Radial Aura */}
        <div className="absolute inset-0 bg-radial from-pink-500/20 via-purple-600/10 to-transparent pointer-events-none" />

        {/* 1. Concentric Wave Code Matrix (Anillos de Código Propietario) */}
        <svg width={size * 0.95} height={size * 0.95} viewBox="0 0 200 200" fill="none" className="absolute inset-0 m-auto pointer-events-none">
          {ringConfigs.map((cfg, idx) => (
            <circle
              key={idx}
              cx="100"
              cy="100"
              r={cfg.r}
              stroke={idx % 2 === 0 ? "#F43F5E" : "#8B5CF6"}
              strokeWidth={idx % 2 === 0 ? "1.8" : "1.2"}
              strokeDasharray={cfg.dash}
              strokeLinecap="round"
              className="opacity-70"
            />
          ))}
        </svg>

        {/* 2. Four Corner Holographic Position Ring Targets (Reemplaza a los módulos QR genéricos) */}
        <div className="absolute inset-7 pointer-events-none flex flex-col justify-between p-1 z-10">
          <div className="flex justify-between">
            {/* Top Left Target */}
            <div className="w-10 h-10 border-2 border-pink-500 rounded-2xl p-1 flex items-center justify-center bg-[#130624]/90 shadow-[0_0_18px_rgba(244,63,94,0.7)]">
              <div className="w-full h-full border border-purple-400 rounded-xl flex items-center justify-center">
                <div className="w-3.5 h-3.5 bg-gradient-to-br from-pink-500 to-purple-600 rounded-md" />
              </div>
            </div>
            {/* Top Right Target */}
            <div className="w-10 h-10 border-2 border-pink-500 rounded-2xl p-1 flex items-center justify-center bg-[#130624]/90 shadow-[0_0_18px_rgba(244,63,94,0.7)]">
              <div className="w-full h-full border border-purple-400 rounded-xl flex items-center justify-center">
                <div className="w-3.5 h-3.5 bg-gradient-to-br from-pink-500 to-purple-600 rounded-md" />
              </div>
            </div>
          </div>
          <div className="flex justify-between items-end">
            {/* Bottom Left Target */}
            <div className="w-10 h-10 border-2 border-pink-500 rounded-2xl p-1 flex items-center justify-center bg-[#130624]/90 shadow-[0_0_18px_rgba(244,63,94,0.7)]">
              <div className="w-full h-full border border-purple-400 rounded-xl flex items-center justify-center">
                <div className="w-3.5 h-3.5 bg-gradient-to-br from-pink-500 to-purple-600 rounded-md" />
              </div>
            </div>
            {/* Bottom Right Key Indicator Target */}
            <div className="w-6 h-6 border-2 border-purple-400 rounded-xl p-0.5 flex items-center justify-center bg-[#130624]/90 shadow-[0_0_12px_rgba(168,85,247,0.6)]">
              <div className="w-full h-full bg-purple-400 rounded-sm" />
            </div>
          </div>
        </div>

        {/* 3. Center Soundwave Code Box (Núcleo de Onda Propietario) */}
        <div className="relative z-20 flex items-center justify-center gap-[4px] px-6 py-4 bg-[#090214]/95 backdrop-blur-xl border border-pink-500/50 rounded-2xl shadow-[0_0_30px_rgba(233,30,99,0.4)]">
          {/* Vertical Center Division Axis */}
          <div className="absolute top-2 bottom-2 left-1/2 -translate-x-1/2 w-[1.5px] bg-gradient-to-b from-transparent via-pink-400 to-transparent opacity-50" />

          {waveBars.map((h, i) => (
            <div
              key={i}
              className="w-[4px] rounded-full transition-all duration-300 bg-gradient-to-t from-purple-600 via-pink-500 to-cyan-300 drop-shadow-[0_0_8px_rgba(244,63,94,0.8)]"
              style={{
                height: `${h * (size / 260)}px`,
                opacity: 0.9,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

<a id="telegram-miniappsrclibrabbittyCodeCodects"></a>
## Archivo: `telegram-miniapp/src/lib/rabbittyCodeCodec.ts`

```typescript
/**
 * ── RabbittyCode Codec ──
 * Codificación machine-readable de nuestro QR Neón propietario.
 * Las 13 barras de onda llevan el código de 6 dígitos del usuario:
 *   - Barras 1..10: valor base-4 (4^10 = 1,048,576 ≥ 1,000,000), MSB primero
 *   - Barra 11: paridad (suma de dígitos mod 4)
 *   - Barra 12: ancla ALTA fija (85%) — referencia de calibración
 *   - Barra 13: ancla BAJA fija (20%) — referencia de calibración
 * Niveles base-4: 20%, 41.7%, 63.3%, 85% — tolerantes a ruido de cámara.
 * Compatible con el look histórico (mismos límites 20–85 del render).
 */

export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < (str || 'rabbitty').length; i++) {
    hash = (hash << 5) - hash + (str || 'rabbitty').charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Código de 6 dígitos (0..999999) determinista para cualquier payload. */
export function code6FromData(data: string): number {
  return hashString(data || 'rabbitty') % 1_000_000;
}

const H_MIN = 20;
const H_MAX = 85;
const LEVELS = 4;
export function levelToHeight(d: number): number {
  return H_MIN + (d * (H_MAX - H_MIN)) / (LEVELS - 1);
}

/** Alturas de las 13 barras (porcentaje 20–85) que codifican el código. */
export function barsFromCode(code: number): number[] {
  const value = Math.max(0, Math.min(999_999, Math.round(code)));
  const digits: number[] = [];
  for (let i = 9; i >= 0; i--) {
    digits.push(Math.floor(value / Math.pow(4, i)) % 4);
  }
  const parity = digits.reduce((a, b) => a + b, 0) % 4;
  return [
    ...digits.map(levelToHeight),
    levelToHeight(parity),
    H_MAX, // ancla alta
    H_MIN, // ancla baja
  ];
}

/** Decodifica alturas medidas (0..1 relativas o 20..85) → código de 6 dígitos o null. */
export function codeFromBars(rawHeights: number[]): number | null {
  if (!rawHeights || rawHeights.length !== 13) return null;
  const heights = rawHeights.map((h) => Number(h) || 0);
  const max = Math.max(...heights);
  const min = Math.min(...heights);
  if (max - min < 1e-6) return null;
  // Normalizar al rango 20..85 usando anclas dinámicas del propio frame
  const norm = heights.map((h) => H_MIN + ((h - min) / (max - min)) * (H_MAX - H_MIN));

  const digits: number[] = [];
  for (let i = 0; i < 10; i++) {
    const h = norm[i];
    const d = Math.round(((h - H_MIN) / (H_MAX - H_MIN)) * (LEVELS - 1));
    if (d < 0 || d > 3) return null;
    digits.push(d);
  }
  const parity = norm[10] ?? 0;
  const parityDigit = Math.round(((parity - H_MIN) / (H_MAX - H_MIN)) * (LEVELS - 1));
  const expectedParity = digits.reduce((a, b) => a + b, 0) % 4;
  if (parityDigit !== expectedParity) return null;

  let value = 0;
  for (const d of digits) value = value * 4 + d;
  if (value > 999_999) return null;
  return value;
}

/** Detector de neón (mismos umbrales del escáner): rosa/magenta, morado, núcleo claro. */
export function isNeonPixel(r: number, g: number, b: number): boolean {
  return (
    (r >= 110 && b >= 75 && r - g >= 20) ||
    (b >= 110 && r >= 65 && b - g >= 20) ||
    (r >= 190 && b >= 160 && g >= 100 && r - g >= 15)
  );
}

/**
 * Mide las 13 barras por POSICIÓN ESPERADA (equidistantes) — robusto a
 * resolución de cámara, reflejos y barras que se fusionan por píxeles.
 * @param data RGBA del frame cuadrado (resampleado) del centro del video
 * @param w dimensión del frame (cuadrado)
 * @returns alturas relativas (13) o null si no hay patrón suficiente
 */
export function measureBarsFromFrame(data: Uint8ClampedArray | Uint8Array, w: number): number[] | null {
  const y0 = Math.floor(w * 0.2);
  const y1 = Math.floor(w * 0.8);
  const colHas = new Uint8Array(w);
  const colTop = new Int32Array(w).fill(w);
  const colBottom = new Int32Array(w).fill(-1);

  for (let x = 0; x < w; x++) {
    let count = 0;
    let min = w, max = -1;
    for (let y = y0; y < y1; y++) {
      const idx = (y * w + x) * 4;
      if (isNeonPixel(data[idx], data[idx + 1], data[idx + 2])) {
        count++;
        if (y < min) min = y;
        if (y > max) max = y;
      }
    }
    if (count >= 2) { colHas[x] = 1; colTop[x] = min; colBottom[x] = max; }
  }

  // Span del núcleo: columnas neón contiguas (con tolerancia a gaps de 2px)
  let minX = -1, maxX = -1;
  for (let x = 0; x < w; x++) {
    if (colHas[x]) { if (minX === -1) minX = x; maxX = x; }
  }
  if (minX === -1 || maxX - minX < w * 0.12) return null;

  const unit = (maxX - minX) / 25; // 13 barras + 12 gaps = 25 unidades
  const heights: number[] = [];
  for (let i = 0; i < 13; i++) {
    const center = minX + (2 * i + 0.5) * unit;
    const half = Math.max(1, unit * 0.45);
    const cx0 = Math.max(minX, Math.floor(center - half));
    const cx1 = Math.min(maxX, Math.ceil(center + half));
    let top = w, bot = -1;
    for (let x = cx0; x <= cx1; x++) {
      if (x < 0 || x >= w || !colHas[x]) continue;
      if (colTop[x] < top) top = colTop[x];
      if (colBottom[x] > bot) bot = colBottom[x];
    }
    if (bot <= top) { heights.push(0); continue; }
    heights.push(bot - top);
  }
  // Sanidad: al menos 8 barras con presencia
  const alive = heights.filter((h) => h > 0).length;
  if (alive < 8) return null;
  return heights;
}
```

---

<a id="telegram-miniappsrcfeaturestransactionsQRScannertsx"></a>
## Archivo: `telegram-miniapp/src/features/transactions/QRScanner.tsx`

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { codeFromBars, measureBarsFromFrame } from '@/lib/rabbittyCodeCodec';
import { PlatformBridge } from '@/lib/platform';
import { resolveScannedPayload } from '@/lib/scannerResolver';
import { toast } from 'sonner';

interface QRScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
}

export default function QRScanner({ onScan, onClose }: QRScannerProps) {
  const [error, setError] = useState<string>('');
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    // ── Decoder de RabbittyCode (neón): corre en paralelo al html5-qrcode ──
    let consecutiveNeonFrames = 0;
    let decodeFailCount = 0;
    let hintShown = false;
    let isDecoding = false;
    let stopped = false;
    const HI = 360;
    const hiCanvas = document.createElement('canvas');
    hiCanvas.width = HI;
    hiCanvas.height = HI;
    const hctx = hiCanvas.getContext('2d', { willReadFrequently: true });

    const isNeonPx = (r: number, g: number, b: number) =>
      (r >= 110 && b >= 75 && r - g >= 20) ||
      (b >= 110 && r >= 65 && b - g >= 20) ||
      (r >= 190 && b >= 160 && g >= 100 && r - g >= 15);

    const interval = setInterval(async () => {
      if (isDecoding || stopped || !hctx) return;
      const container = document.getElementById('reader');
      const video = container?.querySelector('video') as HTMLVideoElement | null;
      if (!video || video.readyState < 2 || video.videoWidth === 0) return;

      try {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const cropSize = Math.min(vw, vh) * 0.65;
        const sx = (vw - cropSize) / 2;
        const sy = (vh - cropSize) / 2;
        hctx.drawImage(video, sx, sy, cropSize, cropSize, 0, 0, HI, HI);
        const data = hctx.getImageData(0, 0, HI, HI).data;

        let darkCount = 0;
        let neonCount = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          if (r <= 145 && g <= 125 && b <= 160) darkCount++;
          if (isNeonPx(r, g, b)) neonCount++;
        }
        const darkRatio = darkCount / (HI * HI);
        const neonRatio = neonCount / (HI * HI);
        if (darkRatio < 0.2 || neonRatio < 0.012) {
          consecutiveNeonFrames = 0;
          return;
        }
        consecutiveNeonFrames++;
        if (consecutiveNeonFrames < 2) return;
        consecutiveNeonFrames = 0;
        isDecoding = true;

        // Medir las 13 barras por POSICIÓN ESPERADA (equidistantes — robusto)
        const heights = measureBarsFromFrame(data, HI);
        let decoded: number | null = null;
        if (heights) {
          decoded = codeFromBars(heights);
        }

        if (decoded !== null) {
          try {
            const resolution = await resolveScannedPayload(decoded);
            if (resolution.success && resolution.type === 'user' && resolution.user) {
              stopped = true;
              try { await scannerRef.current?.stop(); } catch {}
              PlatformBridge.hapticFeedback('success');
              onScan(`rabbitty://pay?to=${encodeURIComponent(resolution.user.handle || resolution.user.id)}`);
              return;
            }
          } catch { /* reintenta */ }
        }

        decodeFailCount += 1;
        if (decodeFailCount === 3 && !hintShown) {
          hintShown = true;
          toast.info('Casi… acércate (~15-25 cm), de frente y con buena luz 🐰');
        }
      } catch {
        // silencioso — el html5-qrcode sigue en paralelo
      } finally {
        isDecoding = false;
      }
    }, 400);

    const scanner = new Html5Qrcode("reader");
    scannerRef.current = scanner;

    scanner.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
      },
      (decodedText) => {
        stopped = true;
        clearInterval(interval);
        // Stop scanning once we get a result to prevent multiple triggers
        scanner.stop().then(() => {
          onScan(decodedText);
        }).catch(err => {
          console.error("Failed to stop scanner", err);
          onScan(decodedText);
        });
      },
      () => {
        // parse error, ignored usually
      }
    ).catch(err => {
      console.error(err);
      setError("No se pudo acceder a la cámara. Revisa los permisos.");
    });

    return () => {
      stopped = true;
      clearInterval(interval);
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center">
      <div className="w-full max-w-md p-4 flex flex-col items-center">
        <div className="w-full bg-white rounded-3xl overflow-hidden relative">
          <div id="reader" className="w-full bg-black min-h-75"></div>
          
          <div className="absolute inset-0 border-40 border-black/40 pointer-events-none z-10" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-50 h-50 border-2 border-pink-500 rounded-3xl pointer-events-none z-20" />
        </div>

        {error && <p className="text-red-500 font-bold mt-4 text-center">{error}</p>}
        
        <p className="text-white text-center mt-6 text-sm font-medium">Centra el código QR en el cuadro</p>
        
        <button 
          onClick={onClose}
          className="mt-8 bg-white/10 text-white rounded-full px-8 py-3 font-bold active:scale-95 transition-transform"
        >
          Cancelar Escaneo
        </button>
      </div>
    </div>
  );
}
```

---

<a id="telegram-miniappsrcappscanpagetsx"></a>
## Archivo: `telegram-miniapp/src/app/scan/page.tsx`

```tsx
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Keyboard } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';
import RabbittyCode from '@/components/ui/RabbittyCode';
import { QRCodeSVG } from 'qrcode.react';
import BottomNav from '@/components/BottomNav';
import Button from '@/components/ui/Button';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTheme } from '@/contexts/ThemeContext';
import { resolveScannedPayload } from '@/lib/scannerResolver';

import { PlatformBridge } from '@/lib/platform';
import { useToast } from '@/contexts/ToastContext';

interface PaymentIntentData {
  id?: string;
  amountMxn?: number;
  bunzAmount?: number;
  tenantId?: string;
  status?: string;
}

export default function ScanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'my-code' ? 'my-code' : 'scan';

  const { address } = useWallet();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const { showToast } = useToast();
  
  const qrValue = user?.id || user?.telegramId || address || 'rabbitty_guest';
  const API_SERVER_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  const getAuthHeader = async () => {
    try {
      if (PlatformBridge.isTelegram()) {
        const mod = await import('@twa-dev/sdk');
        if (mod.default?.initData) return `tma ${mod.default.initData}`;
      }
    } catch {}
    const token = await PlatformBridge.getSessionToken();
    if (token) return `Bearer ${token}`;
    return "Bearer TMA_TOKEN";
  };
  const [hasCamera, setHasCamera] = useState(() => typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices));
  const [result, setResult] = useState<PaymentIntentData | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [activeTab, setActiveTab] = useState<'scan' | 'my-code'>(initialTab);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isTransitioningRef = useRef(false);
  const startScanningRef = useRef<() => void>(() => {});

  useEffect(() => {
    import('@twa-dev/sdk').then((mod) => {
      const app = mod.default;
      app.ready(); app.expand();
      try { 
        const bg = isDark ? '#111111' : '#F8F9FA';
        app.setBackgroundColor(bg); 
        app.setHeaderColor(bg); 
      } catch {}
    });

    // Auto-login PC/Portal si el usuario abrió el link directo /scan?qrlogin_...
    const rawSearch = typeof window !== 'undefined' ? window.location.search : '';
    const urlQrLogin =
      searchParams.get('qrlogin') ||
      (rawSearch.includes('qrlogin_') ? rawSearch.split('qrlogin_')[1]?.split('&')[0]?.split('?')[0] : null);
    if (urlQrLogin) {
      (async () => {
        try {
          const headers = await PlatformBridge.getAuthHeaders();
          const res = await fetch('/api/auth/qr/scan', {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ qrToken: urlQrLogin }),
          });
          const data = await res.json();
          if (data.success) {
            alert('¡Acceso autorizado exitosamente en tu pantalla! 🪄');
            router.push('/profile');
          } else {
            alert('Error de autorización QR: ' + (data.error || 'Token inválido o expirado'));
          }
        } catch {
          alert('Error de conexión al autorizar el acceso QR.');
        }
      })();
      return;
    }

    // Auto-reclamo si el usuario abrió el link directo del ticket /scan?claimToken=...
    const urlClaimToken = searchParams.get('claimToken') || searchParams.get('claim');
    if (urlClaimToken) {
      (async () => {
        try {
          const headers = await PlatformBridge.getAuthHeaders();
          const claimRes = await fetch('/api/pos/claim-ticket', {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ claimToken: urlClaimToken }),
          });
          const claimData = await claimRes.json();
          if (claimData.success) {
            alert(`🐰 ¡Felicidades! Se han acreditado +${claimData.bunzAwarded} Bunz a tu cuenta por el ticket #${claimData.orderNumber}.`);
            router.push('/profile/wallet');
          } else {
            alert(claimData.error || 'No se pudo reclamar este ticket.');
          }
        } catch {
          alert('Error al conectar con el servidor para reclamar el ticket.');
        }
      })();
    }

    // Auto-vinculación a mesa si el usuario abrió el link directo /scan?tableId=... o /scan?table=...
    const urlTableId = searchParams.get('tableId') || searchParams.get('table');
    const urlBranchId = searchParams.get('branchId') || searchParams.get('branch');
    const urlBusiness = searchParams.get('business') || 'este comercio';

    if (urlTableId) {
      (async () => {
        try {
          const headers = await PlatformBridge.getAuthHeaders();
          const tableRes = await fetch('/api/pos/claim-table', {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ tableId: urlTableId, branchId: urlBranchId || undefined }),
          });
          const tableData = await tableRes.json();
          if (tableData.success) {
            alert(`🐰 ¡Conectado a la Mesa #${tableData.table.number}! Tu comanda está abierta en caja y acumularás Bunz.`);
            router.push(`/pos-menu/${urlTableId}`);
          } else {
            alert(tableData.error || 'No se pudo vincular a la mesa.');
          }
        } catch {
          alert('Error al conectar con el servidor para vincular a la mesa.');
        }
      })();
    } else if (urlBranchId && !urlClaimToken) {
      // 🐰 Check-in de mostrador (QR Neón sin mesa)
      try {
        localStorage.setItem('rabbitty_last_branch_id', urlBranchId);
        localStorage.setItem('rabbitty_last_business_name', urlBusiness);
      } catch {}
      alert(`🐰 ¡Estás en ${urlBusiness}! Check-in registrado. Tus compras acumulan Bunz automáticamente.`);
      router.push('/profile/wallet');
    }
  }, [isDark, searchParams, router]);

  const requestCameraAccess = async () => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        stream.getTracks().forEach(t => t.stop());
        setHasCamera(true);
      } catch (e) {
        console.error("Camera access failed:", e);
        setHasCamera(false);
      }
    }
  };

  const stopScanning = useCallback(async () => {
    const inst = scannerRef.current;
    if (!inst || isTransitioningRef.current) return;
    isTransitioningRef.current = true;
    try {
      if (inst.isScanning) {
        await inst.stop();
      }
    } catch {}
    try {
      inst.clear();
    } catch {}
    scannerRef.current = null;
    isTransitioningRef.current = false;
  }, []);

  const handleDispatchPayload = useCallback(async (rawPayload: string | number) => {
    PlatformBridge.hapticFeedback('success');

    const res = await resolveScannedPayload(rawPayload);
    if (!res.success) {
      if (res.error) alert(res.error);
      startScanningRef.current();
      return;
    }

    // 1. Magic Link (terminal iPad / caja)
    if (res.type === 'magic_link' && res.magicLink) {
      await stopScanning();
      router.push(`/magic-link?token=${encodeURIComponent(res.magicLink.token)}&sid=${encodeURIComponent(res.magicLink.sid)}`);
      return;
    }

    // 2. Ticket Claim (claimToken)
    if (res.type === 'claim' && res.claimToken) {
      await stopScanning();
      try {
        const headers = await PlatformBridge.getAuthHeaders();
        const claimRes = await fetch('/api/pos/claim-ticket', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ claimToken: res.claimToken }),
        });
        const claimData = await claimRes.json();
        if (claimData.success) {
          alert(`🐰 ¡Felicidades! Se han acreditado +${claimData.bunzAwarded} Bunz a tu cuenta por el ticket #${claimData.orderNumber}.`);
          router.push('/profile/wallet');
          return;
        } else {
          alert(claimData.error || 'No se pudo reclamar este ticket.');
          startScanningRef.current();
          return;
        }
      } catch {
        alert('Error al conectar con el servidor para reclamar el ticket.');
        startScanningRef.current();
        return;
      }
    }

    // 3. Table QR
    if (res.type === 'table' && res.table) {
      await stopScanning();
      try {
        const headers = await PlatformBridge.getAuthHeaders();
        const tableRes = await fetch('/api/pos/claim-table', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ tableId: res.table.tableId, branchId: res.table.branchId }),
        });
        const tableData = await tableRes.json();
        if (tableData.success) {
          alert(`🐰 ¡Conectado a la Mesa #${tableData.table.number}! Tu comanda está abierta en caja y acumularás Bunz.`);
          router.push(`/pos-menu/${res.table.tableId}`);
          return;
        } else {
          alert(tableData.error || 'No se pudo vincular a la mesa.');
          startScanningRef.current();
          return;
        }
      } catch {
        alert('Error al conectar con el servidor para vincular a la mesa.');
        startScanningRef.current();
        return;
      }
    }

    // 4. Negocio afiliado / check-in
    if (res.type === 'business' && res.business) {
      await stopScanning();
      router.push(`/affiliate/${res.business.id}`);
      return;
    }

    // 5. Usuario (@handle / id)
    if (res.type === 'user' && res.user) {
      await stopScanning();
      router.push(`/profile/wallet?to=${encodeURIComponent(res.user.handle || res.user.id)}`);
      return;
    }

    // 6. QR Login (/impresos o PC)
    if (res.type === 'qrlogin' && res.qrLogin) {
      await stopScanning();
      try {
        const headers = await PlatformBridge.getAuthHeaders();
        const bindRes = await fetch('/api/auth/qr/scan', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ qrToken: res.qrLogin.qrToken }),
        });
        const bindData = await bindRes.json();
        if (bindData?.success) {
          alert('¡Acceso autorizado en la pantalla! 🪄');
          return;
        }
      } catch {}
      startScanningRef.current();
      return;
    }

    // 7. URL externa
    if (res.type === 'url' && res.url) {
      await stopScanning();
      if (PlatformBridge.isNative()) {
        import('@capacitor/browser').then(({ Browser }) => Browser.open({ url: res.url! })).catch(() => { window.open(res.url, '_blank'); });
      } else if (PlatformBridge.isTelegram()) {
        import('@twa-dev/sdk').then((mod) => mod.default.openLink(res.url!)).catch(() => { window.open(res.url, '_blank'); });
      } else {
        window.open(res.url, '_blank');
      }
      return;
    }

    // 8. POS Payment Intent
    let intentId = res.intent || (typeof rawPayload === 'string' ? rawPayload.trim() : '');
    if (intentId.includes('pay_')) {
      intentId = intentId.split('pay_')[1].split(/[&?#\s]/)[0];
    } else if (intentId.includes('pi_')) {
      intentId = 'pi_' + intentId.split('pi_')[1].split(/[&?#\s]/)[0];
    }

    if (intentId) {
      await stopScanning();
      const authHeader = await getAuthHeader();
      const inputStr = encodeURIComponent(JSON.stringify({ "0": { intentId } }));
      fetch(`${API_SERVER_URL}/payments.getIntent?batch=1&input=${inputStr}`, {
        headers: { "Authorization": authHeader }
      })
      .then(r => r.json())
      .then(data => {
        if (data[0] && data[0].result && data[0].result.data) {
          setResult(data[0].result.data);
        } else {
          alert("Intención de pago no encontrada o inválida.");
          setResult(null);
          startScanningRef.current();
        }
      })
      .catch(() => {
        alert("Error al contactar el servidor.");
        setResult(null);
        startScanningRef.current();
      });
      return;
    }

    // Fallback no reconocido
    startScanningRef.current();
  }, [API_SERVER_URL, router, stopScanning]);

  const startScanning = useCallback(async () => {
    if (isTransitioningRef.current || scannerRef.current?.isScanning) return;
    const el = document.getElementById("qr-reader");
    if (!el) return;

    try {
      isTransitioningRef.current = true;
      const html5QrCode = new Html5Qrcode("qr-reader");
      scannerRef.current = html5QrCode;
      
      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText: string) => {
          await handleDispatchPayload(decodedText);
        },
        () => {}
      );
      setShowManualInput(false);
    } catch {
      setHasCamera(false);
    } finally {
      isTransitioningRef.current = false;
    }
  }, [handleDispatchPayload]);

  useEffect(() => {
    startScanningRef.current = startScanning;
  }, [startScanning]);

  useEffect(() => {
    if (activeTab === 'scan' && hasCamera && !showManualInput && !result) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      startScanning();
    } else {
      stopScanning();
    }
    return () => {
      stopScanning();
    };
  }, [activeTab, hasCamera, showManualInput, result, startScanning, stopScanning]);

  // Detector óptico en vivo para nuestro QR Neón propietario (RabbittyCode)
  useEffect(() => {
    if (activeTab !== 'scan' || !hasCamera || showManualInput || result) return;

    let consecutiveNeonFrames = 0;
    let isSubmittingOptical = false;
    let decodeFailCount = 0;
    let hintShown = false;
    const hiCanvasRef: { current: HTMLCanvasElement | null } = { current: null };
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const interval = setInterval(async () => {
      if (isSubmittingOptical || !ctx) return;
      const container = document.getElementById('qr-reader');
      const video = container?.querySelector('video');
      if (!video || video.readyState < 2 || video.videoWidth === 0) return;

      try {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const cropSize = Math.min(vw, vh) * 0.65;
        const sx = (vw - cropSize) / 2;
        const sy = (vh - cropSize) / 2;
        ctx.drawImage(video, sx, sy, cropSize, cropSize, 0, 0, 64, 64);
        const pixels = ctx.getImageData(0, 0, 64, 64).data;

        let darkObsidianCount = 0;
        let neonPinkPurpleCount = 0;
        const totalPixels = 64 * 64;

        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];

          // Fondo oscuro/medio-oscuro de RabbittyCode (tolerante a reflejos de pantalla/cristal)
          if (r <= 145 && g <= 125 && b <= 160) {
            darkObsidianCount++;
          }
          // Anillos, esquinas y barras de onda neón (rosa/magenta #F43F5E, morado #8B5CF6, núcleo brillante)
          if (
            (r >= 110 && b >= 75 && r - g >= 20) ||
            (b >= 110 && r >= 65 && b - g >= 20) ||
            (r >= 190 && b >= 160 && g >= 100 && r - g >= 15)
          ) {
            neonPinkPurpleCount++;
          }
        }

        const darkRatio = darkObsidianCount / totalPixels;
        const neonRatio = neonPinkPurpleCount / totalPixels;

        if (darkRatio >= 0.2 && neonRatio >= 0.012) {
          consecutiveNeonFrames++;
        } else {
          consecutiveNeonFrames = 0;
        }

        if (consecutiveNeonFrames >= 2) {
          consecutiveNeonFrames = 0;
          isSubmittingOptical = true;

          // ── Decodificar las 13 barras de onda (payload machine-readable) ──
          const HI = 240;
          const hiCanvas = hiCanvasRef.current ?? document.createElement('canvas');
          hiCanvasRef.current = hiCanvas;
          hiCanvas.width = HI;
          hiCanvas.height = HI;
          const hctx = hiCanvas.getContext('2d', { willReadFrequently: true });
          if (!hctx) { isSubmittingOptical = false; return; }
          hctx.drawImage(video, sx, sy, cropSize, cropSize, 0, 0, HI, HI);
          const hiData = hctx.getImageData(0, 0, HI, HI).data;

          // Medir las 13 barras por POSICIÓN ESPERADA (equidistantes — robusto a resolución/reflejos)
          const { measureBarsFromFrame, codeFromBars } = await import('@/lib/rabbittyCodeCodec');
          const heights = measureBarsFromFrame(hiData, HI);
          let decoded: number | null = null;
          if (heights) {
            decoded = codeFromBars(heights);
          }

          if (decoded !== null) {
            await handleDispatchPayload(decoded);
            return;
          }

          // No decodificado (ángulo/luz): cooldown, reintento y pista al 3er intento
          decodeFailCount += 1;
          if (decodeFailCount === 3 && !hintShown) {
            hintShown = true;
            showToast('Casi… acércate (~15-25 cm), de frente y con buena luz 🐰', 'info');
          }
          await new Promise((r) => setTimeout(r, 1000));
          isSubmittingOptical = false;
        }
      } catch {
        isSubmittingOptical = false;
      }
    }, 450);

    return () => clearInterval(interval);
  }, [activeTab, hasCamera, showManualInput, result, router, stopScanning, handleDispatchPayload, showToast]);

  return (
    <div 
      className="page-wrap relative min-h-dvh flex flex-col justify-between transition-colors duration-200" 
      style={{ 
        paddingTop: 'calc(var(--safe-top, 0px) + 8px)',
        background: activeTab === 'scan' ? (isDark ? '#000000' : '#F1F5F9') : 'var(--bg-primary)',
        color: 'var(--text-primary)'
      }}
    >
      {/* Background glow only on my-code tab */}
      {activeTab === 'my-code' && (
        <div className="absolute inset-0 pointer-events-none z-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(233,30,99,0.08)_0%,transparent_65%)]" />
      )}

      {/* Header bar */}
      <div className="relative z-50 px-4 w-full flex flex-col items-center gap-3">
        <div className="flex items-center justify-between w-full">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full bg-(--bg-elevated) backdrop-blur-md border border-(--border-subtle) text-(--text-primary) flex items-center justify-center cursor-pointer shadow-xs active:scale-95 transition-transform"
          >
            <ArrowLeft size={20} />
          </button>
          <span className="text-xs font-extrabold tracking-[2px] text-(--text-primary) uppercase">Escanear QR</span>
          <button
            onClick={() => setShowManualInput(!showManualInput)}
            className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-colors shadow-xs ${
              showManualInput ? 'bg-[#E91E63] text-white border-0' : 'bg-(--bg-elevated) border border-(--border-subtle) text-(--text-primary)'
            }`}
          >
            <Keyboard size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-(--bg-elevated) backdrop-blur-2xl border border-(--border-subtle) p-1 rounded-full flex w-60 shadow-xs">
          {(['scan', 'my-code'] as const).map((t, i) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`flex-1 py-2 text-[11px] font-extrabold rounded-full border-0 cursor-pointer transition-all duration-200 ${
                activeTab === t ? 'bg-[#E91E63] text-white shadow-md' : 'bg-transparent text-(--text-muted) hover:text-(--text-primary)'
              }`}
            >
              {i === 0 ? 'Cámara' : 'Mi Código'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative flex-1 w-full flex flex-col items-center justify-center z-10 px-4 py-4">

        {/* My Code tab - Official Rabbitty Code Hologram */}
        {activeTab === 'my-code' && (
          <div className="flex flex-col items-center justify-center w-full max-w-85 z-20">
            <div className="text-center mb-6 px-2">
              <span className="text-[11px] font-black uppercase tracking-[2px] text-[#E91E63] block mb-1">Mi Identificador Rabbitty</span>
              <p className="text-(--text-muted) text-xs leading-relaxed m-0">Muestra este código en caja para acumular Bunz o autorizar consumo.</p>
            </div>
            
            <div className="flex flex-col items-center justify-center pt-8">
              <RabbittyCode 
                data={String(qrValue || 'rabbitty_guest')} 
                size={195} 
                showCardFrame={true} 
              />
              {/* QR estándar escaneable: cámaras de POS/caja (html5-qrcode) y iPhone */}
              <div className="mt-4 bg-white rounded-2xl p-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
                <QRCodeSVG
                  value={`rabbitty://pay?to=${encodeURIComponent(user?.username ? `@${user.username}` : String(qrValue || ''))}`}
                  size={132}
                  level="H"
                  includeMargin={false}
                />
              </div>
              <p className="text-[10px] text-(--text-muted) mt-2 text-center px-6 leading-snug">
                El neón lo lee la App Rabbitty · El cuadrado lo lee cualquier caja o cámara
              </p>
              <div className="mt-3 text-center">
                <span className="text-sm font-black tracking-[1.5px] text-(--text-primary) uppercase block">
                  {user?.firstName ? user.firstName : 'Miembro Rabbitty'}
                </span>
                <span className="text-[11px] text-(--text-muted) font-mono tracking-wider block mt-0.5">
                  ID: {String(qrValue || '').slice(0, 16)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Camera scan tab */}
        {activeTab === 'scan' && (
          <div className="w-full flex flex-col items-center justify-center relative">

            {/* QR Viewfinder Container: Camera Video is rendered strictly INSIDE this frame */}
            <div className="relative w-70 h-70 rounded-[28px] overflow-hidden bg-black/90 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] mb-6 flex items-center justify-center">
              
              {/* Persistent qr-reader container in DOM strictly contained inside the viewfinder */}
              <div 
                id="qr-reader" 
                className={`absolute inset-0 w-full h-full [&>video]:object-cover [&>video]:w-full [&>video]:h-full [&_#qr-shaded-region]:hidden ${hasCamera && !showManualInput ? 'block' : 'hidden'}`} 
              />

              {/* Neon Corners Overlay */}
              <div className="absolute inset-0 pointer-events-none z-20">
                {[['top','left'],['top','right'],['bottom','left'],['bottom','right']].map(([v,h]) => (
                  <div key={`${v}${h}`} style={{
                    position: 'absolute', [v]: 8, [h]: 8, width: 32, height: 32,
                    borderTop: v === 'top' ? '3.5px solid #E91E63' : 'none',
                    borderBottom: v === 'bottom' ? '3.5px solid #E91E63' : 'none',
                    borderLeft: h === 'left' ? '3.5px solid #E91E63' : 'none',
                    borderRight: h === 'right' ? '3.5px solid #E91E63' : 'none',
                    borderRadius: v==='top'&&h==='left'?'10px 0 0 0':v==='top'&&h==='right'?'0 10px 0 0':v==='bottom'&&h==='left'?'0 0 0 10px':'0 0 10px 0',
                    boxShadow: `${h==='left'?'-':''}2px ${v==='top'?'-':''}2px 14px rgba(233,30,99,0.7)`,
                  }} />
                ))}

                {/* Laser animation inside frame */}
                <motion.div
                  animate={{ top: ['4%', '94%', '4%'] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute left-3 right-3 h-0.5 bg-[#E91E63] shadow-[0_0_14px_#E91E63]"
                />
              </div>

              {!hasCamera && (
                <div className="z-30 text-center p-4 flex flex-col items-center gap-3">
                  <p className="text-xs text-white/70 m-0">Cámara no disponible o permiso denegado</p>
                  <button
                    onClick={requestCameraAccess}
                    className="px-4 py-2 rounded-full bg-[#E91E63] text-white text-xs font-bold border-none cursor-pointer active:scale-95 transition-transform shadow-lg shadow-[#E91E63]/30"
                  >
                    Activar cámara
                  </button>
                </div>
              )}
            </div>

            <p className="text-center text-[13px] text-(--text-muted) z-10 px-8 pointer-events-none mb-6">
              Alinea el código QR dentro del recuadro
            </p>

            {/* Ingreso manual abajo de la cámara */}
            <div className="w-full max-w-[320px] px-4 z-20">
              <button
                type="button"
                onClick={() => setShowManualInput(!showManualInput)}
                className="w-full py-3 px-4 bg-(--bg-elevated) hover:bg-(--bg-subtle) backdrop-blur-xl border border-(--border-subtle) rounded-2xl flex items-center justify-center gap-2 text-xs font-bold text-(--text-primary) transition-colors cursor-pointer shadow-xs"
              >
                <Keyboard size={16} />
                <span>{showManualInput ? 'Ocultar ingreso manual' : '¿No puedes escanear? Escribe el código'}</span>
              </button>

              <AnimatePresence>
                {showManualInput && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 flex flex-col gap-2 overflow-hidden"
                  >
                    <input
                      type="text"
                      placeholder="Código de 8 dígitos..."
                      value={manualCode}
                      onChange={e => setManualCode(e.target.value.toUpperCase())}
                      className="w-full bg-(--bg-elevated) border border-(--border-subtle) rounded-xl px-4 py-3 text-(--text-primary) text-center font-mono font-bold text-base tracking-[2px] outline-none"
                    />
                    <button
                      onClick={async () => {
                        const trimmed = manualCode.trim();
                        if (!trimmed) return;
                        try {
                          const headers = await PlatformBridge.getAuthHeaders();
                          const res = await fetch('/api/auth/qr/scan', {
                            method: 'POST',
                            headers: { ...headers, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ qrToken: trimmed.toLowerCase() }),
                          });
                          const data = await res.json();
                          if (data?.success) {
                            alert('¡Inicio de sesión QR Neón exitoso! 🪄');
                            setManualCode('');
                            router.push('/profile');
                            return;
                          }
                        } catch {}
                        alert(`Código ${trimmed} verificado exitosamente`);
                        setManualCode('');
                        router.push('/');
                      }}
                      className="w-full bg-[#E91E63] text-white font-extrabold text-xs py-3 rounded-xl border-0 cursor-pointer shadow-lg shadow-[#E91E63]/30"
                    >
                      Verificar código
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 80 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 80 }}
                  className="absolute bottom-32 left-4 right-4 bg-(--bg-elevated) rounded-[28px] p-6 z-30 shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-(--border-subtle)"
                >
                  <p className="text-(--text-primary) font-extrabold text-lg mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] inline-block" />
                      Autorizar Pago
                    </span>
                    <span className="text-xl">${result.amountMxn?.toFixed(2)} MXN</span>
                  </p>
                  
                  <div className="bg-(--bg-subtle) rounded-xl p-3 mb-4">
                    <p className="text-(--text-muted) text-[13px]">
                      <strong>Monto Bunz requerido:</strong> {result.bunzAmount?.toFixed(2)} Bunz
                    </p>
                    <p className="text-(--text-muted) text-[13px]">
                      <strong>Establecimiento:</strong> {result.tenantId}
                    </p>
                    <p className="text-(--text-muted) text-[13px]">
                      <strong>Estado:</strong> {result.status}
                    </p>
                  </div>

                  <Button 
                    variant="primary" 
                    fullWidth 
                    className="rounded-full border-0 font-extrabold bg-[#E91E63] text-white"
                    onClick={async () => {
                      const intentObj = result;
                      if (intentObj.status !== "PENDING_PAYMENT" && intentObj.status !== "CREATED") {
                        alert(`El pago no puede ser procesado (estado: ${intentObj.status})`);
                        return;
                      }

                      import('@twa-dev/sdk').then((mod) => {
                        mod.default.HapticFeedback.notificationOccurred('success');
                      }).catch(()=>{});

                      try {
                        const authHeader = await getAuthHeader();
                        const res = await fetch(`${API_SERVER_URL}/payments.approveIntent?batch=1`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json", "Authorization": authHeader },
                          body: JSON.stringify({
                            "0": { intentId: intentObj.id }
                          })
                        });
                        
                        if (!res.ok) {
                          const errData = await res.json();
                          throw new Error(errData[0]?.error?.message || "Error al aprobar pago");
                        }
                        
                        alert("¡Pago aprobado y liquidado con éxito!");
                        setResult(null);
                        router.push('/');
                      } catch (err: unknown) {
                        const msg = err instanceof Error ? err.message : "Error al procesar pago";
                        alert(msg);
                      }
                    }}
                  >
                    Confirmar Pago (${result.amountMxn?.toFixed(2)})
                  </Button>
                  
                  <button 
                    onClick={() => { setResult(null); startScanning(); }}
                    className="w-full mt-3 py-2 text-(--text-muted) font-bold text-sm bg-transparent border-0 cursor-pointer hover:text-(--text-primary)"
                  >
                    Cancelar
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

      </div>
      <BottomNav isDark={isDark} />
    </div>
  );
}
```

---

<a id="telegram-miniappsrcappbusinessscanpagetsx"></a>
## Archivo: `telegram-miniapp/src/app/business/scan/page.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import QRScanner from '@/features/transactions/QRScanner';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth/AuthProvider';
import { PlatformBridge } from '@/lib/platform';
import { resolveScannedPayload } from '@/lib/scannerResolver';

interface MerchantBusiness {
  id: string;
  name?: string;
}

export default function BusinessScanPage() {
  const { user } = useAuth();
  const [business, setBusiness] = useState<MerchantBusiness | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [showMintModal, setShowMintModal] = useState(false);
  const [scannedAddress, setScannedAddress] = useState('');
  const [fiatAmount, setFiatAmount] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (user?.id) {
      PlatformBridge.getAuthHeaders()
        .then(headers => fetch(`/api/business`, { headers }))
        .then(res => res.json())
        .then(data => {
          if (data.success && data.business) {
            setBusiness(data.business);
          }
        })
        .catch(err => console.error("Error loading business info:", err));
    }
  }, [user]);

  const handleScan = async (decodedText: string) => {
    setIsScanning(false);

    // ── Fuente única de la verdad: resolver el payload con el motor central ──
    try {
      const res = await resolveScannedPayload(decodedText);
      if (res.type === 'user' && res.user?.id) {
        setScannedAddress(res.user.id);
        setShowMintModal(true);
        toast.success(`Cliente identificado: ${res.user.name}`);
        return;
      }
      if (res.raw) {
        setScannedAddress(res.raw);
        setShowMintModal(true);
        return;
      }
    } catch (err) {
      console.warn('[BusinessScanPage] Error resolving scanned customer:', err);
    }

    setScannedAddress(decodedText);
    setShowMintModal(true);
  };

  const handleMintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fiatAmount || Number(fiatAmount) <= 0) return toast.error("Ingresa un monto válido");
    if (!business) return toast.error("No se cargó el perfil del negocio administrador");
    
    setProcessing(true);
    const toastId = toast.loading("Procesando recompensa...");
    
    try {
      const mod = await import('@twa-dev/sdk');
      const app = mod.default;
      const initData = typeof window !== 'undefined' ? app.initData : '';
      const headers = await PlatformBridge.getAuthHeaders();

      const res = await fetch('/api/business/scan/mint', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: scannedAddress, // The customer's scanned ID/telegramId/wallet
          businessId: business.id,     // The merchant's business ID
          fiatAmount: Number(fiatAmount),
          initData,
          idempotencyKey: crypto.randomUUID()
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast.success(`¡Listo! Se enviaron ${data.bunzRewarded} Bunz al cliente.`, { id: toastId, duration: 5000 });
        setShowMintModal(false);
        setFiatAmount('');
        setScannedAddress('');
      } else {
        toast.error(data.error || "Error al otorgar Bunz", { id: toastId, duration: 5000 });
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al procesar la recompensa", { id: toastId });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="px-6 pb-6 max-w-2xl mx-auto w-full" style={{ paddingTop: 'calc(max(env(safe-area-inset-top), 16px) + 24px)' }}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-black tracking-tight">Escáner de Caja</h1>
          <p className="text-gray-500 text-sm mt-1">
            Escanea el código QR de los Rabbitters para validar sus certificados o asignarles recompensas por sus consumos.
          </p>
        </div>
      </div>

      <div className="bg-gray-50 border border-gray-100 rounded-3xl p-8 flex flex-col items-center justify-center text-center mt-12">
        <div className="w-24 h-24 bg-white rounded-full shadow-sm flex items-center justify-center mb-6">
          <span className="text-4xl">📷</span>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Listo para escanear</h2>
        <p className="text-gray-500 text-sm mb-8 max-w-xs">
          Apunta la cámara al código QR mostrado en la aplicación del cliente.
        </p>
        
        <button 
          onClick={() => setIsScanning(true)}
          disabled={processing}
          className="bg-black text-white px-8 py-4 rounded-full font-bold text-sm hover:scale-105 active:scale-95 transition-all shadow-xl shadow-black/10 disabled:opacity-50"
        >
          {processing ? 'Procesando...' : 'Abrir Escáner'}
        </button>
      </div>

      {isScanning && (
        <QRScanner 
          onScan={handleScan}
          onClose={() => setIsScanning(false)}
        />
      )}

      {/* Mint Modal */}
      {showMintModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-4xl w-full max-w-md p-6 shadow-2xl relative">
            <h2 className="text-2xl font-black text-gray-900 mb-1">Registrar Consumo</h2>
            <p className="text-sm text-gray-500 mb-6">
              Ingresa el total pagado por el cliente para calcular automáticamente su recompensa en Bunz.
            </p>

            <form onSubmit={handleMintSubmit}>
              <div className="bg-gray-50 p-4 rounded-2xl mb-6 border border-gray-100">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Total de la cuenta (MXN)
                </label>
                <div className="flex items-center">
                  <span className="text-2xl font-bold text-gray-400 mr-2">$</span>
                  <input 
                    type="number"
                    value={fiatAmount}
                    onChange={(e) => setFiatAmount(e.target.value)}
                    className="w-full bg-transparent text-4xl font-black text-black outline-none placeholder:text-gray-300"
                    placeholder="0.00"
                    autoFocus
                    required
                    min="1"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button 
                  type="button"
                  onClick={() => setShowMintModal(false)}
                  className="flex-1 py-4 font-bold text-gray-500 hover:bg-gray-50 rounded-2xl transition-colors"
                  disabled={processing}
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-4 font-bold text-white bg-[#E91E63] rounded-2xl active:scale-95 transition-transform disabled:opacity-50"
                  disabled={processing || !fiatAmount}
                >
                  {processing ? 'Enviando...' : 'Otorgar Bunz'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

<a id="telegram-miniappsrcappapirabbitty-codelookuproutets"></a>
## Archivo: `telegram-miniapp/src/app/api/rabbitty-code/lookup/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, ownedBusinesses } from "@/db/schema";
import { eq, or, sql, ilike } from "drizzle-orm";
import { code6FromData } from "@/lib/rabbittyCodeCodec";

/**
 * POST /api/rabbitty-code/lookup
 * Resuelve identificadores Rabbitty (QR estándar, URLs, @usuario, UUIDs y RabbittyCode numérico).
 * Optimizado con consultas indexadas a base de datos.
 */
const attempts = new Map<string, { count: number; resetAt: number }>();
function rateLimit(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  entry.count += 1;
  return entry.count <= 60; // 60 lookups/min por IP
}

interface CodeIndexEntry {
  type: 'business' | 'user';
  id: string;
  name: string;
  handle?: string;
  username?: string | null;
}

// ── Reverse index en memoria (O(1)) con TTL de 60s y detección de colisiones ──
let reverseIndexCache: Map<number, CodeIndexEntry[]> | null = null;
let indexExpiresAt = 0;

async function getOrBuildReverseIndex(): Promise<Map<number, CodeIndexEntry[]>> {
  const now = Date.now();
  if (reverseIndexCache && now < indexExpiresAt) {
    return reverseIndexCache;
  }

  const map = new Map<number, CodeIndexEntry[]>();

  const addEntry = (code: number, entry: CodeIndexEntry) => {
    const list = map.get(code) || [];
    if (!list.some(e => e.id === entry.id)) {
      list.push(entry);
    }
    map.set(code, list);
  };

  // 1. Negocios aprobados
  const bizRows = await db
    .select({ id: ownedBusinesses.id, name: ownedBusinesses.name, slug: ownedBusinesses.slug })
    .from(ownedBusinesses)
    .where(eq(ownedBusinesses.status, "APPROVED"))
    .orderBy(ownedBusinesses.createdAt)
    .limit(5000);

  for (const b of bizRows) {
    const variants = [`business_${b.id}`, b.slug || "", b.name || ""].filter(Boolean);
    for (const v of variants) {
      addEntry(code6FromData(v), { type: 'business', id: b.id, name: b.name });
    }
  }

  // 2. Usuarios
  const candidates = await db
    .select({
      id: users.id,
      username: users.username,
      firstName: users.firstName,
      lastName: users.lastName,
      telegramId: users.telegramId,
    })
    .from(users)
    .orderBy(users.createdAt)
    .limit(5000);

  for (const u of candidates) {
    const handle = u.username ? `@${u.username}` : u.id;
    const fullName = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "Rabbitter";
    const variants = [
      `rabbitty://pay?to=${encodeURIComponent(handle)}`,
      `rabbitty://pay?to=${encodeURIComponent(u.id)}`,
      u.id,
      u.telegramId || "",
    ].filter(Boolean);

    for (const v of variants) {
      addEntry(code6FromData(v), {
        type: 'user',
        id: u.id,
        username: u.username,
        name: fullName,
        handle,
      });
    }
  }

  reverseIndexCache = map;
  indexExpiresAt = now + 60_000;
  return map;
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (!rateLimit(ip)) {
      return NextResponse.json({ success: false, error: "Demasiadas consultas" }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const rawText = typeof body?.text === "string" ? body.text.trim() : "";
    const code = Math.round(Number(body?.code));
    const hasCode = Number.isFinite(code) && code >= 0 && code <= 999_999;

    if (!hasCode && !rawText) {
      return NextResponse.json({ success: false, error: "Código inválido" }, { status: 400 });
    }

    // ─────────────────────────────────────────────────────────────
    // 1. MODO TEXTO: QR estándar, URLs, @handles, UUIDs
    // ─────────────────────────────────────────────────────────────
    if (rawText) {
      try {
        const urlObj = rawText.startsWith("http") ? new URL(rawText) : null;
        const params = urlObj ? urlObj.searchParams : new URLSearchParams(rawText.split("?")[1] || "");

        // 1.1 branchId (QR de mostrador / check-in sin mesa) → negocio dueño
        const branchId = params.get("branchId") || params.get("branch");
        if (branchId && !params.get("tableId") && !params.get("claimToken")) {
          const [branchRow] = await db.execute(
            sql`SELECT b."restaurantId", r."businessId" FROM branches b JOIN restaurants r ON r.id = b."restaurantId" WHERE b.id = ${branchId} LIMIT 1`
          ).then((r: unknown) => ((r as { rows?: Array<{ businessId: string }> }).rows || (r as unknown as Array<{ businessId: string }>)) as Array<{ businessId: string }>);
          const businessId = branchRow?.businessId;
          if (businessId) {
            const [biz] = await db.select({ id: ownedBusinesses.id, name: ownedBusinesses.name }).from(ownedBusinesses).where(eq(ownedBusinesses.id, businessId)).limit(1);
            if (biz) {
              return NextResponse.json({ success: true, type: "business", businessId: biz.id, name: biz.name, checkIn: true });
            }
          }
        }

        // 1.2 download?ref= (pósters impresos) → consulta directa por slug, id o nombre
        const ref = params.get("ref") || (rawText.includes("download?ref=") ? rawText.split("download?ref=")[1]?.split("&")[0] : "");
        if (ref) {
          const cleanRef = ref.trim();
          const [matchedBiz] = await db
            .select({ id: ownedBusinesses.id, name: ownedBusinesses.name })
            .from(ownedBusinesses)
            .where(
              or(
                eq(ownedBusinesses.slug, cleanRef),
                eq(ownedBusinesses.id, cleanRef),
                ilike(ownedBusinesses.name, cleanRef)
              )
            )
            .limit(1);

          if (matchedBiz) {
            return NextResponse.json({ success: true, type: "business", businessId: matchedBiz.id, name: matchedBiz.name });
          }
          return NextResponse.json({ success: true, type: "url", url: rawText });
        }

        // 1.3 URLs de afiliados o landing
        if (urlObj && (urlObj.host.includes("rabbitty.me") || urlObj.host.includes("rabbitty"))) {
          const path = urlObj.pathname;
          const affMatch = path.match(/\/affiliate\/([0-9a-f-]{10,})/i);
          if (affMatch) {
            return NextResponse.json({ success: true, type: "business", businessId: affMatch[1] });
          }
          return NextResponse.json({ success: true, type: "url", url: rawText });
        }

        // 1.4 rabbitty://pay?to= o parámetro to=
        const toParam = params.get("to") || (rawText.includes("to=") ? rawText.match(/[?&]to=([^&]+)/)?.[1] : "");
        const targetSearch = toParam ? decodeURIComponent(toParam).replace(/^@/, "").trim() : rawText.replace(/^@/, "").trim();

        if (targetSearch) {
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetSearch);
          const isDigits = /^\d{5,}$/.test(targetSearch);

          const [u] = await db
            .select({ id: users.id, username: users.username, firstName: users.firstName, lastName: users.lastName })
            .from(users)
            .where(
              isUuid
                ? eq(users.id, targetSearch)
                : or(
                    ilike(users.username, targetSearch),
                    isDigits ? eq(users.telegramId, targetSearch) : sql`FALSE`,
                    isDigits ? eq(users.phoneNumber, targetSearch) : sql`FALSE`
                  )
            )
            .limit(1);

          if (u) {
            const handle = u.username ? `@${u.username}` : u.id;
            const fullName = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "Rabbitter";
            return NextResponse.json({
              success: true,
              type: "user",
              user: { id: u.id, username: u.username, name: fullName, handle },
            });
          }

          // Si no fue usuario, comprobar si es un negocio por ID o slug
          const [biz] = await db
            .select({ id: ownedBusinesses.id, name: ownedBusinesses.name })
            .from(ownedBusinesses)
            .where(
              or(
                isUuid ? eq(ownedBusinesses.id, targetSearch) : sql`FALSE`,
                eq(ownedBusinesses.slug, targetSearch)
              )
            )
            .limit(1);

          if (biz) {
            return NextResponse.json({ success: true, type: "business", businessId: biz.id, name: biz.name });
          }
        }
      } catch (resolveErr) {
        console.warn("[RABBITTY_CODE_LOOKUP] text resolve error:", resolveErr);
      }
      return NextResponse.json({ success: false, error: "Código no reconocido" }, { status: 404 });
    }

    // ─────────────────────────────────────────────────────────────
    // 2. MODO CÓDIGO NUMÉRICO DE 6 DÍGITOS (RabbittyCode Neón)
    // ─────────────────────────────────────────────────────────────
    if (hasCode) {
      // 2.1 Gate de /impresos: código de sesión pendiente (candado POS)
      try {
        const pendingRows = await db.execute(
          sql`SELECT value FROM "systemSettings" WHERE key = 'impresos_pending_codes' LIMIT 1`
        );
        const pendingRaw = (pendingRows as unknown as { rows?: Array<{ value: string }> }).rows?.[0]?.value
          ?? (pendingRows as unknown as Array<{ value: string }>)?.[0]?.value;
        if (pendingRaw) {
          const pending = JSON.parse(pendingRaw) as Record<string, { sessionId: string; token: string; expiresAt: string }>;
          const entry = pending[String(code)];
          if (entry && new Date(entry.expiresAt).getTime() > Date.now()) {
            return NextResponse.json({ success: true, type: 'qrlogin', qrToken: entry.token, sessionId: entry.sessionId });
          }
        }
      } catch {}

      // 2.2 Consulta O(1) vía Reverse Index en memoria con gestión explícita de colisiones
      const index = await getOrBuildReverseIndex();
      const matches = index.get(code) || [];

      // ── Detección explícita de colisiones: si más de una entidad comparte el mismo código,
      // se rechaza responder a ciegas para evitar transferencias o cobros equivocados.
      if (matches.length > 1) {
        return NextResponse.json({
          success: false,
          error: "Colisión detectada: múltiples miembros comparten este código óptico. Por favor escanea el código QR estándar.",
          collision: true,
        }, { status: 409 });
      }

      if (matches.length === 1) {
        const match = matches[0];
        if (match.type === 'business') {
          return NextResponse.json({
            success: true,
            type: "business",
            businessId: match.id,
            name: match.name,
          });
        }
        return NextResponse.json({
          success: true,
          type: "user",
          user: {
            id: match.id,
            username: match.username,
            name: match.name,
            handle: match.handle || match.id,
          },
        });
      }
    }

    return NextResponse.json({ success: false, error: "Código no reconocido" }, { status: 404 });
  } catch (err) {
    console.error("[RABBITTY_CODE_LOOKUP]", err);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
```

---

# ========================================================
# 3. GPS, Ubicación y Proximidad
# ========================================================


<a id="telegram-miniappsrclibplatformts"></a>
## Archivo: `telegram-miniapp/src/lib/platform.ts`

```typescript
'use client';

import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Preferences } from '@capacitor/preferences';

export type PlatformType = 'telegram' | 'ios' | 'android' | 'web';

const SESSION_TOKEN_KEY = 'rabbitty_auth_session_token';
const USER_CACHE_KEY = 'rabbitty_user_cache';

interface TelegramWebApp {
  initData?: string;
  initDataUnsafe?: { user?: { id?: number } };
  openLink?: (url: string) => void;
  HapticFeedback?: {
    impactOccurred: (style: string) => void;
    notificationOccurred: (type: string) => void;
  };
}

interface WindowWithTelegram extends Window {
  Telegram?: {
    WebApp?: TelegramWebApp;
  };
}

export const PlatformBridge = {
  /**
   * Determine the runtime platform
   */
  getPlatform(): PlatformType {
    if (typeof window === 'undefined') return 'web';

    // Check Telegram Mini App first
    const tg = (window as WindowWithTelegram).Telegram?.WebApp;
    if (tg && (tg.initData || tg.initDataUnsafe?.user?.id)) {
      return 'telegram';
    }

    // Check Capacitor native
    if (Capacitor.isNativePlatform()) {
      return Capacitor.getPlatform() as 'ios' | 'android';
    }

    return 'web';
  },

  isTelegram(): boolean {
    return this.getPlatform() === 'telegram';
  },

  isNative(): boolean {
    return Capacitor.isNativePlatform();
  },

  isIos(): boolean {
    return Capacitor.getPlatform() === 'ios';
  },

  isAndroid(): boolean {
    return Capacitor.getPlatform() === 'android';
  },

  isWeb(): boolean {
    return this.getPlatform() === 'web';
  },

  /**
   * Genera el enlace de retorno inteligente según la plataforma de origen:
   * - En Native Mobile App / Web: Genera el enlace web/universal (https://rabbitty.me/...)
   * - En Telegram Mini App: Genera el enlace de Telegram con startapp (https://t.me/Rabbittyme_bot/app?startapp=...)
   */
  getShareableLink(path: string, tgParam?: string): string {
    const isTg = this.isTelegram();
    if (isTg && tgParam) {
      return `https://t.me/Rabbittyme_bot/app?startapp=${encodeURIComponent(tgParam)}`;
    }
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `https://rabbitty.me${cleanPath}`;
  },

  /**
   * Universal Haptic Feedback across Telegram, Native iOS/Android, and Web
   */
  async hapticFeedback(style: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light') {
    if (typeof window === 'undefined') return;

    try {
      if (this.isTelegram()) {
        const haptics = (window as WindowWithTelegram).Telegram?.WebApp?.HapticFeedback;
        if (haptics) {
          if (style === 'success' || style === 'warning' || style === 'error') {
            haptics.notificationOccurred(style);
          } else {
            haptics.impactOccurred(style);
          }
          return;
        }
      }

      if (this.isNative()) {
        if (style === 'success' || style === 'warning' || style === 'error') {
          const typeMap = {
            success: NotificationType.Success,
            warning: NotificationType.Warning,
            error: NotificationType.Error,
          };
          await Haptics.notification({ type: typeMap[style] });
        } else {
          const styleMap = {
            light: ImpactStyle.Light,
            medium: ImpactStyle.Medium,
            heavy: ImpactStyle.Heavy,
          };
          await Haptics.impact({ style: styleMap[style] });
        }
        return;
      }

      // Web Fallback
      if ('vibrate' in navigator) {
        navigator.vibrate(style === 'heavy' ? 40 : 15);
      }
    } catch {
      // Haptics should never throw unhandled
    }
  },

  /**
   * Secure Session Token Storage
   * Uses @capacitor/preferences on Native devices, with safe fallback.
   */
  async getSessionToken(): Promise<string | null> {
    if (typeof window === 'undefined') return null;

    try {
      if (this.isNative()) {
        const { value } = await Preferences.get({ key: SESSION_TOKEN_KEY });
        return value || null;
      }

      // Web / Telegram fallback
      return localStorage.getItem(SESSION_TOKEN_KEY);
    } catch (e) {
      console.warn('[PlatformBridge] Failed to read session token', e);
      return null;
    }
  },

  /**
   * Auth headers for API calls. Sends the persistent session token (native/web)
   * and the Telegram WebApp initData so the server can verify the caller either way.
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};

    try {
      const token = await this.getSessionToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    } catch {
      // ignore
    }

    if (typeof window !== 'undefined') {
      const tg = (window as WindowWithTelegram).Telegram?.WebApp;
      if (tg?.initData) headers['X-Init-Data'] = tg.initData;
    }

    return headers;
  },

  async setSessionToken(token: string): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      if (this.isNative()) {
        await Preferences.set({ key: SESSION_TOKEN_KEY, value: token });
        return;
      }

      localStorage.setItem(SESSION_TOKEN_KEY, token);
    } catch (e) {
      console.warn('[PlatformBridge] Failed to persist session token', e);
    }
  },

  async clearSession(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      if (this.isNative()) {
        await Preferences.remove({ key: SESSION_TOKEN_KEY });
        await Preferences.remove({ key: USER_CACHE_KEY });
      }

      localStorage.removeItem(SESSION_TOKEN_KEY);
      localStorage.removeItem(USER_CACHE_KEY);
    } catch (e) {
      console.warn('[PlatformBridge] Failed to clear session', e);
    }
  },

  async getPreference(key: string): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    try {
      if (this.isNative()) {
        const { value } = await Preferences.get({ key });
        return value || null;
      }
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  async setPreference(key: string, value: string): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      if (this.isNative()) {
        await Preferences.set({ key, value });
        return;
      }
      localStorage.setItem(key, value);
    } catch {}
  },

  async removePreference(key: string): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      if (this.isNative()) {
        await Preferences.remove({ key });
        return;
      }
      localStorage.removeItem(key);
    } catch {}
  },

  /**
   * Safe External Link Opener
   */
  async openExternalUrl(url: string) {
    if (typeof window === 'undefined') return;

    const tg = (window as WindowWithTelegram).Telegram?.WebApp;
    if (tg?.openLink) {
      tg.openLink(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  },

  /**
   * Universal Native Share (iOS / Android Native Sheet or Web Share API)
   */
  async share(options: { title?: string; text?: string; url?: string; dialogTitle?: string }): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    try {
      this.hapticFeedback('medium');
      if (this.isNative()) {
        const { Share } = await import('@capacitor/share');
        await Share.share({
          title: options.title || 'Rabbitty',
          text: options.text || '',
          url: options.url || '',
          dialogTitle: options.dialogTitle || 'Compartir Rabbitty',
        });
        return true;
      }

      if (navigator.share) {
        await navigator.share({
          title: options.title || 'Rabbitty',
          text: options.text || '',
          url: options.url || '',
        });
        return true;
      }

      if (options.url) {
        await navigator.clipboard.writeText(options.url);
        return true;
      }
    } catch (e) {
      const errName = e instanceof Error ? e.name : '';
      if (errName !== 'AbortError') {
        console.warn('[PlatformBridge] Share error:', e);
      }
    }
    return false;
  },

  /**
   * Initialize and request Native Push Notifications (iOS APNs / Android FCM).
   * Resolves with the device token once the OS returns it, and routes inbound
   * notifications through `onNotificationReceived`.
   */
  async initPushNotifications(handlers?: {
    onToken?: (token: string) => void;
    onNotificationReceived?: (notification: unknown) => void;
  }): Promise<string | null> {
    if (typeof window === 'undefined' || !this.isNative()) return null;

    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        return null;
      }

      return await new Promise<string | null>((resolve) => {
        let settled = false;
        const finish = (value: string | null) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };

        PushNotifications.addListener('registration', (token) => {
          const value = token?.value ?? null;
          if (value) {
            handlers?.onToken?.(value);
            finish(value);
          }
        });

        PushNotifications.addListener('registrationError', (err) => {
          console.warn('[Push] Registration error:', err);
          finish(null);
        });

        if (handlers?.onNotificationReceived) {
          PushNotifications.addListener('pushNotificationReceived', (notification) => {
            handlers.onNotificationReceived?.(notification);
          });
        }

        // Kick off registration AFTER listeners are attached, otherwise the
        // 'registration' event can fire before we are listening and the token
        // would be dropped.
        PushNotifications.register().catch((err) => {
          console.warn('[Push] register() failed:', err);
          finish(null);
        });

        // Safety net: never leave the caller hanging if the OS never answers.
        setTimeout(() => finish(null), 15_000);
      });
    } catch (err) {
      console.warn('[Push] initPushNotifications failed:', err);
      return null;
    }
  },

  /**
   * Biometric Authentication across Native iOS/Android (via @aparajita/capacitor-biometric-auth)
   * Falls back gracefully if unavailable or on web/telegram
   */
  async authenticateBiometric(reason: string = 'Verifica tu identidad'): Promise<{ success: boolean; error?: string }> {
    if (typeof window === 'undefined') return { success: false, error: 'no_window' };

    if (this.isNative()) {
      try {
        const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
        const check = await BiometricAuth.checkBiometry();
        if (!check.isAvailable) {
          return { success: false, error: 'biometry_unavailable' };
        }
        await BiometricAuth.authenticate({
          reason,
          cancelTitle: 'Cancelar',
          allowDeviceCredential: true,
          iosFallbackTitle: 'Usar código',
          androidTitle: 'Autenticación biométrica',
        });
        return { success: true };
      } catch (err: unknown) {
        console.warn('[PlatformBridge] Biometric auth error:', err);
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, error: message };
      }
    }

    return { success: false, error: 'unsupported' };
  },

  /**
   * Obtiene la ubicación del usuario de forma unificada (Native/Web/Telegram)
   * Maneja permisos, timeouts y devuelve estado claro
   */
  /**
   * Obtiene la ubicación del usuario de forma unificada (Native/Web/Telegram)
   * Separa explícitamente lecturas de caché (para render inicial de mapa)
   * de lecturas en tiempo real frescas (para proximidad y geocercas).
   */
  async getLocation(options: { allowCached?: boolean; maxAgeMs?: number } = {}): Promise<{
    success: boolean;
    lat?: number;
    lng?: number;
    accuracy?: number;
    timestamp?: number;
    isFresh?: boolean;
    error?: 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' | 'UNSUPPORTED';
  }> {
    if (typeof window === 'undefined') {
      return { success: false, error: 'UNSUPPORTED' };
    }

    // Check Telegram WebApp LocationManager (Bot API 8.0+)
    try {
      const tg = (window as WindowWithTelegram).Telegram?.WebApp as unknown as {
        LocationManager?: {
          init: (cb: () => void) => void;
          getLocation: (cb: (data: { latitude?: number; longitude?: number }) => void) => void;
        };
      };
      if (tg?.LocationManager && typeof tg.LocationManager.getLocation === 'function') {
        const locMgr = tg.LocationManager;
        const tgLoc = await new Promise<{ lat?: number; lng?: number } | null>((res) => {
          try {
            locMgr.init(() => {
              locMgr.getLocation((data) => {
                if (data && data.latitude != null && data.longitude != null) {
                  res({ lat: data.latitude, lng: data.longitude });
                } else {
                  res(null);
                }
              });
            });
            setTimeout(() => res(null), 4000);
          } catch {
            res(null);
          }
        });
        if (tgLoc?.lat != null && tgLoc?.lng != null) {
          return { success: true, lat: tgLoc.lat, lng: tgLoc.lng, timestamp: Date.now(), isFresh: true };
        }
      }
    } catch {}

    if (!('geolocation' in navigator)) {
      return { success: false, error: 'UNSUPPORTED' };
    }

    const getPos = (enableHigh: boolean, timeoutMs: number, maxAgeMs: number) =>
      new Promise<{
        success: boolean;
        lat?: number;
        lng?: number;
        accuracy?: number;
        timestamp?: number;
        isFresh?: boolean;
        error?: 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT';
      }>((resolve) => {
        let finished = false;
        const timer = setTimeout(() => {
          if (!finished) {
            finished = true;
            resolve({ success: false, error: 'TIMEOUT' });
          }
        }, timeoutMs);

        try {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (finished) return;
              finished = true;
              clearTimeout(timer);
              const age = Date.now() - (pos.timestamp || Date.now());
              resolve({
                success: true,
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
                timestamp: pos.timestamp || Date.now(),
                isFresh: age < 30_000,
              });
            },
            (err) => {
              if (finished) return;
              finished = true;
              clearTimeout(timer);
              let code: 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' = 'POSITION_UNAVAILABLE';
              if (err.code === err.PERMISSION_DENIED) code = 'PERMISSION_DENIED';
              else if (err.code === err.TIMEOUT) code = 'TIMEOUT';
              resolve({ success: false, error: code });
            },
            { enableHighAccuracy: enableHigh, timeout: timeoutMs, maximumAge: maxAgeMs }
          );
        } catch {
          if (!finished) {
            finished = true;
            clearTimeout(timer);
            resolve({ success: false, error: 'POSITION_UNAVAILABLE' });
          }
        }
      });

    // 1. Si se permite explícitamente lectura en caché (solo para dibujar mapa rápido)
    if (options.allowCached) {
      const cached = await getPos(false, 3000, options.maxAgeMs || 300_000);
      if (cached.success) return cached;
    }

    // 2. Lectura GPS fresca en tiempo real (alta precisión, máximo 15s de antigüedad de hardware)
    const freshGps = await getPos(true, 10_000, 15_000);
    if (freshGps.success) return freshGps;
    if (freshGps.error === 'PERMISSION_DENIED') return freshGps;

    // 3. Fallback de red celular/WiFi de respaldo (máximo 45s de antigüedad)
    const cellBackup = await getPos(false, 6000, 45_000);
    return cellBackup;
  },

  /**
   * Limpieza forzada de caché local y recarga (Rescue Mechanism para App Nativa / Web)
   */
  async hardResetCache(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      if (this.isNative()) {
        await Preferences.clear();
      }
      localStorage.clear();
      sessionStorage.clear();
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }
    } catch (e) {
      console.warn('[PlatformBridge] Error clearing caches:', e);
    } finally {
      window.location.href = '/?cb=' + Date.now();
    }
  },
};

```

---

<a id="telegram-miniappsrcfeaturesmapInteractiveMaptsx"></a>
## Archivo: `telegram-miniapp/src/features/map/InteractiveMap.tsx`

```tsx
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Crosshair, Mic, MicOff, Sparkles, Navigation, 
  Flame, Gift, Compass, X 
} from 'lucide-react';
import { PlatformBridge } from '@/lib/platform';
import { useTheme } from '@/contexts/ThemeContext';
import { RabbittyMap } from './nativeMapBridge';

// High-performance OpenStreetMap raster tiles (Zero API key watermark, styled via dark filter)
const cartoKey = process.env.NEXT_PUBLIC_CARTO_KEY;
const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const DARK_MATTER_URL = cartoKey 
  ? `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${cartoKey}`
  : OSM_TILE_URL;
const LIGHT_POSITRON_URL = cartoKey
  ? `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=${cartoKey}`
  : OSM_TILE_URL;
const MAP_TILE_ATTR = cartoKey
  ? '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export interface MapBusiness {
  id: string;
  name?: string;
  user?: string;
  category?: string;
  device?: string;
  address?: string;
  lat?: string | number | null;
  lng?: string | number | null;
  rewardPercentage?: number;
  reward_percentage?: number;
  acceptsBunz?: boolean;
  accepts_bunz?: boolean;
  givesBunz?: boolean;
  gives_bunz?: boolean;
  hasStockOffer?: boolean;
  bunzBalance?: number;
  distance?: number;
  image?: string;
  imageUrl?: string;
  logoUrl?: string;
  startTime?: string;
  endTime?: string;
}

interface InteractiveMapProps {
  businesses: MapBusiness[];
  userLat?: number | null;
  userLng?: number | null;
  accuracy?: number | null;
  locationTimestamp?: number | null;
  onRequestLocation?: () => void;
  isLocating?: boolean;
}

const RARITY = {
  common:    { color:"#7EC8E3", label:"Común",      ring:"#7EC8E355" },
  rare:      { color:"#B57BEE", label:"Raro",       ring:"#B57BEE55" },
  epic:      { color:"#FF4D8D", label:"Épico",      ring:"#FF4D8D66" },
  legendary: { color:"#FFD166", label:"Legendario", ring:"#FFD16666" },
} as const;

type RarityKey = keyof typeof RARITY;

function getRarity(bunz: number): RarityKey {
  if (bunz >= 15) return "legendary";
  if (bunz >= 10) return "epic";
  if (bunz >= 5)  return "rare";
  return "common";
}

function getIcon(category?: string) {
  const cat = category?.toLowerCase() || '';
  if (cat.includes('caf')) return '☕';
  if (cat.includes('restaurante') || cat.includes('comida') || cat.includes('pizz')) return '🍕';
  if (cat.includes('fit') || cat.includes('gym')) return '💪';
  if (cat.includes('tech') || cat.includes('tecno')) return '💻';
  if (cat.includes('belleza') || cat.includes('spa') || cat.includes('barber')) return '✨';
  if (cat.includes('bar') || cat.includes('copas')) return '🍸';
  return '🛍️';
}

function markerHTML(a: MapBusiness, selected: boolean, isDark: boolean) {
  const rw = a.rewardPercentage || a.reward_percentage || 0;
  const isStockOnly = (a.acceptsBunz || a.accepts_bunz) && !(a.givesBunz || a.gives_bunz);
  const r = isStockOnly ? { color: "#E91E63", label: "Stock" } : RARITY[getRarity(rw)];
  const sz = selected ? 52 : 44;
  const glowSize = selected
    ? `0 0 0 3px ${isDark ? '#0D0914' : '#FFFFFF'}, 0 0 18px ${r.color}, 0 0 32px ${r.color}77`
    : `0 0 0 2px ${isDark ? '#0D0914' : '#FFFFFF'}, 0 0 10px ${r.color}88, 0 0 18px ${r.color}33`;
  const scale = selected ? "scale(1.15)" : "scale(1)";
  const icon = isStockOnly ? '🎁' : getIcon(a.category || a.device);
  
  const badgeHtml = isStockOnly 
    ? `<div style="position:absolute;top:-20px;left:50%;transform:translateX(-50%);background:#E91E63;color:#fff;font-size:9px;font-weight:900;padding:2px 8px;border-radius:100px;white-space:nowrap;letter-spacing:.3px;box-shadow:0 2px 10px rgba(233,30,99,0.5)">STOCK</div>`
    : `<div style="position:absolute;top:-20px;left:50%;transform:translateX(-50%);background:${r.color};color:${getRarity(rw)==='legendary'?'#111':'#0D0D1A'};font-size:9px;font-weight:900;padding:2px 8px;border-radius:100px;white-space:nowrap;letter-spacing:.3px;box-shadow:0 2px 10px ${r.color}88">+${rw}%</div>`;

  return `
    <div style="position:relative;display:flex;flex-direction:column;align-items:center;transform:${scale};transition:transform 0.25s cubic-bezier(.34,1.56,.64,1)">
      ${badgeHtml}
      <div style="width:${sz}px;height:${sz}px;border-radius:50%;background:${isDark ? 'linear-gradient(145deg,#1E142B,#0F0A18)' : '#FFFFFF'};display:flex;align-items:center;justify-content:center;font-size:${selected?22:18}px;box-shadow:${glowSize};border:2px solid ${r.color};transition:all .25s">
        ${icon}
      </div>
      <div style="width:2px;height:9px;background:linear-gradient(${r.color},transparent);margin-top:-1px"></div>
      <div style="width:6px;height:6px;border-radius:50%;background:${r.color};box-shadow:0 0 8px ${r.color};margin-top:-2px"></div>
    </div>`;
}

function userMarkerHTML() {
  return `
    <div style="position:relative;width:28px;height:28px">
      <div class="radar-sweep"></div>
      <div style="position:absolute;inset:0;border-radius:50%;background:#E91E63;border:3px solid #fff;box-shadow:0 0 0 2px #E91E63,0 0 24px #E91E63aa;z-index:2"></div>
      <div class="rb-pulse rb-pulse-1"></div>
      <div class="rb-pulse rb-pulse-2"></div>
      <div class="rb-pulse rb-pulse-3"></div>
    </div>`;
}

export default function InteractiveMap({
  businesses,
  userLat,
  userLng,
  accuracy,
  locationTimestamp,
  onRequestLocation,
  isLocating,
}: InteractiveMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInst = useRef<L.Map | null>(null);
  const layerGroup = useRef<L.LayerGroup | null>(null);
  const userMarkerGroup = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [selected, setSelected] = useState<MapBusiness | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('Todos');
  const [activeMode, setActiveMode] = useState<string>('Todos');
  
  // Bunzy Copilot Voice & Search State (Gemini-in-car style)
  const [isListening, setIsListening] = useState(false);
  const [copilotQuery, setCopilotQuery] = useState('');
  const [copilotReply, setCopilotReply] = useState<string | null>(null);
  const speechSupported = typeof window !== 'undefined' && 
    ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
  const isNativeIos = typeof window !== 'undefined' && PlatformBridge.isIos();
  const [nativeMapActive, setNativeMapActive] = useState(false);

  const router = useRouter();

  // 1. Lifecycle para montaje/desmontaje de MapKit nativo en iOS
  useEffect(() => {
    if (!isNativeIos) return;

    let listenerHandle: { remove: () => void } | null = null;
    let isMounted = true;

    RabbittyMap.showMap()
      .then(() => {
        if (!isMounted) return;
        setNativeMapActive(true);
      })
      .catch((err) => {
        console.warn('[MapKit] Native map init failed, using Leaflet fallback:', err);
        if (isMounted) setNativeMapActive(false);
      });

    RabbittyMap.addListener('onBusinessSelected', (data) => {
      const match = businesses.find((b) => b.id === data.businessId);
      if (match) setSelected(match);
    }).then((handle) => {
      listenerHandle = handle;
    }).catch(() => {});

    return () => {
      isMounted = false;
      if (listenerHandle) listenerHandle.remove();
      RabbittyMap.hideMap().catch(() => {});
      setNativeMapActive(false);
    };
  }, [isNativeIos, businesses]);

  // 2. Sincronización de spots en mapa nativo sin recrear la vista (anti-thrash)
  useEffect(() => {
    if (!nativeMapActive) return;
    RabbittyMap.setBusinesses({ businesses }).catch(() => {});
  }, [nativeMapActive, businesses]);

  // 3. Centrado GPS dinámico cuando la ubicación llega o cambia
  useEffect(() => {
    if (!nativeMapActive || userLat == null || userLng == null) return;
    RabbittyMap.centerOn({ lat: userLat, lng: userLng, radiusKm: 2.0 }).catch(() => {});
  }, [nativeMapActive, userLat, userLng]);

  // Filter businesses
  const filteredBusinesses = businesses.filter(b => {
    // Mode Filter:
    // En bunz'in: se muestran todos los negocios que dan recompensas (visita y acumulación)
    // En Stock: SOLO se muestran los negocios que realmente tienen stock fondeado y disponible para canjear
    let modeMatch = true;
    if (activeMode === "bunz'in") {
      modeMatch = (b.givesBunz === true || b.gives_bunz === true);
    } else if (activeMode === "Stock") {
      const hasBalance = typeof b.bunzBalance === 'number' ? b.bunzBalance >= 5 : false;
      modeMatch = (b.hasStockOffer === true || ((b.acceptsBunz === true || b.accepts_bunz === true) && hasBalance));
    }

    // Category Filter
    let categoryMatch = true;
    if (activeCategory !== 'Todos') {
      const cat = (b.category || b.device || '').toLowerCase();
      categoryMatch = cat.includes(activeCategory.toLowerCase());
    }

    return modeMatch && categoryMatch;
  });



  // Speech Synthesis TTS Engine
  const speakReply = useCallback((text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel(); // Stop any pending utterance
      // Clean emojis and icons for clean vocalization
      const cleanText = text.replace(/[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]/gu, '').trim();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'es-MX';
      utterance.rate = 1.05;
      utterance.pitch = 1.08;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Speech synthesis is best effort
    }
  }, []);

  // Bunzy voice command processor
  const handleVoiceCommand = useCallback((transcript: string) => {
    setCopilotQuery(transcript);
    PlatformBridge.hapticFeedback('medium');

    const lower = transcript.toLowerCase();
    
    // Command 1: Cafés / concentración / trabajar
    if (lower.includes('café') || lower.includes('cafe') || lower.includes('trabaj') || lower.includes('concentr')) {
      setActiveCategory('Cafetería');
      const cafe = businesses.find(b => (b.category || '').toLowerCase().includes('caf'));
      if (cafe && cafe.lat && cafe.lng && mapInst.current) {
        const reply = `Encontré ${cafe.name || 'Cafetería'} en tu zona con cashback en Bunz ☕`;
        setCopilotReply(reply);
        speakReply(reply);
        mapInst.current.flyTo([Number(cafe.lat), Number(cafe.lng)], 16, { duration: 1.2 });
        setSelected(cafe);
      } else {
        const reply = 'No encontré cafeterías afiliadas activas en esta área ☕';
        setCopilotReply(reply);
        speakReply(reply);
      }
    } 
    // Command 2: Mayor recompensa / más bunz / cashback alto
    else if (lower.includes('más bunz') || lower.includes('mas bunz') || lower.includes('recompensa') || lower.includes('cashback')) {
      const topBiz = [...businesses].sort((a, b) => (b.rewardPercentage || 0) - (a.rewardPercentage || 0))[0];
      if (topBiz && topBiz.lat && topBiz.lng && mapInst.current) {
        const reply = `El spot con más cashback es ${topBiz.name || 'afiliado'} con +${topBiz.rewardPercentage ?? 0}% Bunz 🔥`;
        setCopilotReply(reply);
        speakReply(reply);
        mapInst.current.flyTo([Number(topBiz.lat), Number(topBiz.lng)], 16.5, { duration: 1.2 });
        setSelected(topBiz);
      } else {
        const reply = 'No hay comercios con recompensas registradas en esta zona.';
        setCopilotReply(reply);
        speakReply(reply);
      }
    }
    // Command 3: Comida / restaurante / hambre
    else if (lower.includes('comer') || lower.includes('hambre') || lower.includes('restaurante') || lower.includes('pizza')) {
      setActiveCategory('Restaurante');
      const food = businesses.find(b => (b.category || '').toLowerCase().includes('restaurante') || (b.category || '').toLowerCase().includes('comida'));
      if (food && food.lat && food.lng && mapInst.current) {
        const reply = `Filtrando opciones de comida. Te muestro ${food.name || 'restaurante'} 🍕`;
        setCopilotReply(reply);
        speakReply(reply);
        mapInst.current.flyTo([Number(food.lat), Number(food.lng)], 16, { duration: 1.2 });
        setSelected(food);
      } else {
        const reply = 'No encontré restaurantes afiliados activos en esta área 🍕';
        setCopilotReply(reply);
        speakReply(reply);
      }
    }
    // Command 4: Mi ubicación / llévame a donde estoy
    else if (lower.includes('dónde estoy') || lower.includes('mi ubicación') || lower.includes('aqui') || lower.includes('aquí')) {
      if (userLat && userLng && mapInst.current) {
        const reply = 'Centrando el radar en tu ubicación actual 📍';
        setCopilotReply(reply);
        speakReply(reply);
        mapInst.current.flyTo([userLat, userLng], 16.5, { duration: 1 });
      } else if (onRequestLocation) {
        onRequestLocation();
        const reply = 'Activando señal GPS de tu dispositivo 📍';
        setCopilotReply(reply);
        speakReply(reply);
      }
    }
    // Default fallback: search query
    else {
      const match = businesses.find(b => (b.name || '').toLowerCase().includes(lower) || (b.category || '').toLowerCase().includes(lower));
      if (match && match.lat && match.lng && mapInst.current) {
        const distText = match.distance ? `a ${match.distance} km` : 'en el mapa';
        const reply = `Encontré ${match.name} ${distText} 🐰`;
        setCopilotReply(reply);
        speakReply(reply);
        mapInst.current.flyTo([Number(match.lat), Number(match.lng)], 16.5, { duration: 1.2 });
        setSelected(match);
      } else {
        const reply = `Buscando "${transcript}" en comercios afiliados cercanos 🐰`;
        setCopilotReply(reply);
        speakReply(reply);
      }
    }
  }, [businesses, userLat, userLng, onRequestLocation, speakReply]);

  const copilotInputRef = useRef<HTMLInputElement>(null);

  const toggleSpeechRecognition = async () => {
    if (typeof window === 'undefined') return;
    PlatformBridge.hapticFeedback('medium');

    if (isListening) {
      setIsListening(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRec = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;

    // En iOS WKWebView / Capacitor o navegadores móviles sin soporte seguro de SpeechRecognition
    const isIosDevice = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (!SpeechRec || (isIosDevice && (PlatformBridge.isNative() || PlatformBridge.isTelegram()))) {
      copilotInputRef.current?.focus();
      setCopilotReply('Escribe tu búsqueda a Bunzy aquí ✍️');
      setTimeout(() => setCopilotReply(null), 3500);
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let recognition: any = null;
      try {
        recognition = new SpeechRec();
      } catch (instErr) {
        console.warn('[SpeechRec] Could not instantiate speech engine:', instErr);
        copilotInputRef.current?.focus();
        setCopilotReply('Escribe tu consulta a Bunzy aquí ✍️');
        setTimeout(() => setCopilotReply(null), 3500);
        return;
      }

      recognition.lang = 'es-MX';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const text = event.results?.[0]?.[0]?.transcript;
        setIsListening(false);
        if (text) handleVoiceCommand(text);
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (err: any) => {
        setIsListening(false);
        copilotInputRef.current?.focus();
        if (err?.error === 'not-allowed' || err?.error === 'service-not-allowed') {
          setCopilotReply('Activa Dictado en Ajustes de iOS o escribe aquí ✍️');
        } else {
          setCopilotReply('Escribe a Bunzy aquí ✍️');
        }
        setTimeout(() => setCopilotReply(null), 3500);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      try {
        recognition.start();
      } catch (startErr) {
        console.warn('[SpeechRec] Failed to start recognition:', startErr);
        setIsListening(false);
        copilotInputRef.current?.focus();
        setCopilotReply('Escribe a Bunzy aquí ✍️');
        setTimeout(() => setCopilotReply(null), 3500);
      }
    } catch (outerErr) {
      console.warn('[SpeechRec] General exception caught:', outerErr);
      setIsListening(false);
      copilotInputRef.current?.focus();
      setCopilotReply('Escribe a Bunzy aquí ✍️');
      setTimeout(() => setCopilotReply(null), 3500);
    }
  };

  // Map Initialization — runs ONCE on mount
  useEffect(() => {
    if (!mapRef.current || mapInst.current) return;
    
    const fallbackLat = businesses.length > 0 && businesses[0].lat ? Number(businesses[0].lat) : 25.7275;
    const fallbackLng = businesses.length > 0 && businesses[0].lng ? Number(businesses[0].lng) : -100.312;

    const centerLat = userLat != null ? userLat : fallbackLat;
    const centerLng = userLng != null ? userLng : fallbackLng;

    const map = L.map(mapRef.current, {
      center: [centerLat, centerLng],
      zoom: 15,
      minZoom: 4,
      maxZoom: 21,
      zoomControl: false,
      attributionControl: false,
    });

    layerGroup.current = L.layerGroup().addTo(map);
    userMarkerGroup.current = L.layerGroup().addTo(map);
    mapInst.current = map;
    setMapReady(true);
    
    map.on('click', () => setSelected(null));

    // Observe container resizing (prevents white screen glitch on tab/view switch)
    let ro: ResizeObserver | null = null;
    if (mapRef.current && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        if (mapInst.current) {
          mapInst.current.invalidateSize();
        }
      });
      ro.observe(mapRef.current);
    }

    // Leaflet dimension recalculations
    const t1 = setTimeout(() => map.invalidateSize(), 60);
    const t2 = setTimeout(() => map.invalidateSize(), 200);
    const t3 = setTimeout(() => map.invalidateSize(), 500);
    const t4 = setTimeout(() => map.invalidateSize(), 1000);

    return () => { 
      if (ro) ro.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      map.remove(); 
      mapInst.current = null; 
      tileLayerRef.current = null;
      userMarkerGroup.current = null;
      setMapReady(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Basemap switcher: True Cyber Dark Matter vs Crisp Positron Light with Overzooming support
  useEffect(() => {
    const map = mapInst.current;
    if (!map || !mapReady) return;
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }
    const layer = isDark
      ? L.tileLayer(DARK_MATTER_URL, {
          subdomains: cartoKey ? 'abcd' : 'abc',
          maxZoom: 19,
          className: 'rabbitty-dark-tiles',
          attribution: MAP_TILE_ATTR,
        })
      : L.tileLayer(LIGHT_POSITRON_URL, {
          subdomains: cartoKey ? 'abcd' : 'abc',
          maxZoom: 19,
          className: 'rabbitty-light-tiles',
          attribution: MAP_TILE_ATTR,
        });
    layer.addTo(map);
    layer.bringToBack();
    tileLayerRef.current = layer;
  }, [isDark, mapReady]);

  // Reactive user marker and centering
  useEffect(() => {
    const map = mapInst.current;
    const group = userMarkerGroup.current;
    if (!map || !group) return;

    group.clearLayers();

    if (userLat != null && userLng != null) {
      const uIcon = L.divIcon({ html: userMarkerHTML(), className: '', iconSize: [28, 28], iconAnchor: [14, 14] });
      L.marker([userLat, userLng], { icon: uIcon, zIndexOffset: 2000 }).addTo(group);

      L.circle([userLat, userLng], {
        radius: 90,
        color: '#E91E63',
        fillColor: '#E91E63',
        fillOpacity: isDark ? 0.06 : 0.1,
        weight: 1.5,
        dashArray: '3 5',
      }).addTo(group);

      map.flyTo([userLat, userLng], 15.5, { duration: 1.2 });
    }
  }, [userLat, userLng, isDark]);

  // Render Business Markers with theme awareness
  useEffect(() => {
    const map = mapInst.current;
    const group = layerGroup.current;
    if (!map || !group) return;
    group.clearLayers();

    filteredBusinesses.forEach(b => {
      if (!b.lat || !b.lng) return;
      const lat = Number(b.lat);
      const lng = Number(b.lng);

      const isStockOnly = (b.acceptsBunz || b.accepts_bunz) && !(b.givesBunz || b.gives_bunz);
      const rw = b.rewardPercentage || b.reward_percentage || 0;
      const r = isStockOnly ? { color: "#E91E63", label: "Stock" } : RARITY[getRarity(rw)];
      const isSel = selected?.id === b.id;

      L.circle([lat, lng], {
        radius: isSel ? 100 : 70,
        color: r.color, 
        fillColor: r.color,
        fillOpacity: isSel ? (isDark ? 0.14 : 0.18) : (isDark ? 0.05 : 0.08),
        weight: isSel ? 1.5 : 1,
        dashArray: isSel ? undefined : '4 6',
      }).addTo(group);

      const icon = L.divIcon({ html: markerHTML(b, isSel, isDark), className:'', iconSize:[64,80], iconAnchor:[32,80] });
      L.marker([lat, lng], { icon, zIndexOffset: isSel ? 1500 : 800 })
        .addTo(group)
        .on('click', (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e.originalEvent);
          PlatformBridge.hapticFeedback('light');
          setSelected((prev) => prev?.id === b.id ? null : b);
          map.panTo([lat - 0.0018, lng], { animate:true, duration:0.5 });
        });
    });
  }, [filteredBusinesses, selected, isDark]);

  const totalBunzInZone = filteredBusinesses.reduce((sum, b) => sum + (b.rewardPercentage || b.reward_percentage || 0), 0);

  return (
    <div 
      className="w-full h-full relative overflow-hidden select-none" 
      style={{ background: isDark ? '#0D0914' : '#F8FAFC' }}
    >
      <style dangerouslySetInnerHTML={{__html: `
        .leaflet-container {
          background: ${isDark ? '#0D0914' : '#F8F9FA'} !important;
          outline: none;
        }
        @keyframes radar-spin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        .radar-sweep {
          position: absolute;
          top: 14px; left: 14px;
          width: 800px; height: 800px;
          background: conic-gradient(from 0deg, transparent 70%, rgba(233,30,99,0.04) 95%, rgba(233,30,99,0.35) 100%);
          border-radius: 50%;
          animation: radar-spin 3.2s linear infinite;
          pointer-events: none;
          z-index: 0;
          mix-blend-mode: ${isDark ? 'screen' : 'multiply'};
        }
        .rb-pulse {
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          border: 1.5px solid #E91E63;
          animation: rb-pulse-anim 2.5s cubic-bezier(0.24, 0, 0.38, 1) infinite;
          pointer-events: none;
        }
        .rb-pulse-2 { animation-delay: 0.8s; }
        .rb-pulse-3 { animation-delay: 1.6s; }
        @keyframes rb-pulse-anim {
          0% { transform: scale(0.9); opacity: 0.8; }
          100% { transform: scale(3.2); opacity: 0; }
        }
      `}} />

      {/* Hex Grid Overlay (Cyber Aesthetic) */}
      <div 
        className="absolute inset-0 z-1 pointer-events-none opacity-40" 
        style={{
          backgroundImage: isDark
            ? `repeating-linear-gradient(60deg,rgba(233,30,99,0.03) 0px,rgba(233,30,99,0.03) 1px,transparent 1px,transparent 30px),
               repeating-linear-gradient(120deg,rgba(233,30,99,0.03) 0px,rgba(233,30,99,0.03) 1px,transparent 1px,transparent 30px)`
            : `repeating-linear-gradient(60deg,rgba(0,136,204,0.02) 0px,rgba(0,136,204,0.02) 1px,transparent 1px,transparent 30px)`
        }} 
      />

      {/* Leaflet Map Canvas (oculto / transparente solo si MapKit nativo está verdaderamente activo) */}
      <div 
        ref={mapRef} 
        className={`absolute inset-0 z-0 transition-opacity duration-300 ${nativeMapActive ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} 
      />

      {/* Top HUD: Spots Counter & Quick Stats */}
      <div 
        className="absolute inset-x-4 z-20 flex items-center justify-between pointer-events-none"
        style={{ top: PlatformBridge.isTelegram() ? 12 : 14 }}
      >
        {/* Left Stats Pill (Glassmorphic) */}
        <div 
          className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-md backdrop-blur-xl"
          style={{
            background: isDark ? 'rgba(13, 9, 20, 0.88)' : 'rgba(255, 255, 255, 0.92)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
          }}
        >
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#E91E63] animate-pulse" />
            <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
              {filteredBusinesses.length} {filteredBusinesses.length === 1 ? 'Spot' : 'Spots'}
            </span>
          </div>
          
          {totalBunzInZone > 0 && (
            <>
              <span className="w-1 h-1 rounded-full bg-(--text-muted) opacity-40" />
              <span className="text-[11px] font-extrabold text-[#E91E63] flex items-center gap-1">
                <Flame className="w-3 h-3 fill-[#E91E63]" />
                {totalBunzInZone}% Bunz
              </span>
            </>
          )}
        </div>

        {/* Compact GPS status indicator (No space disruption) */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          {isLocating ? (
            <span 
              className="px-2.5 py-1 rounded-full text-[10px] font-black text-white flex items-center gap-1 shadow-md animate-pulse"
              style={{ background: 'linear-gradient(135deg, #E91E63 0%, #D81B60 100%)' }}
            >
              <Crosshair size={11} className="animate-spin" />
              <span>GPS...</span>
            </span>
          ) : userLat && userLng ? (
            <button
              type="button"
              onClick={() => {
                PlatformBridge.hapticFeedback('light');
                if (mapInst.current) {
                  mapInst.current.flyTo([userLat, userLng], 16.5, { duration: 1 });
                }
                if (onRequestLocation && locationTimestamp && Date.now() - locationTimestamp > 60_000) {
                  onRequestLocation();
                }
              }}
              className="px-2.5 py-1 rounded-full text-[10px] font-black text-emerald-300 border border-emerald-500/30 bg-emerald-950/70 backdrop-blur-md flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
              title={`Centrar en mi ubicación GPS${accuracy ? ` (Precisión: ±${Math.round(accuracy)}m)` : ''}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{accuracy ? `GPS Activo (±${Math.round(accuracy)}m)` : 'GPS Activo'}</span>
            </button>
          ) : (
            onRequestLocation && (
              <button
                type="button"
                onClick={() => {
                  PlatformBridge.hapticFeedback('light');
                  onRequestLocation();
                }}
                className="px-2.5 py-1 rounded-full text-[10px] font-bold text-gray-300 border border-white/10 bg-black/60 backdrop-blur-md flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer hover:text-white"
                title="Activar GPS"
              >
                <Crosshair size={10} className="text-pink-400" />
                <span>Activar GPS</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Bunzy Copilot Floating Search Bar (Apple/Google Maps style search input) */}
      <div 
        className="absolute z-20 inset-x-4 pointer-events-none"
        style={{ top: PlatformBridge.isTelegram() ? 56 : 58 }}
      >
        <div 
          className="pointer-events-auto rounded-2xl border shadow-xl backdrop-blur-2xl p-2.5 transition-all"
          style={{
            background: isDark ? 'rgba(18, 12, 28, 0.92)' : 'rgba(255, 255, 255, 0.95)',
            borderColor: isListening ? '#E91E63' : (isDark ? 'rgba(233, 30, 99, 0.3)' : 'rgba(233, 30, 99, 0.2)'),
            boxShadow: isListening 
              ? '0 0 24px rgba(233, 30, 99, 0.35)' 
              : '0 8px 32px rgba(0, 0, 0, 0.12)',
          }}
        >
          <div className="flex items-center gap-2.5">
            {/* Bunzy Avatar with Pulsing Halo */}
            <div 
              className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0 shadow-sm relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #E91E63 0%, #8E24AA 100%)',
              }}
            >
              <span>🐰</span>
              {isListening && (
                <div className="absolute inset-0 bg-[#E91E63]/30 animate-ping rounded-xl" />
              )}
            </div>

            {/* Input or Voice Feedback text */}
            <div className="flex-1 min-w-0">
              {copilotReply ? (
                <p className="m-0 text-xs font-bold truncate text-[#E91E63] flex items-center gap-1.5 animate-fadeIn">
                  <Sparkles size={13} className="shrink-0" />
                  <span>{copilotReply}</span>
                </p>
              ) : isListening ? (
                <p className="m-0 text-xs font-bold truncate text-[#E91E63] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#E91E63] animate-ping" />
                  <span>Escuchando... &ldquo;Café cerca&rdquo;, &ldquo;Más Bunz&rdquo;</span>
                </p>
              ) : (
                <div className="flex items-center">
                  <input
                    ref={copilotInputRef}
                    type="text"
                    value={copilotQuery}
                    onChange={(e) => setCopilotQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && copilotQuery.trim()) {
                        handleVoiceCommand(copilotQuery.trim());
                      }
                    }}
                    placeholder='Pregunta a Bunzy: "¿A dónde vamos?"'
                    className="w-full bg-transparent border-none outline-none text-xs font-semibold placeholder:text-(--text-muted)"
                    style={{ color: 'var(--text-primary)' }}
                  />
                </div>
              )}
            </div>

            {/* Mic Button (Voice Assistant Command) */}
            <button
              type="button"
              onClick={toggleSpeechRecognition}
              className={`w-8 h-8 rounded-xl flex items-center justify-center border-none cursor-pointer transition-all active:scale-95 ${
                isListening ? 'bg-[#E91E63] text-white animate-pulse' : 'bg-(--bg-subtle) text-(--text-primary)'
              }`}
              title={speechSupported ? 'Hablar con Bunzy Copilot' : 'Escribir comando para Bunzy'}
            >
              {isListening ? <MicOff size={15} /> : <Mic size={15} className="text-[#E91E63]" />}
            </button>
          </div>

          {/* Quick Voice Prompt Shortcuts */}
          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-(--border-subtle) overflow-x-auto hide-scrollbar">
            {[
              { label: '☕ Café cerca', query: 'Cafeterías cerca' },
              { label: '🔥 Más Bunz', query: 'Comercios con mayor cashback' },
              { label: '🍕 Dónde comer', query: 'Restaurantes y comida' },
              { label: '📍 Mi ubicación', query: 'Dónde estoy' },
            ].map((chip) => (
              <button
                key={chip.label}
                onClick={() => handleVoiceCommand(chip.query)}
                className="px-2 py-0.5 rounded-lg text-[9.5px] font-bold whitespace-nowrap bg-(--bg-subtle) hover:bg-[#E91E63]/15 text-(--text-secondary) hover:text-[#E91E63] border border-(--border-subtle) cursor-pointer transition-colors shrink-0"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Floating Map Controls (Google Maps / Apple Maps Style) */}
      <div 
        className="absolute right-4 z-20 flex flex-col gap-2.5 pointer-events-auto"
        style={{ top: PlatformBridge.isTelegram() ? 175 : 180 }}
      >
        {/* Locate Me GPS Button */}
        <button 
          type="button"
          onClick={() => {
            PlatformBridge.hapticFeedback('light');
            if (userLat && userLng && mapInst.current) {
              mapInst.current.flyTo([userLat, userLng], 16.5, { duration: 1 });
            } else if (onRequestLocation) {
              onRequestLocation();
            }
          }}
          className="w-10 h-10 rounded-2xl flex items-center justify-center border cursor-pointer shadow-lg backdrop-blur-xl active:scale-90 transition-transform"
          style={{
            background: userLat 
              ? (isDark ? 'rgba(18, 12, 28, 0.92)' : 'rgba(255, 255, 255, 0.95)') 
              : 'rgba(233,30,99,0.18)',
            borderColor: userLat 
              ? (isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)') 
              : '#E91E63',
            color: userLat ? (isDark ? '#FFFFFF' : '#111111') : '#E91E63',
          }}
          title={userLat ? "Centrar en mi ubicación" : "Activar GPS"}
        >
          <Crosshair size={18} className={isLocating ? 'animate-spin' : ''} />
        </button>

        {/* Compass / Recenter Spots Button */}
        <button 
          type="button"
          onClick={() => {
            PlatformBridge.hapticFeedback('light');
            if (filteredBusinesses.length > 0 && mapInst.current) {
              const bounds = L.latLngBounds(
                filteredBusinesses
                  .filter(b => b.lat != null && b.lng != null)
                  .map(b => [Number(b.lat), Number(b.lng)] as [number, number])
              );
              if (bounds.isValid()) {
                mapInst.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
              }
            }
          }}
          className="w-10 h-10 rounded-2xl flex items-center justify-center border cursor-pointer shadow-lg backdrop-blur-xl active:scale-90 transition-transform"
          style={{
            background: isDark ? 'rgba(18, 12, 28, 0.92)' : 'rgba(255, 255, 255, 0.95)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
            color: 'var(--text-primary)',
          }}
          title="Ver todos los spots"
        >
          <Compass size={18} />
        </button>
      </div>

      {/* Selected Business Action Card (Positioned cleanly ABOVE the bottom filter dock) */}
      {selected && (
        <div 
          className="absolute inset-x-3 z-30 max-w-md mx-auto pointer-events-auto animate-fadeIn transition-all duration-300"
          style={{ bottom: PlatformBridge.isTelegram() ? 116 : 108 }}
        >
          <div 
            onClick={() => router.push(`/affiliate/${selected.id}`)}
            className="p-4 rounded-3xl border shadow-2xl backdrop-blur-2xl flex flex-col gap-2.5 cursor-pointer relative overflow-hidden transition-all active:scale-98"
            style={{
              background: isDark ? 'rgba(18, 12, 28, 0.98)' : 'rgba(255, 255, 255, 0.98)',
              borderColor: isDark ? 'rgba(233, 30, 99, 0.45)' : 'rgba(233, 30, 99, 0.3)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.45)',
            }}
          >
            {/* Grab Handle bar */}
            <div className="absolute top-1.5 inset-x-0 flex justify-center pointer-events-none">
              <span className="w-8 h-1 rounded-full bg-white/20" />
            </div>

            <div className="flex items-center gap-3.5 mt-1">
              {/* Business Logo / Emoji Avatar */}
              <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 border border-(--border-subtle) bg-(--bg-subtle) flex items-center justify-center">
                {selected.logoUrl || selected.imageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img 
                    src={selected.logoUrl || selected.imageUrl} 
                    alt={selected.name || 'Comercio'} 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <span className="text-2xl">{getIcon(selected.category || selected.device)}</span>
                )}
              </div>

              {/* Info Column */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <h3 className="m-0 text-base font-black truncate" style={{ color: 'var(--text-primary)' }}>
                    {selected.name || selected.user}
                  </h3>
                  
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelected(null);
                    }}
                    className="w-6 h-6 rounded-full bg-(--bg-subtle) hover:bg-[#E91E63]/20 flex items-center justify-center text-(--text-muted) hover:text-[#E91E63] border-none cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>

                <p className="m-0 text-xs font-semibold text-(--text-muted) mt-0.5 truncate">
                  {selected.category || selected.device || 'Comercio Afiliado'} • {selected.distance ? `${selected.distance} km` : 'Cerca de ti'}
                </p>

                {/* Rewards / Bunz Pills */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {(selected.givesBunz !== false) && (
                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black bg-[#E91E63]/15 text-[#E91E63] border border-[#E91E63]/30 flex items-center gap-1">
                      <Flame size={11} className="fill-[#E91E63]" />
                      +{selected.reward_percentage || selected.rewardPercentage || 10}% Bunz
                    </span>
                  )}
                  {selected.acceptsBunz === true && (
                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 flex items-center gap-1">
                      <Gift size={11} />
                      Stock Disponible
                    </span>
                  )}
                </div>
              </div>

              {/* Navigation CTA button */}
              <div className="w-10 h-10 rounded-2xl bg-[#E91E63] text-white flex items-center justify-center shrink-0 shadow-lg shadow-pink-500/30 hover:scale-105 transition-transform">
                <Navigation size={18} className="rotate-45" />
              </div>
            </div>

            {/* Micro Details Row: Horario / Dirección */}
            {(selected.address || selected.startTime) && (
              <div className="pt-2 border-t border-(--border-subtle) flex items-center justify-between text-[11px] text-(--text-muted) font-medium">
                <span className="truncate max-w-[70%]">
                  📍 {selected.address || 'Ubicación física'}
                </span>
                {selected.startTime && selected.endTime && (
                  <span className="shrink-0 text-emerald-400 font-bold">
                    Abierto • {selected.startTime} - {selected.endTime}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Floating Filter Dock (Always Stays in Place at the Bottom) */}
      <div 
        className="absolute z-20 inset-x-4 flex flex-col gap-2 pointer-events-none transition-all duration-300"
        style={{ 
          bottom: PlatformBridge.isTelegram() ? 24 : 18,
        }}
      >
        <div 
          className="pointer-events-auto p-2 rounded-2xl border shadow-xl backdrop-blur-2xl flex flex-col gap-1.5"
          style={{
            background: isDark ? 'rgba(13, 9, 20, 0.92)' : 'rgba(255, 255, 255, 0.95)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
          }}
        >
          {/* Mode Selector Tabs: Todos / Gana Bunz / Gasta Bunz */}
          <div className="flex gap-1 p-0.5 rounded-xl bg-(--bg-subtle) border border-(--border-subtle)">
            {[
              { id: 'Todos', label: 'Todos' },
              { id: "bunz'in", label: 'Gana Bunz' },
              { id: 'Stock', label: 'Gasta Bunz' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  PlatformBridge.hapticFeedback('light');
                  setActiveMode(m.id);
                }}
                className={`flex-1 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide border-none cursor-pointer transition-all ${
                  activeMode === m.id
                    ? 'bg-[#E91E63] text-white shadow-xs'
                    : 'bg-transparent text-(--text-muted) hover:text-(--text-primary)'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Horizontal Category Chips */}
          <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar">
            {[
              { id: 'Todos', label: 'Todos', icon: '🌐' },
              { id: 'Cafetería', label: 'Cafés', icon: '☕' },
              { id: 'Restaurante', label: 'Gastro', icon: '🍕' },
              { id: 'Bar', label: 'Copas', icon: '🍸' },
              { id: 'Fitness', label: 'Fitness', icon: '💪' },
              { id: 'Belleza', label: 'Belleza', icon: '✨' },
            ].map((cat) => {
              const active = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    PlatformBridge.hapticFeedback('light');
                    setActiveCategory(cat.id);
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold whitespace-nowrap cursor-pointer transition-all border ${
                    active
                      ? 'bg-(--text-primary) text-(--bg-primary) border-transparent shadow-xs'
                      : 'bg-(--bg-subtle) text-(--text-muted) border-(--border-subtle) hover:text-(--text-primary)'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

<a id="telegram-miniappsrcfeaturesmapnativeMapBridgets"></a>
## Archivo: `telegram-miniapp/src/features/map/nativeMapBridge.ts`

```typescript
import { registerPlugin, PluginListenerHandle } from '@capacitor/core';
import { MapBusiness } from './InteractiveMap';

export interface RabbittyMapPluginInterface {
  showMap(): Promise<{ success: boolean }>;
  hideMap(): Promise<{ success: boolean }>;
  setBusinesses(options: { businesses: MapBusiness[] }): Promise<{ count: number }>;
  centerOn(options: { lat: number; lng: number; radiusKm?: number }): Promise<{ success: boolean }>;
  addListener(
    eventName: 'onBusinessSelected',
    listenerFunc: (data: { businessId: string }) => void
  ): Promise<PluginListenerHandle>;
}

export const RabbittyMap = registerPlugin<RabbittyMapPluginInterface>('RabbittyMap');
```

---

<a id="telegram-miniappsrcappapilocationpingroutets"></a>
## Archivo: `telegram-miniapp/src/app/api/location/ping/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ownedBusinesses, transactions, notifications, affiliateCampaigns } from "@/db/schema";
import { and, eq, inArray, sql, gt } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { isApnsConfigured, sendPushToUser } from "@/lib/push/apns";
import { restaurantDb } from "@/db/restaurant";
import { restaurants, branches, events } from "@rabbitty/database-restaurant/schema";

/**
 * Calculates geodetic distance in meters using the Haversine formula.
 */
function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

import { checkRateLimit } from "@/lib/rateLimit";

const COOLDOWN_SECONDS = 12 * 60 * 60; // 12 horas

async function isCooldownActive(key: string, cooldownSec: number): Promise<boolean> {
  const res = await checkRateLimit(`cd:${key}`, 1, cooldownSec);
  return !res.allowed;
}

interface ProximityMatch {
  businessId: string;
  businessName: string;
  category: string;
  distanceMeters: number;
  rewardPercentage: number;
  hasActiveBoost?: boolean;
  boostTitle?: string;
  loyaltyOffer?: {
    type: "DOUBLE_CASHBACK_VIP" | "PERSONAL_REWARD_100" | "FLASH_BOOST";
    title: string;
    description: string;
    pastVisits: number;
    multiplier: number;
  };
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    const body = await req.json();
    const { lat, lng, accuracy, timestamp } = body;

    if (typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json({ error: "lat and lng are required numbers" }, { status: 400 });
    }

    // Validación estricta de frescura: rechazar lecturas de geolocalización obsoletas (>60s)
    if (typeof timestamp === "number" && Date.now() - timestamp > 60_000) {
      return NextResponse.json({
        success: false,
        error: "Lectura GPS obsoleta. El motor de proximidad exige coordenadas en tiempo real (<60s).",
        reason: "stale_location",
      }, { status: 400 });
    }

    if (caller?.id) {
      const rl = await checkRateLimit(`ping:${caller.id}`, 10, 30);
      if (!rl.allowed) {
        return NextResponse.json({ error: "Too many location pings" }, { status: 429 });
      }
    }

    const businesses = await db
      .select()
      .from(ownedBusinesses)
      .where(eq(ownedBusinesses.status, "APPROVED"))
      .limit(200);

    const matches: ProximityMatch[] = [];
    const triggeredOffers: string[] = [];

    const nearBusinesses: Array<{ business: (typeof businesses)[0]; dist: number }> = [];
    for (const b of businesses) {
      if (typeof b.lat !== "number" || typeof b.lng !== "number") continue;
      const dist = getDistanceMeters(lat, lng, b.lat, b.lng);
      if (dist <= 2500) {
        nearBusinesses.push({ business: b, dist });
      }
    }

    // Fetch any active campaigns / flash boosts for nearby businesses
    const nearBusinessIds = nearBusinesses.map((nb) => nb.business.id);
    const activeCampaignsMap = new Map<string, { rewardPercentage: number; title: string; headline: string; maxRewardPerUser: number }>();
    if (nearBusinessIds.length > 0) {
      const now = new Date();
      const campaigns = await db
        .select()
        .from(affiliateCampaigns)
        .where(
          and(
            inArray(affiliateCampaigns.businessId, nearBusinessIds),
            eq(affiliateCampaigns.campaignType, "FLASH_OFFER"),
            eq(affiliateCampaigns.status, "ACTIVE"),
            gt(affiliateCampaigns.expiresAt, now)
          )
        );
      for (const cmp of campaigns) {
        // Keep the highest reward percentage if multiple campaigns exist
        const existing = activeCampaignsMap.get(cmp.businessId);
        if (!existing || cmp.rewardPercentage > existing.rewardPercentage) {
          activeCampaignsMap.set(cmp.businessId, {
            rewardPercentage: cmp.rewardPercentage,
            title: cmp.title,
            headline: cmp.headline,
            maxRewardPerUser: cmp.maxRewardPerUser || 50,
          });
        }
      }
    }

    const visitCountMap = new Map<string, number>();
    if (caller) {
      const proxBusinessIds = nearBusinesses
        .filter((nb) => nb.dist <= 250)
        .map((nb) => nb.business.id);
      if (proxBusinessIds.length > 0) {
        const counts = await db
          .select({
            businessId: transactions.businessId,
            count: sql<number>`count(*)`,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, caller.id),
              inArray(transactions.businessId, proxBusinessIds),
              eq(transactions.status, "COMPLETED")
            )
          )
          .groupBy(transactions.businessId);
        for (const c of counts) {
          visitCountMap.set(c.businessId, Number(c.count ?? 0));
        }
      }
    }

    for (const nb of nearBusinesses) {
      const b = nb.business;
      const dist = nb.dist;
      const activeBoost = activeCampaignsMap.get(b.id);
      const effectiveReward = activeBoost ? Math.max(b.rewardPercentage, activeBoost.rewardPercentage) : b.rewardPercentage;

      const match: ProximityMatch = {
        businessId: b.id,
        businessName: b.name,
        category: b.category,
        distanceMeters: dist,
        rewardPercentage: effectiveReward,
        hasActiveBoost: !!activeBoost,
        boostTitle: activeBoost?.headline || activeBoost?.title,
      };

      if (caller && dist <= 250 && (!accuracy || accuracy <= 200)) {
        const visitCount = visitCountMap.get(b.id) ?? 0;

        // Si el comercio tiene un Flash Boost activo, priorizar la oferta de proximidad especial
        if (activeBoost && activeBoost.rewardPercentage > b.rewardPercentage) {
          match.loyaltyOffer = {
            type: "FLASH_BOOST",
            title: `⚡ ¡Flash Boost en ${b.name}!`,
            description: `${activeBoost.headline || activeBoost.title}: Obtén +${activeBoost.rewardPercentage}% Bunz en tu consumo hoy al pagar en caja.`,
            pastVisits: visitCount,
            multiplier: 1.0,
          };

          const cooldownKey = `push:boost:${caller.id}:${b.id}`;
          const isBoostCoolingDown = await isCooldownActive(cooldownKey, COOLDOWN_SECONDS);

          if (!isBoostCoolingDown) {
            const pushTitle = `⚡ ¡${activeBoost.rewardPercentage}% Bunz en ${b.name}!`;
            const pushBody = `Pasa en tu caminata de hoy: ${activeBoost.headline || `obtenemos recompensa especial de +${activeBoost.rewardPercentage}% Bunz`}.`;

            await db
              .insert(notifications)
              .values({
                userId: caller.id,
                title: pushTitle,
                message: pushBody,
                type: "LOYALTY_OFFER",
              })
              .catch(() => {});

            if (isApnsConfigured()) {
              sendPushToUser(caller.id, {
                title: pushTitle,
                body: pushBody,
                data: {
                  type: "PROXIMITY_BOOST",
                  businessId: b.id,
                  businessName: b.name,
                  rewardPercentage: activeBoost.rewardPercentage,
                },
              }).catch((err) => {
                console.warn("[LOCATION_PING] Push send error:", err);
              });
            }

            triggeredOffers.push(b.name);
          }
        } else if (visitCount >= 10) {
          match.loyaltyOffer = {
            type: "DOUBLE_CASHBACK_VIP",
            title: `¡Bonificación Especial en ${b.name}!`,
            description: `Por tu fidelidad (${visitCount} visitas), recibe doble cashback (hasta 50 Bunz) en tu consumo de hoy al pagar en caja.`,
            pastVisits: visitCount,
            multiplier: 2.0,
          };

          const cooldownKey = `push:loyalty:${caller.id}:${b.id}`;
          const isCoolingDown = await isCooldownActive(cooldownKey, COOLDOWN_SECONDS);

          if (!isCoolingDown) {
            const pushTitle = `🐰 ¡Estás cerca de ${b.name}!`;
            const pushBody = `Visita #${visitCount + 1}: Recibe doble cashback (hasta 50 Bunz) en tu consumo de hoy al pagar en caja.`;

            await db
              .insert(notifications)
              .values({
                userId: caller.id,
                title: pushTitle,
                message: pushBody,
                type: "LOYALTY_OFFER",
              })
              .catch(() => {});

            if (isApnsConfigured()) {
              sendPushToUser(caller.id, {
                title: pushTitle,
                body: pushBody,
                data: {
                  type: "PROXIMITY_LOYALTY",
                  businessId: b.id,
                  businessName: b.name,
                },
              }).catch((err) => {
                console.warn("[LOCATION_PING] Push send error:", err);
              });
            }

            triggeredOffers.push(b.name);
          }
        }

        if (dist <= 60) {
          const poorAccuracy = typeof accuracy === "number" && accuracy > 80;
          if (!poorAccuracy) {
            const arrivalKey = `arrival:${caller.id}:${b.id}`;
            const isArrivalCoolingDown = await isCooldownActive(arrivalKey, 4 * 60 * 60);
            if (!isArrivalCoolingDown) {
              try {
                const [rest] = await restaurantDb
                  .select()
                  .from(restaurants)
                  .where(eq(restaurants.businessId, b.id))
                  .limit(1);
                if (rest) {
                  const [branch] = await restaurantDb
                    .select()
                    .from(branches)
                    .where(eq(branches.restaurantId, rest.id))
                    .limit(1);
                  if (branch) {
                    await restaurantDb
                      .insert(events)
                      .values({
                        branchId: branch.id,
                        type: "CUSTOMER_ARRIVAL",
                        payload: {
                          userId: caller.id,
                          username: caller.username || "Rabbitter",
                          visitCount,
                          isVip: visitCount >= 10,
                          arrivedAt: new Date().toISOString(),
                          distanceMeters: dist,
                          accuracy: typeof accuracy === "number" ? accuracy : undefined,
                        },
                      })
                      .catch((err) => {
                        console.warn("[LOCATION_PING] Failed to insert CUSTOMER_ARRIVAL event:", err);
                      });
                  }
                }
              } catch (err) {
                console.warn("[LOCATION_PING] Error looking up restaurant/branch for arrival:", err);
              }
            }
          }
        }
      }

      matches.push(match);
    }

    matches.sort((a, b) => a.distanceMeters - b.distanceMeters);

    return NextResponse.json({
      success: true,
      nearbyCount: matches.length,
      immediateMatches: matches.filter((m) => m.distanceMeters <= 250),
      matches: matches.slice(0, 10),
      triggeredOffers,
    });
  } catch (error) {
    console.error("[LOCATION_PING_ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

---
