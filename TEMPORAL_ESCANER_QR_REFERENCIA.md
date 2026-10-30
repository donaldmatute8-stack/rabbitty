# 🔍 REFERENCIA COMPLETA — Escáner, RabbittyCode, QRs y Autenticación

> Generado: 2026-10-29 16:16
> Fuente: repo rabbitty (main) — contenido literal de los archivos involucrados.

> Índice:
>   1. telegram-miniapp/src/lib/rabbittyCodeCodec.ts — CODEC — codificación/decodificación de las barras neón (fuente única, copias idénticas en admin y landing)
>   2. telegram-miniapp/src/lib/scannerResolver.ts — SCANNER RESOLVER — fuente única de resolución de TODOS los códigos escaneados
>   3. telegram-miniapp/src/components/ui/RabbittyCode.tsx — RabbittyCode (miniapp) — el neón propietario con state='decoding'
>   4. apps/admin/src/components/ui/RabbittyCode.tsx — RabbittyCode (admin) — misma identidad, codec idéntico
>   5. landing-page/src/components/SimpleQRCode.tsx — SimpleQRCode + NeonQRCode (landing) — QR estándar y neón con codec
>   6. telegram-miniapp/src/components/QRDiscovery.tsx — QRDiscovery (miniapp) — neón → revelación QR con logo (fuente única de presentación)
>   7. apps/admin/src/components/QRDiscovery.tsx — QRDiscovery (admin) — copia idéntica
>   8. landing-page/src/components/QRDiscovery.tsx — QRDiscovery (landing) — con NeonQRCode como fase neón
>   9. telegram-miniapp/src/components/RabbittyLoader.tsx — RabbittyLoader (miniapp) — loader con RabbittyCode decodificándose
>   10. apps/admin/src/components/RabbittyLoader.tsx — RabbittyLoader (admin)
>   11. landing-page/src/components/RabbittyLoader.tsx — RabbittyLoader (landing) — con NeonQRCode
>   12. telegram-miniapp/src/app/scan/page.tsx — ESCÁNER MINIAPP — Mi Código + cámara + decoder neón + todos los handlers
>   13. telegram-miniapp/src/features/transactions/QRScanner.tsx — QRScanner (modal del afiliado emparejado) — html5-qrcode + decoder neón
>   14. telegram-miniapp/src/app/business/scan/page.tsx — BUSINESS SCAN — escáner del comercio (otorgar Bunz al cliente)
>   15. telegram-miniapp/src/app/api/rabbitty-code/lookup/route.ts — LOOKUP — resolución de códigos (numérico O(1) por scan_code, texto universal)
>   16. telegram-miniapp/src/app/api/rabbitty-code/mine/route.ts — MINE — código óptico asignado del usuario autenticado
>   17. landing-page/src/app/impresos/page.tsx — GATE /IMPRESOS — QRDiscovery + políticas HERO/REWARD/EVERGREEN + temp codes
>   18. landing-page/src/app/api/auth/qr-impresos/route.ts — QR-IMPRESOS API — sesión de gate + SET_WELCOME_BUNZ + temp codes + pending codes
>   19. landing-page/src/app/.well-known/apple-app-site-association/route.ts — AASA (rabbitty.me) — route handler con content-type application/json
>   20. telegram-miniapp/public/.well-known/apple-app-site-association — AASA (app.rabbitty.me) — Universal Links para /scan*, /download*, /kiosk-confirm*
>   21. telegram-miniapp/src/components/DeepLinkHandler.tsx — DEEP LINK HANDLER — Universal Links → rutas internas de la app
>   22. packages/api/src/routers/passkeys.ts — PASSKEYS ROUTER (trpc) — registro/verificación server-side con @simplewebauthn
>   23. apps/admin/src/app/api/auth/2fa/passkey/route.ts — 2FA PASSKEY (gate unlock) — registro + unlock del God Admin
>   24. apps/admin/src/app/api/auth/2fa/grant/route.ts — 2FA GRANT — emite la cookie god2fa tras verificación
>   25. packages/api/src/services/god2fa.ts — GOD2FA SERVICE — cookie firmada, impersonación, TOTP, WebAuthn helpers
>   26. apps/admin/src/app/verify-2fa/page.tsx — VERIFY-2FA — pantalla de verificación (TOTP + Face ID/passkey)
>   27. packages/auth/src/auth.ts — NEXTAUTH — proveedores (passkey, email-token, magic-link, telegram) + fail-fast AUTH_SECRET
>   28. telegram-miniapp/src/lib/securityVault.ts — SECURITY VAULT — Face ID/PIN/passkeys + fast login stash + biometría honesta
>   29. telegram-miniapp/src/features/auth/PhoneAuthFlow.tsx — PHONE AUTH FLOW — OTP + celebración bunz + fast login Face ID
>   30. apps/admin/src/app/api/kiosk/pair/generate/route.ts — KIOSK PAIR GENERATE — sesión de identificación (10 min)
>   31. apps/admin/src/app/api/kiosk/pair/status/route.ts — KIOSK PAIR STATUS — polling del kiosko
>   32. telegram-miniapp/src/app/api/kiosk/pair/confirm/route.ts — KIOSK PAIR CONFIRM — el cliente confirma su identidad
>   33. telegram-miniapp/src/app/kiosk-confirm/page.tsx — KIOSK CONFIRM — pantalla de confirmación del cliente

---


## 📄 `telegram-miniapp/src/lib/rabbittyCodeCodec.ts`

**CODEC — codificación/decodificación de las barras neón (fuente única, copias idénticas en admin y landing)**

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
  return hashString(data || 'rabbitty') % (MAX_SCAN_CODE + 1);
}

const H_MIN = 20;
const H_MAX = 85;
// ── 3 NIVELES (base-3): gaps de ~21.7% entre niveles — mucho más robustos de
//    cuantizar en cámara que 4 niveles. 3^13 = 1,594,323 ≥ 1,000,000. ──
const LEVELS = 3;
export function levelToHeight(d: number): number {
  return H_MIN + (d * (H_MAX - H_MIN)) / (LEVELS - 1);
}

export const MAX_SCAN_CODE = 531_440; // 3^12 - 1 (12 trits de datos + 1 de paridad)

/** Alturas de las 13 barras: 12 trits de datos + paridad (checksum tritario). */
export function barsFromCode(code: number): number[] {
  const value = Math.max(0, Math.min(MAX_SCAN_CODE, Math.round(code)));
  const digits: number[] = [];
  for (let i = 11; i >= 0; i--) {
    digits.push(Math.floor(value / Math.pow(3, i)) % 3);
  }
  const parity = digits.reduce((a, b) => a + b, 0) % 3;
  return [...digits.map(levelToHeight), levelToHeight(parity)];
}

/**
 * Decodifica alturas medidas (0..1 relativas o 20..85) → código de 6 dígitos o null.
 * Cuantización a 3 niveles con RECHAZO de barras ambiguas (fuera de zona de decisión).
 */
export function codeFromBars(rawHeights: number[]): number | null {
  if (!rawHeights || rawHeights.length !== 13) return null;
  const heights = rawHeights.map((h) => Number(h) || 0);
  const max = Math.max(...heights);
  const min = Math.min(...heights);
  if (max - min < (H_MAX - H_MIN) * 0.12) return null; // todo igual → sin señal

  // ── Clustering de niveles: ordenar y separar por gaps grandes (hasta 3 grupos) ──
  const sorted = [...heights].sort((a, b) => a - b);
  const span = max - min;
  const gapThreshold = span * 0.22;
  const centers: number[] = [sorted[0]];
  for (let i = 1; i < 13; i++) {
    if (sorted[i] - sorted[i - 1] > gapThreshold && centers.length < 3) {
      centers.push(sorted[i]);
    }
  }
  const k = centers.length; // 2 o 3 niveles presentes en este frame
  if (k < 2) return null;

  // Mapear cada barra al cluster más cercano (con margen de rechazo)
  const groupIdx: number[] = [];
  const margin = span * 0.14;
  for (const h of heights) {
    let best = 0;
    let bestDist = Infinity;
    for (let gi = 0; gi < k; gi++) {
      const d = Math.abs(h - centers[gi]);
      if (d < bestDist) { bestDist = d; best = gi; }
    }
    if (bestDist > margin) return null; // barra ambigua → frame inválido
    groupIdx.push(best);
  }

  // Desambiguación: probar desplazamientos de los grupos a niveles base-3
  // (k=3 → [0,1,2]; k=2 → [0,1] o [1,2]). La paridad decide cuál es válida.
  const shifts = k === 3 ? [0] : [0, 3 - k];
  for (const shift of shifts) {
    const digits = groupIdx.map((g) => g + shift);
    const parity = digits.pop() ?? 0;
    if (parity !== digits.reduce((a, b) => a + b, 0) % 3) continue;
    if (digits.some((d) => d > 2)) continue;
    let value = 0;
    for (const d of digits) value = value * 3 + d;
    if (value > MAX_SCAN_CODE) continue;
    return value;
  }
  return null;
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

*(167 líneas)*


## 📄 `telegram-miniapp/src/lib/scannerResolver.ts`

**SCANNER RESOLVER — fuente única de resolución de TODOS los códigos escaneados**

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

  // ── 7.5 QR Login (gate /impresos, PC) — string puro, ANTES del server-lookup
  //    (el lookup clasifica esta URL como 'url' genérica y la mandaría al browser) ──
  if (rawText.includes('qrlogin_')) {
    const qrToken = rawText.split('qrlogin_')[1]?.split('&')[0]?.split('?')[0] || '';
    if (qrToken) {
      return { success: true, type: 'qrlogin', raw: rawText, qrLogin: { qrToken, sessionId: '' } };
    }
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

*(292 líneas)*


## 📄 `telegram-miniapp/src/components/ui/RabbittyCode.tsx`

**RabbittyCode (miniapp) — el neón propietario con state='decoding'**

```typescript
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { barsFromCode, code6FromData } from '@/lib/rabbittyCodeCodec';

interface RabbittyCodeProps {
  data: string;
  size?: number;
  showCardFrame?: boolean;
  className?: string;
  state?: 'idle' | 'decoding'; // decoding: barras ondulando + anillos girando (caja fuerte abriéndose)
}

export default function RabbittyCode({ data, size = 260, showCardFrame = true, className = '', state = 'idle' }: RabbittyCodeProps) {
  // ── Barras machine-readable: codifican el código asignado por el servidor ──
  // data soporta prefijo "rc:<código>" (asignado por server, sin colisiones).
  // Sin prefijo: fallback hash (decorativo/compat).
  const waveBars = useMemo(() => {
    const d = String(data ?? '');
    const m = d.match(/^rc:(\d{1,6})$/);
    return barsFromCode(m ? Number(m[1]) : code6FromData(d));
  }, [data]);

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
        <motion.div
          className="absolute inset-0 m-auto pointer-events-none"
          animate={state === 'decoding' ? { rotate: 360 } : { rotate: 0 }}
          transition={state === 'decoding' ? { repeat: Infinity, duration: 2.5, ease: 'linear' } : { duration: 0.3 }}
        >
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
        </motion.div>

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

*(133 líneas)*


## 📄 `apps/admin/src/components/ui/RabbittyCode.tsx`

**RabbittyCode (admin) — misma identidad, codec idéntico**

```typescript
import React, { useMemo } from 'react';
import { barsFromCode, code6FromData } from '../../lib/rabbittyCodeCodec';

interface RabbittyCodeProps {
  data: string;
  size?: number;
  showCardFrame?: boolean;
  className?: string;
}

export default function RabbittyCode({ data, size = 260, showCardFrame = true, className = '' }: RabbittyCodeProps) {
    // Generate 15 dynamic soundwave bars in the center
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
    <div className={`relative inline-flex flex-col items-center justify-center ${className}`} style={{ width: size, height: showCardFrame ? size * 1.8 : size }}>
      {showCardFrame && (
        <>
          {/* Top Neon Bunny Geometry - Exact Vector Image match Rabbitty_vector.png */}
          <div className="absolute -top-16 z-30 pointer-events-none drop-shadow-[0_0_20px_rgba(244,63,94,0.95)]">
            <img 
              src="/Rabbitty_vector.png" 
              alt="Rabbitty Vector" 
              className="w-[110px] h-[130px] object-contain filter drop-shadow-[0_0_12px_#F43F5E]" 
            />
          </div>

          {/* Rabbitty Branding Label */}
          <div className="absolute top-[82px] z-20 flex items-center gap-1.5 opacity-90">
            <span className="text-[10px] tracking-[0.28em] font-black text-white uppercase flex items-center gap-1.5 drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]">
              <img src="/logo_conejo.png" alt="Rabbitty Logo" className="w-4 h-4 object-contain inline-block" /> RABBITTY
            </span>
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

*(125 líneas)*


## 📄 `landing-page/src/components/SimpleQRCode.tsx`

**SimpleQRCode + NeonQRCode (landing) — QR estándar y neón con codec**

```typescript
'use client';

import React, { useMemo } from 'react';
import { barsFromCode, code6FromData } from '@/lib/rabbittyCodeCodec';

/**
 * Standard scannable QR Code for printed marketing pieces (Table Tents, Flyers, Stickers)
 * meant for customers who do NOT have the Rabbitty App yet.
 * Uses ECC=H (30% error recovery) + radial CSS mask cutout + official /icon_ra.png emblem.
 */
export function SimpleQRCode({
  value,
  size = 180,
  className = '',
  color = '000000',
  bgColor = '#FFFFFF',
}: {
  value: string;
  size?: number;
  className?: string;
  color?: string;
  bgColor?: string;
}) {
  const encoded = encodeURIComponent(value);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&format=svg&ecc=H&qzone=1&color=${color.replace('#', '')}&bgcolor=${bgColor.replace('#', '')}&margin=1`;

  // Masked quiet-zone radius (~21% of QR width => ~3.4% of total area, well within 30% ecc=H budget)
  const cutoutDiameter = Math.round(Math.max(28, size * 0.21));
  const cutoutRadius = Math.round(cutoutDiameter / 2);
  const logoSize = Math.round(cutoutDiameter * 0.82);
  const radialMask = `radial-gradient(circle at center, transparent ${cutoutRadius}px, black ${cutoutRadius + 0.75}px)`;

  return (
    <div
      className={`relative flex items-center justify-center p-2 rounded-2xl shadow-xl ${className}`}
      style={{ width: size + 16, height: size + 16, backgroundColor: bgColor }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={qrUrl}
        alt="QR Code"
        width={size}
        height={size}
        className="w-full h-full object-contain"
        style={{
          maskImage: radialMask,
          WebkitMaskImage: radialMask,
        }}
        loading="lazy"
      />
      {/* Center Masked Quiet-Zone + Official /icon_ra.png Emblem */}
      <div
        className="absolute inset-0 m-auto rounded-full flex items-center justify-center pointer-events-none select-none"
        style={{
          width: cutoutDiameter,
          height: cutoutDiameter,
          backgroundColor: bgColor,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon_ra.png"
          alt="Ra"
          width={logoSize}
          height={logoSize}
          className="object-contain"
          style={{ width: logoSize, height: logoSize }}
        />
      </div>
    </div>
  );
}

/**
 * Proprietary Rabbitty Neon Code (RabbittyCode)
 * Used for internal ecosystem authentication (Affiliates & God Admin who scan with the Rabbitty App).
 * Renders the concentric wave rings, 4 corner holographic targets, and 13 dynamic soundwave bars.
 */
export function NeonQRCode({
  value,
  size = 200,
  showCardFrame = false,
  className = '',
}: {
  value: string;
  size?: number;
  showCardFrame?: boolean;
  className?: string;
}) {
  // ── Barras machine-readable: el escáner de la App decodifica este patrón ──
  const waveBars = useMemo(() => barsFromCode(code6FromData(String(value ?? ''))), [value]);

  const ringConfigs = useMemo(() => {
    return [
      { r: 24, dash: '6 4', speed: 8 },
      { r: 36, dash: '12 6', speed: 12 },
      { r: 48, dash: '8 8', speed: 10 },
      { r: 60, dash: '16 4 4 4', speed: 15 },
      { r: 72, dash: '10 5', speed: 9 },
      { r: 84, dash: '20 8', speed: 14 },
    ];
  }, []);

  return (
    <div
      className={`relative inline-flex flex-col items-center justify-center ${className}`}
      style={{ width: size, height: showCardFrame ? size * 1.45 : size }}
    >
      {showCardFrame && (
        <div className="absolute -top-9 z-30 pointer-events-none drop-shadow-[0_0_16px_rgba(244,63,94,0.9)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo_conejo.png"
            alt="Rabbitty Neon Crown"
            className="w-16 h-16 object-contain drop-shadow-[0_0_10px_#F43F5E]"
          />
        </div>
      )}

      {/* Main Glass Card Frame */}
      <div
        className={`relative w-full h-full overflow-hidden flex items-center justify-center p-5 transition-all duration-300 ${
          showCardFrame
            ? 'rounded-4xl bg-linear-to-b from-[#19092B]/95 via-[#110520]/95 to-[#07020D]/98 border-2 border-pink-500/40 shadow-[0_0_60px_rgba(233,30,99,0.3)] backdrop-blur-2xl'
            : 'bg-[#0B0416] border border-pink-500/30 rounded-4xl shadow-[0_0_40px_rgba(233,30,99,0.22)]'
        }`}
      >
        {/* Glowing Background Radial Aura */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(244,63,94,0.2)_0%,rgba(147,51,234,0.1)_50%,transparent_75%)] pointer-events-none" />

        {/* 1. Concentric Wave Code Matrix (Anillos de Código Propietario) */}
        <svg
          width={size * 0.95}
          height={size * 0.95}
          viewBox="0 0 200 200"
          fill="none"
          className="absolute inset-0 m-auto pointer-events-none"
        >
          {ringConfigs.map((cfg, idx) => (
            <circle
              key={idx}
              cx="100"
              cy="100"
              r={cfg.r}
              stroke={idx % 2 === 0 ? '#F43F5E' : '#8B5CF6'}
              strokeWidth={idx % 2 === 0 ? '1.8' : '1.2'}
              strokeDasharray={cfg.dash}
              strokeLinecap="round"
              className="opacity-70"
            />
          ))}
        </svg>

        {/* 2. Four Corner Holographic Position Ring Targets */}
        <div className="absolute inset-5 pointer-events-none flex flex-col justify-between p-1 z-10">
          <div className="flex justify-between">
            {/* Top Left Target */}
            <div className="w-9 h-9 border-2 border-pink-500 rounded-2xl p-1 flex items-center justify-center bg-[#130624]/90 shadow-[0_0_18px_rgba(244,63,94,0.7)]">
              <div className="w-full h-full border border-purple-400 rounded-xl flex items-center justify-center">
                <div className="w-3 h-3 bg-linear-to-br from-pink-500 to-purple-600 rounded-md" />
              </div>
            </div>
            {/* Top Right Target */}
            <div className="w-9 h-9 border-2 border-pink-500 rounded-2xl p-1 flex items-center justify-center bg-[#130624]/90 shadow-[0_0_18px_rgba(244,63,94,0.7)]">
              <div className="w-full h-full border border-purple-400 rounded-xl flex items-center justify-center">
                <div className="w-3 h-3 bg-linear-to-br from-pink-500 to-purple-600 rounded-md" />
              </div>
            </div>
          </div>
          <div className="flex justify-between items-end">
            {/* Bottom Left Target */}
            <div className="w-9 h-9 border-2 border-pink-500 rounded-2xl p-1 flex items-center justify-center bg-[#130624]/90 shadow-[0_0_18px_rgba(244,63,94,0.7)]">
              <div className="w-full h-full border border-purple-400 rounded-xl flex items-center justify-center">
                <div className="w-3 h-3 bg-linear-to-br from-pink-500 to-purple-600 rounded-md" />
              </div>
            </div>
            {/* Bottom Right Key Indicator Target */}
            <div className="w-6 h-6 border-2 border-purple-400 rounded-xl p-0.5 flex items-center justify-center bg-[#130624]/90 shadow-[0_0_12px_rgba(168,85,247,0.6)]">
              <div className="w-full h-full bg-purple-400 rounded-xs" />
            </div>
          </div>
        </div>

        {/* 3. Center Soundwave Code Box (Núcleo de Onda Propietario) */}
        <div className="relative z-20 flex items-center justify-center gap-1 px-5 py-3.5 bg-[#090214]/95 backdrop-blur-xl border border-pink-500/50 rounded-2xl shadow-[0_0_30px_rgba(233,30,99,0.4)]">
          {/* Vertical Center Division Axis */}
          <div className="absolute top-2 bottom-2 left-1/2 -translate-x-1/2 w-[1.5px] bg-linear-to-b from-transparent via-pink-400 to-transparent opacity-50" />

          {waveBars.map((h, i) => (
            <div
              key={i}
              className="w-[7px] rounded-full transition-all duration-300 bg-linear-to-t from-purple-600 via-pink-500 to-cyan-300 drop-shadow-[0_0_8px_rgba(244,63,94,0.8)]"
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

*(203 líneas)*


## 📄 `telegram-miniapp/src/components/QRDiscovery.tsx`

**QRDiscovery (miniapp) — neón → revelación QR con logo (fuente única de presentación)**

```typescript
'use client';

/**
 * ── QRDiscovery ── Fuente única de presentación de QR funcional con identidad.
 * - El QR se genera desde el PRIMER render (la animación nunca bloquea payload)
 * - Coreografía: neón (identidad) 0–700ms → revelación del QR con logo central
 * - revealMode="discovery": coreografía 1a vez por surfaceKey; luego QR inmediato
 * - Respeta prefers-reduced-motion · Estado de recuperación si el payload falla
 * - PURE presentational: la pantalla dueña gestiona sesión/auth/operación.
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import RabbittyCode from '@/components/ui/RabbittyCode';

export type QRDiscoveryVariant = 'admin' | 'affiliate' | 'rabbitter';

interface QRDiscoveryProps {
  value: string;
  variant: QRDiscoveryVariant;
  size?: number;
  revealMode?: 'discovery' | 'immediate';
  surfaceKey?: string;
  logoSrc?: string;
  className?: string;
}

const LOGOS: Record<QRDiscoveryVariant, string> = {
  admin: '/icon_ra.png',
  affiliate: '/icon_ra.png',
  rabbitter: '/Rabbitty_vector.png',
};

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function QRDiscovery({
  value,
  variant,
  size = 230,
  revealMode = 'discovery',
  surfaceKey,
  logoSrc,
  className = '',
}: QRDiscoveryProps) {
  const LOGO = logoSrc || LOGOS[variant] || '/icon_ra.png';
  const storageKey = surfaceKey ? `rabbitty_qrdiscovery_${surfaceKey}` : null;
  const [showingNeon, setShowingNeon] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    let skip = revealMode !== 'discovery';
    if (!skip && storageKey) {
      try {
        if (localStorage.getItem(storageKey) === 'seen') skip = true;
      } catch {}
    }
    if (!skip && prefersReducedMotion()) skip = true;
    if (skip) {
      setRevealed(true);
      return;
    }
    setShowingNeon(true);
    const t = setTimeout(() => {
      setShowingNeon(false);
      setRevealed(true);
      if (storageKey) {
        try { localStorage.setItem(storageKey, 'seen'); } catch {}
      }
    }, 700);
    return () => clearTimeout(t);
  }, [revealMode, storageKey, value]);

  const invalid = !value || !value.trim();
  const qrSize = Math.max(120, Math.round(size * 0.82));

  return (
    <div className={`relative flex flex-col items-center ${className}`} style={{ width: size }}>
      <AnimatePresence mode="wait">
        {showingNeon ? (
          <motion.div
            key="neon"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.04, filter: 'blur(6px)' }}
            transition={{ duration: 0.28 }}
            className="flex flex-col items-center"
          >
            <RabbittyCode data={value} size={size} showCardFrame={false} />
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
              className="mt-2 text-[10px] font-mono text-[#E91E63] uppercase tracking-widest"
            >
              Rabbitty Code…
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="qr"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            className="flex flex-col items-center"
          >
            {invalid ? (
              <div
                className="flex items-center justify-center rounded-2xl bg-black/5 text-center px-4"
                style={{ width: qrSize, height: qrSize }}
              >
                <span className="text-xs text-neutral-500 font-bold">Código no disponible.<br />Actualiza la pantalla.</span>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
                <QRCodeSVG
                  value={value}
                  size={qrSize}
                  level="H"
                  includeMargin={false}
                  imageSettings={{
                    src: LOGO,
                    x: undefined,
                    y: undefined,
                    height: Math.round(qrSize * 0.2),
                    width: Math.round(qrSize * 0.2),
                    excavate: true,
                  }}
                />
              </div>
            )}
            {revealMode === 'discovery' && revealed && storageKey && (
              <button
                type="button"
                onClick={() => { setShowingNeon(true); setRevealed(false); }}
                className="mt-2 text-[10px] font-bold text-[#E91E63]/70 hover:text-[#E91E63] cursor-pointer"
              >
                ⟲ ver Rabbitty Code
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

```

*(147 líneas)*


## 📄 `apps/admin/src/components/QRDiscovery.tsx`

**QRDiscovery (admin) — copia idéntica**

```typescript
'use client';

/**
 * ── QRDiscovery ── Fuente única de presentación de QR funcional con identidad.
 * - El QR se genera desde el PRIMER render (la animación nunca bloquea payload)
 * - Coreografía: neón (identidad) 0–700ms → revelación del QR con logo central
 * - revealMode="discovery": coreografía 1a vez por surfaceKey; luego QR inmediato
 * - Respeta prefers-reduced-motion · Estado de recuperación si el payload falla
 * - PURE presentational: la pantalla dueña gestiona sesión/auth/operación.
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import RabbittyCode from '@/components/ui/RabbittyCode';

export type QRDiscoveryVariant = 'admin' | 'affiliate' | 'rabbitter';

interface QRDiscoveryProps {
  value: string;
  variant: QRDiscoveryVariant;
  size?: number;
  revealMode?: 'discovery' | 'immediate';
  surfaceKey?: string;
  logoSrc?: string;
  className?: string;
}

const LOGOS: Record<QRDiscoveryVariant, string> = {
  admin: '/icon_ra.png',
  affiliate: '/icon_ra.png',
  rabbitter: '/Rabbitty_vector.png',
};

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function QRDiscovery({
  value,
  variant,
  size = 230,
  revealMode = 'discovery',
  surfaceKey,
  logoSrc,
  className = '',
}: QRDiscoveryProps) {
  const LOGO = logoSrc || LOGOS[variant] || '/icon_ra.png';
  const storageKey = surfaceKey ? `rabbitty_qrdiscovery_${surfaceKey}` : null;
  const [showingNeon, setShowingNeon] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    let skip = revealMode !== 'discovery';
    if (!skip && storageKey) {
      try {
        if (localStorage.getItem(storageKey) === 'seen') skip = true;
      } catch {}
    }
    if (!skip && prefersReducedMotion()) skip = true;
    if (skip) {
      setRevealed(true);
      return;
    }
    setShowingNeon(true);
    const t = setTimeout(() => {
      setShowingNeon(false);
      setRevealed(true);
      if (storageKey) {
        try { localStorage.setItem(storageKey, 'seen'); } catch {}
      }
    }, 700);
    return () => clearTimeout(t);
  }, [revealMode, storageKey, value]);

  const invalid = !value || !value.trim();
  const qrSize = Math.max(120, Math.round(size * 0.82));

  return (
    <div className={`relative flex flex-col items-center ${className}`} style={{ width: size }}>
      <AnimatePresence mode="wait">
        {showingNeon ? (
          <motion.div
            key="neon"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.04, filter: 'blur(6px)' }}
            transition={{ duration: 0.28 }}
            className="flex flex-col items-center"
          >
            <RabbittyCode data={value} size={size} showCardFrame={false} />
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
              className="mt-2 text-[10px] font-mono text-[#E91E63] uppercase tracking-widest"
            >
              Rabbitty Code…
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="qr"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            className="flex flex-col items-center"
          >
            {invalid ? (
              <div
                className="flex items-center justify-center rounded-2xl bg-black/5 text-center px-4"
                style={{ width: qrSize, height: qrSize }}
              >
                <span className="text-xs text-neutral-500 font-bold">Código no disponible.<br />Actualiza la pantalla.</span>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
                <QRCodeSVG
                  value={value}
                  size={qrSize}
                  level="H"
                  includeMargin={false}
                  imageSettings={{
                    src: LOGO,
                    x: undefined,
                    y: undefined,
                    height: Math.round(qrSize * 0.2),
                    width: Math.round(qrSize * 0.2),
                    excavate: true,
                  }}
                />
              </div>
            )}
            {revealMode === 'discovery' && revealed && storageKey && (
              <button
                type="button"
                onClick={() => { setShowingNeon(true); setRevealed(false); }}
                className="mt-2 text-[10px] font-bold text-[#E91E63]/70 hover:text-[#E91E63] cursor-pointer"
              >
                ⟲ ver Rabbitty Code
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

```

*(147 líneas)*


## 📄 `landing-page/src/components/QRDiscovery.tsx`

**QRDiscovery (landing) — con NeonQRCode como fase neón**

```typescript
'use client';

/**
 * ── QRDiscovery ── Fuente única de presentación de QR funcional con identidad.
 * - El QR se genera desde el PRIMER render (la animación nunca bloquea payload)
 * - Coreografía: neón (identidad) 0–700ms → revelación del QR con logo central
 * - revealMode="discovery": coreografía 1a vez por surfaceKey; luego QR inmediato
 * - Respeta prefers-reduced-motion · Estado de recuperación si el payload falla
 * - PURE presentational: la pantalla dueña gestiona sesión/auth/operación.
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { NeonQRCode } from '@/components/SimpleQRCode';

export type QRDiscoveryVariant = 'admin' | 'affiliate' | 'rabbitter';

interface QRDiscoveryProps {
  value: string;
  variant: QRDiscoveryVariant;
  size?: number;
  revealMode?: 'discovery' | 'immediate';
  surfaceKey?: string;
  logoSrc?: string;
  className?: string;
}

const LOGOS: Record<QRDiscoveryVariant, string> = {
  admin: '/icon_ra.png',
  affiliate: '/icon_ra.png',
  rabbitter: '/Rabbitty_vector.png',
};

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function QRDiscovery({
  value,
  variant,
  size = 230,
  revealMode = 'discovery',
  surfaceKey,
  logoSrc,
  className = '',
}: QRDiscoveryProps) {
  const LOGO = logoSrc || LOGOS[variant] || '/icon_ra.png';
  const storageKey = surfaceKey ? `rabbitty_qrdiscovery_${surfaceKey}` : null;
  const [showingNeon, setShowingNeon] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    let skip = revealMode !== 'discovery';
    if (!skip && storageKey) {
      try {
        if (localStorage.getItem(storageKey) === 'seen') skip = true;
      } catch {}
    }
    if (!skip && prefersReducedMotion()) skip = true;
    if (skip) {
      setRevealed(true);
      return;
    }
    setShowingNeon(true);
    const t = setTimeout(() => {
      setShowingNeon(false);
      setRevealed(true);
      if (storageKey) {
        try { localStorage.setItem(storageKey, 'seen'); } catch {}
      }
    }, 700);
    return () => clearTimeout(t);
  }, [revealMode, storageKey, value]);

  const invalid = !value || !value.trim();
  const qrSize = Math.max(120, Math.round(size * 0.82));

  return (
    <div className={`relative flex flex-col items-center ${className}`} style={{ width: size }}>
      <AnimatePresence mode="wait">
        {showingNeon ? (
          <motion.div
            key="neon"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.04, filter: 'blur(6px)' }}
            transition={{ duration: 0.28 }}
            className="flex flex-col items-center"
          >
            <NeonQRCode value={value} size={size} />
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
              className="mt-2 text-[10px] font-mono text-[#E91E63] uppercase tracking-widest"
            >
              Rabbitty Code…
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="qr"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            className="flex flex-col items-center"
          >
            {invalid ? (
              <div
                className="flex items-center justify-center rounded-2xl bg-black/5 text-center px-4"
                style={{ width: qrSize, height: qrSize }}
              >
                <span className="text-xs text-neutral-500 font-bold">Código no disponible.<br />Actualiza la pantalla.</span>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
                <QRCodeSVG
                  value={value}
                  size={qrSize}
                  level="H"
                  includeMargin={false}
                  imageSettings={{
                    src: LOGO,
                    x: undefined,
                    y: undefined,
                    height: Math.round(qrSize * 0.2),
                    width: Math.round(qrSize * 0.2),
                    excavate: true,
                  }}
                />
              </div>
            )}
            {revealMode === 'discovery' && revealed && storageKey && (
              <button
                type="button"
                onClick={() => { setShowingNeon(true); setRevealed(false); }}
                className="mt-2 text-[10px] font-bold text-[#E91E63]/70 hover:text-[#E91E63] cursor-pointer"
              >
                ⟲ ver Rabbitty Code
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

```

*(147 líneas)*


## 📄 `telegram-miniapp/src/components/RabbittyLoader.tsx`

**RabbittyLoader (miniapp) — loader con RabbittyCode decodificándose**

```typescript
'use client';

/**
 * ── RabbittyLoader ── Verificación animada con identidad Rabbitty.
 * Con codeData: el hero es el RabbittyCode DECODIFICÁNDOSE (barras ondulando,
 * anillos girando — caja fuerte abriéndose). Sin codeData: bunny + anillos.
 */

import { motion } from 'framer-motion';
import RabbittyCode from '@/components/ui/RabbittyCode';

interface RabbittyLoaderProps {
  message?: string;
  compact?: boolean;
  codeData?: string; // si se pasa: hero = RabbittyCode decodificándose
}

const RINGS = [
  { r: 42, color: '#F43F5E', delay: 0 },
  { r: 58, color: '#8B5CF6', delay: 0.15 },
  { r: 74, color: '#F43F5E', delay: 0.3 },
];

export default function RabbittyLoader({ message = 'Verificando…', compact = false, codeData }: RabbittyLoaderProps) {
  const hero = codeData ? (
    <motion.div
      animate={{ scale: [1, 1.03, 1] }}
      transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
    >
      <RabbittyCode data={codeData} size={150} showCardFrame={false} state="decoding" />
    </motion.div>
  ) : (
    <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
      {RINGS.map((ring, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border-2"
          style={{
            width: ring.r * 2, height: ring.r * 2,
            borderColor: ring.color,
            borderStyle: 'dashed',
          }}
          animate={{ scale: [0.75, 1.1, 0.75], rotate: i % 2 === 0 ? [0, 90] : [90, 0], opacity: [0.6, 0.85, 0.6] }}
          transition={{ repeat: Infinity, duration: 1.6, delay: ring.delay, ease: 'easeInOut' }}
        />
      ))}
      <motion.div
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
        className="relative z-10 h-16 w-16 rounded-2xl bg-gradient-to-br from-[#19092B] to-[#07020D] border-2 border-pink-500/50 flex items-center justify-center shadow-[0_0_35px_rgba(244,63,94,0.5)] overflow-hidden"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/Rabbitty_vector.png" alt="" className="w-10 h-10 object-contain drop-shadow-[0_0_10px_#F43F5E]" />
      </motion.div>
    </div>
  );

  const inner = (
    <div className="flex flex-col items-center gap-3">
      {hero}
      {/* Onda de barras (mini RabbittyCode) */}
      <div className="flex items-center justify-center gap-[3px] h-4">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <motion.div
            key={i}
            className="w-[3px] rounded-full bg-linear-to-t from-purple-600 via-pink-500 to-cyan-300"
            animate={{ height: [6, 14, 6] }}
            transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.09, ease: 'easeInOut' }}
          />
        ))}
      </div>
      <motion.p
        animate={{ opacity: [0.55, 1, 0.55] }}
        transition={{ repeat: Infinity, duration: 1.4 }}
        className="text-[11px] font-black text-white uppercase tracking-[2px]"
      >
        {message}
      </motion.p>
    </div>
  );

  if (compact) return inner;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-9999 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md"
    >
      {inner}
    </motion.div>
  );
}

```

*(93 líneas)*


## 📄 `apps/admin/src/components/RabbittyLoader.tsx`

**RabbittyLoader (admin)**

```typescript
'use client';

/**
 * ── RabbittyLoader ── Verificación animada con identidad Rabbitty.
 * Bunny + anillos neón expandiéndose (ADN del RabbittyCode) + onda de barras.
 * Overlay unificado para TODOS los flujos de escaneo/verificación.
 */

import { motion } from 'framer-motion';

interface RabbittyLoaderProps {
  message?: string;      // "Verificando…" / "Autorizando…" / "Acreditando Bunz…"
  compact?: boolean;     // inline (no overlay)
}

const RINGS = [
  { r: 42, dash: '6 4',   color: '#F43F5E', delay: 0 },
  { r: 58, dash: '12 6',  color: '#8B5CF6', delay: 0.15 },
  { r: 74, dash: '8 8',   color: '#F43F5E', delay: 0.3 },
];

export default function RabbittyLoader({ message = 'Verificando…', compact = false }: RabbittyLoaderProps) {
  const inner = (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
        {/* Anillos neón expandiéndose (eco del RabbittyCode) */}
        {RINGS.map((ring, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border-2"
            style={{
              width: ring.r * 2, height: ring.r * 2,
              borderColor: ring.color,
              borderStyle: 'dashed',
              opacity: 0.7 - i * 0.15,
            }}
            animate={{ scale: [0.75, 1.1, 0.75], rotate: i % 2 === 0 ? [0, 90] : [90, 0], opacity: [0.6, 0.85, 0.6] }}
            transition={{ repeat: Infinity, duration: 1.6, delay: ring.delay, ease: 'easeInOut' }}
          />
        ))}
        {/* Bunny centro con glow */}
        <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
          className="relative z-10 h-16 w-16 rounded-2xl bg-gradient-to-br from-[#19092B] to-[#07020D] border-2 border-pink-500/50 flex items-center justify-center shadow-[0_0_35px_rgba(244,63,94,0.5)] overflow-hidden"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Rabbitty_vector.png" alt="" className="w-10 h-10 object-contain drop-shadow-[0_0_10px_#F43F5E]" />
        </motion.div>
      </div>

      {/* Onda de barras (mini RabbittyCode) */}
      <div className="flex items-center justify-center gap-[3px] h-4">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <motion.div
            key={i}
            className="w-[3px] rounded-full bg-linear-to-t from-purple-600 via-pink-500 to-cyan-300"
            animate={{ height: [6, 14, 6] }}
            transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.09, ease: 'easeInOut' }}
          />
        ))}
      </div>

      <motion.p
        animate={{ opacity: [0.55, 1, 0.55] }}
        transition={{ repeat: Infinity, duration: 1.4 }}
        className="text-[11px] font-black text-white uppercase tracking-[2px]"
      >
        {message}
      </motion.p>
    </div>
  );

  if (compact) return inner;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-9999 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md"
    >
      {inner}
    </motion.div>
  );
}
```

*(85 líneas)*


## 📄 `landing-page/src/components/RabbittyLoader.tsx`

**RabbittyLoader (landing) — con NeonQRCode**

```typescript
'use client';

/**
 * ── RabbittyLoader ── Verificación animada con identidad Rabbitty.
 * Bunny + anillos neón expandiéndose (ADN del RabbittyCode) + onda de barras.
 * Overlay unificado para TODOS los flujos de escaneo/verificación.
 */

import { motion } from 'framer-motion';
import { NeonQRCode } from '@/components/SimpleQRCode';

interface RabbittyLoaderProps {
  message?: string;      // "Verificando…" / "Autorizando…" / "Acreditando Bunz…"
  compact?: boolean;     // inline (no overlay)
  codeData?: string;     // código de la sesión: el neón se muestra decodificándose
}

const RINGS = [
  { r: 42, dash: '6 4',   color: '#F43F5E', delay: 0 },
  { r: 58, dash: '12 6',  color: '#8B5CF6', delay: 0.15 },
  { r: 74, dash: '8 8',   color: '#F43F5E', delay: 0.3 },
];

export default function RabbittyLoader({ message = 'Verificando…', compact = false, codeData }: RabbittyLoaderProps) {
  const inner = (
    <div className="flex flex-col items-center gap-3">
      {codeData && (
        <motion.div
          animate={{ scale: [1, 1.03, 1], opacity: [0.85, 1, 0.85] }}
          transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
        >
          <NeonQRCode value={codeData} size={150} />
        </motion.div>
      )}
      <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
        {/* Anillos neón expandiéndose (eco del RabbittyCode) */}
        {RINGS.map((ring, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border-2"
            style={{
              width: ring.r * 2, height: ring.r * 2,
              borderColor: ring.color,
              borderStyle: 'dashed',
              opacity: 0.7 - i * 0.15,
            }}
            animate={{ scale: [0.75, 1.1, 0.75], rotate: i % 2 === 0 ? [0, 90] : [90, 0], opacity: [0.6, 0.85, 0.6] }}
            transition={{ repeat: Infinity, duration: 1.6, delay: ring.delay, ease: 'easeInOut' }}
          />
        ))}
        {/* Bunny centro con glow */}
        <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
          className="relative z-10 h-16 w-16 rounded-2xl bg-gradient-to-br from-[#19092B] to-[#07020D] border-2 border-pink-500/50 flex items-center justify-center shadow-[0_0_35px_rgba(244,63,94,0.5)] overflow-hidden"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Rabbitty_vector.png" alt="" className="w-10 h-10 object-contain drop-shadow-[0_0_10px_#F43F5E]" />
        </motion.div>
      </div>

      {/* Onda de barras (mini RabbittyCode) */}
      <div className="flex items-center justify-center gap-[3px] h-4">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <motion.div
            key={i}
            className="w-[3px] rounded-full bg-linear-to-t from-purple-600 via-pink-500 to-cyan-300"
            animate={{ height: [6, 14, 6] }}
            transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.09, ease: 'easeInOut' }}
          />
        ))}
      </div>

      <motion.p
        animate={{ opacity: [0.55, 1, 0.55] }}
        transition={{ repeat: Infinity, duration: 1.4 }}
        className="text-[11px] font-black text-white uppercase tracking-[2px]"
      >
        {message}
      </motion.p>
    </div>
  );

  if (compact) return inner;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-9999 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md"
    >
      {inner}
    </motion.div>
  );
}
```

*(95 líneas)*


## 📄 `telegram-miniapp/src/app/scan/page.tsx`

**ESCÁNER MINIAPP — Mi Código + cámara + decoder neón + todos los handlers**

```typescript
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Keyboard } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';
import RabbittyCode from '@/components/ui/RabbittyCode';
import QRDiscovery from '@/components/QRDiscovery';
import RabbittyLoader from '@/components/RabbittyLoader';
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
  
  const [myScanCode, setMyScanCode] = useState<string>('');
  useEffect(() => {
    if (!user) return;
    fetch('/api/rabbitty-code/mine', { headers: undefined })
      .then((r) => r.json())
      .then((d) => { if (d?.success && d.code) setMyScanCode(String(d.code)); })
      .catch(() => {});
  }, [user]);
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
  const [qrConfirm, setQrConfirm] = useState<{ qrToken: string; origin: string } | null>(null);
  const [scanLoader, setScanLoader] = useState<string | null>(null);
  const [scanLoaderCode, setScanLoaderCode] = useState<string | null>(null);
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
      // Confirmación EXPLÍCITA: el usuario ve a QUÉ pantalla está autorizando
      setScanLoader(null);
      setScanLoaderCode(null);
      setQrConfirm({ qrToken: urlQrLogin, origin: 'www.rabbitty.me/impresos' });
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


  const bindQrSession = async (qrToken: string, onDone?: () => void) => {
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch('/api/auth/qr/scan', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrToken }),
      });
      const data = await res.json();
      if (data.success) {
        PlatformBridge.hapticFeedback('success');
        alert('¡Acceso autorizado en tu pantalla! 🪄');
        setQrConfirm(null);
        router.push('/profile');
      } else {
        alert('Error de autorización QR: ' + (data.error || 'Token inválido o expirado'));
        setQrConfirm(null);
      }
    } catch {
      alert('Error de conexión al autorizar el acceso QR.');
      setQrConfirm(null);
    }
    onDone?.();
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
    setScanLoader('Leyendo tu código…');
    if (typeof rawPayload === 'string') setScanLoaderCode(rawPayload);

    const res = await resolveScannedPayload(rawPayload);
    if (!res.success) {
      setScanLoader(null);
      setScanLoaderCode(null);
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
          setScanLoader(null);
          router.push('/profile/wallet');
          return;
        } else {
          setScanLoader(null);
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
        // 6. QR Login (/impresos o PC) — CONFIRMACIÓN EXPLÍCITA antes de vincular
    if (res.type === 'qrlogin' && res.qrLogin) {
      await stopScanning();
      setQrConfirm({ qrToken: res.qrLogin.qrToken, origin: 'www.rabbitty.me' });
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
    let lastDecoded: number | null = null;
    let consecutiveAgree = 0;
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
            if (decoded !== null) {
              // ── Acuerdo multi-frame: 2 frames consecutivos con el mismo código ──
              if (lastDecoded === decoded) {
                consecutiveAgree += 1;
              } else {
                consecutiveAgree = 0;
              }
              lastDecoded = decoded;
              if (consecutiveAgree < 1) {
                isSubmittingOptical = false;
                return; // esperar confirmación del siguiente frame
              }
              consecutiveAgree = 0;
            }
          }

          if (decoded !== null) {
            setScanLoaderCode(`rc:${decoded}`);
            setScanLoader('Decodificando tu Rabbitty Code…');
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

  // ── Loader: verificación animada Rabbitty tras escaneo ──
  if (scanLoader) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-black">
        <RabbittyLoader message={scanLoader} codeData={scanLoaderCode ?? undefined} />
      </div>
    );
  }

  // ── Modal: ¿Autorizar el acceso? (qrlogin gate) ──
  if (qrConfirm) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-black px-6 relative overflow-hidden">
        <div className="absolute top-[-15%] w-64 h-64 rounded-full bg-[#E91E63]/20 blur-[80px] pointer-events-none" />
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative z-10 w-full max-w-sm rounded-[2rem] border border-white/10 bg-[#12121B] p-7 text-center"
        >
          <div className="w-16 h-16 mx-auto rounded-2xl bg-[#E91E63]/15 border border-[#E91E63]/30 flex items-center justify-center text-3xl">
            🔐
          </div>
          <h2 className="mt-4 text-lg font-black text-white">¿Autorizar el acceso?</h2>
          <p className="mt-2 text-xs text-neutral-400 leading-relaxed">
            Se dará acceso a <strong className="text-white">{qrConfirm.origin}</strong> en la pantalla donde se mostró el código.<br />
            <span className="text-neutral-500">Sesión: {qrConfirm.qrToken.slice(0, 8)}… · un solo uso · expira pronto</span>
          </p>
          <button
            onClick={async () => { await bindQrSession(qrConfirm.qrToken); }}
            className="mt-6 w-full py-3.5 rounded-2xl bg-[#E91E63] text-white font-black text-sm active:scale-95 transition-transform cursor-pointer"
          >
            Autorizar acceso
          </button>
          <button
            onClick={() => setQrConfirm(null)}
            className="mt-2 w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-neutral-400 font-bold text-xs cursor-pointer"
          >
            Cancelar
          </button>
        </motion.div>
      </div>
    );
  }

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
              <QRDiscovery
                value={myScanCode ? `rabbitty://pay?to=${encodeURIComponent(user?.username ? `@${user.username}` : String(qrValue || ''))}` : String(qrValue || 'rabbitty_guest')}
                variant="rabbitter"
                size={210}
                revealMode="discovery"
                surfaceKey="my-code"
              />
              <div className="mt-5 text-center">
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

                        // ── Código numérico de 6 dígitos (RabbittyCode manual) ──
                        if (/^\d{6}$/.test(trimmed)) {
                          try {
                            const res = await fetch('/api/rabbitty-code/lookup', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ code: Number(trimmed) }),
                            });
                            const data = await res.json();
                            if (data?.success) {
                              if (data.type === 'qrlogin' && data.qrToken) {
                                setManualCode('');
                                setQrConfirm({ qrToken: data.qrToken, origin: 'www.rabbitty.me/impresos' });
                                return;
                              } else if (data.type === 'user' && data.user) {
                                setManualCode('');
                                router.push(`/profile/wallet?to=${encodeURIComponent(data.user.handle || data.user.id)}`);
                                return;
                              } else if (data.type === 'business' && data.businessId) {
                                setManualCode('');
                                router.push(`/affiliate/${data.businessId}`);
                                return;
                              }
                            }
                            alert(data?.error || 'Código no reconocido. Verifica con la pantalla.');
                            return;
                          } catch {
                            alert('Error de red al resolver el código');
                            return;
                          }
                        }

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

*(879 líneas)*


## 📄 `telegram-miniapp/src/features/transactions/QRScanner.tsx`

**QRScanner (modal del afiliado emparejado) — html5-qrcode + decoder neón**

```typescript
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
    let lastDecoded: number | null = null;
    let consecutiveAgree = 0;
    let isDecoding = false;
    let stopped = false;
    const HI = 520;
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
          if (decoded !== null) {
            if (lastDecoded === decoded) {
              consecutiveAgree += 1;
            } else {
              consecutiveAgree = 0;
            }
            lastDecoded = decoded;
            if (consecutiveAgree < 1) {
              isDecoding = false;
              return;
            }
            consecutiveAgree = 0;
          }
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

*(177 líneas)*


## 📄 `telegram-miniapp/src/app/business/scan/page.tsx`

**BUSINESS SCAN — escáner del comercio (otorgar Bunz al cliente)**

```typescript
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

*(195 líneas)*


## 📄 `telegram-miniapp/src/app/api/rabbitty-code/lookup/route.ts`

**LOOKUP — resolución de códigos (numérico O(1) por scan_code, texto universal)**

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

      // 2.2 Resolución O(1): código asignado por el servidor (sin colisiones, sin iteración)
      const [bizMatch] = await db
        .select({ id: ownedBusinesses.id, name: ownedBusinesses.name })
        .from(ownedBusinesses)
        .where(eq(ownedBusinesses.scanCode, code))
        .limit(1);
      if (bizMatch) {
        return NextResponse.json({ success: true, type: "business", businessId: bizMatch.id, name: bizMatch.name });
      }

      const [userMatch] = await db
        .select({
          id: users.id,
          username: users.username,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(users)
        .where(eq(users.scanCode, code))
        .limit(1);
      if (userMatch) {
        const handle = userMatch.username ? `@${userMatch.username}` : userMatch.id;
        const fullName = [userMatch.firstName, userMatch.lastName].filter(Boolean).join(" ") || userMatch.username || "Rabbitter";
        return NextResponse.json({
          success: true,
          type: "user",
          user: { id: userMatch.id, username: userMatch.username, name: fullName, handle },
        });
      }

      return NextResponse.json({ success: false, error: "Código no reconocido" }, { status: 404 });
    }
  } catch (err) {
    console.error("[RABBITTY_CODE_LOOKUP]", err);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}

```

*(287 líneas)*


## 📄 `telegram-miniapp/src/app/api/rabbitty-code/mine/route.ts`

**MINE — código óptico asignado del usuario autenticado**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/serverAuth";

export const runtime = "nodejs";

function degenerate(code: number): boolean {
  const d: number[] = [];
  for (let i = 11; i >= 0; i--) d.push(Math.floor(code / Math.pow(3, i)) % 3);
  return new Set(d).size < 2; // todas las barras al mismo nivel = ilegible
}

/** GET /api/rabbitty-code/mine — código óptico asignado del usuario (asigna si falta). */
export async function GET(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

    const [me] = await db.select({ scanCode: users.scanCode }).from(users).where(eq(users.id, caller.id)).limit(1);
    if (me?.scanCode) {
      return NextResponse.json({ success: true, code: me.scanCode });
    }

    const used = new Set(
      (await db.select({ c: users.scanCode }).from(users)).map((r) => r.c).filter(Boolean) as number[]
    );
    let code = 100000 + Math.floor(Math.random() * 431441);
    for (let tries = 0; tries < 50 && (used.has(code) || degenerate(code)); tries++) {
      code = 100000 + Math.floor(Math.random() * 431441);
    }
    await db.update(users).set({ scanCode: code }).where(eq(users.id, caller.id));
    return NextResponse.json({ success: true, code });
  } catch (err) {
    console.error("[RABBITTY_CODE_MINE]", err);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}

```

*(39 líneas)*


## 📄 `landing-page/src/app/impresos/page.tsx`

**GATE /IMPRESOS — QRDiscovery + políticas HERO/REWARD/EVERGREEN + temp codes**

```typescript
'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  Printer, Sparkles, Smartphone, ArrowRight, CheckCircle2, ShieldCheck, 
  Search, ChevronDown, Check, Building2,
  SlidersHorizontal, Image as ImageIcon,
  Lock, QrCode, X, KeyRound, RefreshCw, LogOut
} from 'lucide-react';
import { SimpleQRCode, NeonQRCode } from '@/components/SimpleQRCode';
import QRDiscovery from '@/components/QRDiscovery';
import RabbittyLoader from '@/components/RabbittyLoader';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

interface BusinessItem {
  id: string;
  name: string;
  category: string;
  rewardPercentage: number;
  address: string;
  refCode: string;
  logoUrl?: string | null;
  welcomeBunz?: number;
}

// Plantillas de contenido curadas y protegidas por nicho de mercado
export interface NicheTemplate {
  key: string;
  label: string;
  icon: string;
  categoryHint: string;
  // A3 Cartel
  posterTag: string;
  posterHeadlinePrefix: string;
  posterHeadlineHighlight: string;
  posterDescription: string;
  // A5 Habladores Mesa
  tableWaitingCallout: string;
  tableHeadline: string;
  tableStep1: string;
  tableStep3: string;
  tableFooterHint: string;
  // A6 Señal Caja
  cashierTag: string;
  cashierCallout: string;
  // A4 Guía de Operación
  guideStaffTitle: string;
  guideScriptGreeting: string;
  guideScriptExplain: string;
}

const NICHE_TEMPLATES: Record<string, NicheTemplate> = {
  coffee: {
    key: 'coffee',
    label: 'Cafetería / Café de Especialidad',
    icon: '☕',
    categoryHint: 'Café & Bebidas',
    posterTag: 'Punto de Café Oficial',
    posterHeadlinePrefix: 'TU CAFÉ HOY.',
    posterHeadlineHighlight: 'TUS BENEFICIOS SIEMPRE.',
    posterDescription: 'Escanea el código, activa tu app de Rabbitty y recibe de inmediato tu bienvenida para disfrutar aquí con nosotros.',
    tableWaitingCallout: 'Mientras esperas tu café',
    tableHeadline: '¿YA TIENES TU BONO?',
    tableStep1: 'Pagas tu café habitual y recibes Bunz digitales directo en tu wallet.',
    tableStep3: 'Úsalos como saldo real en este café y comercios de la red local.',
    tableFooterHint: 'Pregunta a nuestro barista por la recomendación del día.',
    cashierTag: 'Al pagar tu café',
    cashierCallout: 'Escanea antes de pagar y recibe tus Bunz de bienvenida.',
    guideStaffTitle: 'Guion para el Barista / Cajero',
    guideScriptGreeting: '“¿Ya tienes Rabbitty? Lo estrenamos hoy aquí. Escanea este código en el mostrador para registrarte y llevarte tu saldo de bienvenida al instante”.',
    guideScriptExplain: '“Es una app de fidelidad digital. Cada visita acumulas Bunz que puedes canjear directamente aquí como dinero en tus próximos consumos”.'
  },
  seafood: {
    key: 'seafood',
    label: 'Mariscos / Restaurante de Mar',
    icon: '🦞',
    categoryHint: 'Marisquería & Pescados',
    posterTag: 'Sabor de Mar Oficial',
    posterHeadlinePrefix: 'EL MEJOR SABOR DEL MAR.',
    posterHeadlineHighlight: 'RECOMPENSAS EN CADA VISITA.',
    posterDescription: 'El fresco sabor del océano ahora te recompensa. Escanea el código con tu celular y desbloquea saldo de bienvenida hoy mismo.',
    tableWaitingCallout: 'Mientras preparan tu mesa',
    tableHeadline: '¿LISTO PARA DISFRUTAR?',
    tableStep1: 'Disfruta tus platillos favoritos y acumula Bunz digitales en tu cuenta.',
    tableStep3: 'Canjea tu saldo en ceviches, mariscos y tus bebidas preferidas.',
    tableFooterHint: 'Pregunta a tu mesero por el platillo estrella de la casa.',
    cashierTag: 'Al pedir tu cuenta',
    cashierCallout: 'Escanea antes de liquidar tu mesa y recibe tu bono de bienvenida.',
    guideStaffTitle: 'Guion para Mesero / Capitán de Meseros',
    guideScriptGreeting: '“Buenas tardes. En lo que preparamos sus platillos, los invito a escanear este código para activar su cuenta y recibir su saldo de bienvenida de hoy”.',
    guideScriptExplain: '“Con Rabbitty acumulan un porcentaje de su consumo en Bunz para descontar directo en su próxima visita o en negocios aliados”.'
  },
  restaurant: {
    key: 'restaurant',
    label: 'Restaurante / Comida Gourmet',
    icon: '🍽️',
    categoryHint: 'Restaurante & Gastronomía',
    posterTag: 'Experiencia Gastronómica',
    posterHeadlinePrefix: 'BUEN PROVECHO HOY.',
    posterHeadlineHighlight: 'PREMIAMOS TU LEALTAD.',
    posterDescription: 'Cada comida sabe mejor cuando te recompensa. Escanea el código de mesa o mostrador y recibe Bunz directos a tu app.',
    tableWaitingCallout: 'Mientras llega tu platillo',
    tableHeadline: 'PREMIAMOS CADA VISITA',
    tableStep1: 'Ordena a tu gusto y acumula Bunz automáticos en cada consumo.',
    tableStep3: 'Descuenta tu saldo en tus próximas comidas y cenas con amigos.',
    tableFooterHint: 'Válido todos los días en consumo en comedor y terraza.',
    cashierTag: 'Al solicitar tu cuenta',
    cashierCallout: 'Escanea antes de pagar y comienza a acumular en cada visita.',
    guideStaffTitle: 'Guion para Mesero / Hostess',
    guideScriptGreeting: '“Bienvenidos. Les dejamos el menú y este código para que obtengan su bono de bienvenida antes de ordenar sus alimentos”.',
    guideScriptExplain: '“Es nuestro nuevo programa de recompensas digitales: acumulas saldo en cada cuenta para usar en tu próxima visita”.'
  },
  fashion: {
    key: 'fashion',
    label: 'Ropa / Boutique de Moda',
    icon: '✨',
    categoryHint: 'Moda & Accesorios',
    posterTag: 'Boutique Oficial',
    posterHeadlinePrefix: 'TU ESTILO TIENE PREMIO.',
    posterHeadlineHighlight: 'ACUMULA BUNZ EN TUS COMPRAS.',
    posterDescription: 'Estrena tus prendas favoritas y recibe recompensas reales en dinero digital. Escanea el código antes de pasar a caja.',
    tableWaitingCallout: 'Al probarte tus prendas',
    tableHeadline: 'LLEVA TU ESTILO CON BONO',
    tableStep1: 'Elige tu look de hoy y acumula Bunz en cada compra que realices.',
    tableStep3: 'Canjea tu saldo en tus próximas prendas y accesorios de temporada.',
    tableFooterHint: 'Aceptamos Bunz como saldo directo en toda la colección.',
    cashierTag: 'En mostrador de caja',
    cashierCallout: 'Escanea el código antes de cobrarte y recibe tu bienvenida.',
    guideStaffTitle: 'Guion para Asesor de Ventas / Caja',
    guideScriptGreeting: '“¡Hola! Antes de pagar tus prendas, escanea este código en caja para darte tu bono de bienvenida en tu primera compra con nosotros”.',
    guideScriptExplain: '“Con Rabbitty acumulas un porcentaje de tu compra en saldo digital para tus siguientes compras de temporada”.'
  },
  barber: {
    key: 'barber',
    label: 'Barbería / Salón de Belleza',
    icon: '💈',
    categoryHint: 'Cuidado Personal & Estilo',
    posterTag: 'Punto de Cuidado Personal',
    posterHeadlinePrefix: 'CORTE FRESCO HOY.',
    posterHeadlineHighlight: 'BENEFICIOS EN CADA SERVICIO.',
    posterDescription: 'Mantener tu imagen impecable ahora tiene premio. Escanea el código mientras te atienden y recibe tu bono al instante.',
    tableWaitingCallout: 'En la sala de espera o sillón',
    tableHeadline: 'TU CORTE CON RECOMPENSA',
    tableStep1: 'Disfruta tu corte o arreglo y acumula Bunz de forma automática.',
    tableStep3: 'Aplica tu saldo acumulado en cortes, afeitados o productos de cuidado.',
    tableFooterHint: 'Pregunta a tu barbero por los productos oficiales de la barbería.',
    cashierTag: 'Al pagar tu servicio',
    cashierCallout: 'Escanea antes de pagar y recibe tu saldo de bienvenida.',
    guideStaffTitle: 'Guion para Barbero / Estilista',
    guideScriptGreeting: '“Amigo, mientras te preparo el servicio, escanea este QR para darte de alta y regalarte saldo de bienvenida en tu cuenta de Rabbitty”.',
    guideScriptExplain: '“En cada corte vas acumulando Bunz para tener descuentos automáticos o servicios gratis en tus siguientes visitas”.'
  },
  bakery: {
    key: 'bakery',
    label: 'Panadería / Pastelería / Postres',
    icon: '🥐',
    categoryHint: 'Panadería & Repostería',
    posterTag: 'Horneado con Pasión',
    posterHeadlinePrefix: 'DULCES MOMENTOS.',
    posterHeadlineHighlight: 'BUNZ EN CADA ANTOJO.',
    posterDescription: 'El pan recién horneado y tus postres consentidos ahora te devuelven recompensas. Escanea y llévate tu bono de bienvenida.',
    tableWaitingCallout: 'Endulza tu día y ahorra',
    tableHeadline: '¿YA TIENES TU BONO?',
    tableStep1: 'Elige tu pan dulce o pastel y acumula Bunz digitales en tu cuenta.',
    tableStep3: 'Canjea tu saldo en tus próximos antojos y pedidos de cumpleaños.',
    tableFooterHint: 'Pan artesanal horneado todos los días desde temprano.',
    cashierTag: 'Al pagar tus postres',
    cashierCallout: 'Escanea en mostrador antes de pagar y recibe tu bono dulce.',
    guideStaffTitle: 'Guion para Encargado de Mostrador',
    guideScriptGreeting: '“¡Hola! Escanea este código en caja antes de registrar tu pan y te regalamos saldo de bienvenida para esta o tu próxima compra”.',
    guideScriptExplain: '“Cada vez que vengas por tu pan o pastel acumulas Bunz que se convierten en dinero real para pagar aquí”.'
  }
};

function detectNicheKey(categoryOrName?: string | null): string {
  if (!categoryOrName) return 'coffee';
  const text = categoryOrName.toLowerCase();

  // 1. Cafetería / Café de Especialidad (prioridad ante nombres con "Café", "Coffee", etc.)
  if (
    text.includes('café') ||
    text.includes('cafe') ||
    text.includes('coffee') ||
    text.includes('cafeter') ||
    text.includes('barista') ||
    text.includes('espresso') ||
    text.includes('cappuccino') ||
    text.includes('latte') ||
    text.includes('tostador')
  ) {
    return 'coffee';
  }

  // 2. Panadería / Pastelería / Repostería
  if (
    text.includes('pan') ||
    text.includes('panader') ||
    text.includes('pastel') ||
    text.includes('postre') ||
    text.includes('bakery') ||
    text.includes('dulc') ||
    text.includes('reposter') ||
    text.includes('croissant') ||
    text.includes('dona') ||
    text.includes('galleta')
  ) {
    return 'bakery';
  }

  // 3. Barbería / Salón de Belleza / Cuidado Personal
  if (
    text.includes('barber') ||
    text.includes('corte') ||
    text.includes('peluquer') ||
    text.includes('salon') ||
    text.includes('salón') ||
    text.includes('belleza') ||
    text.includes('spa') ||
    text.includes('estetica') ||
    text.includes('estética') ||
    text.includes('uñas') ||
    text.includes('nails')
  ) {
    return 'barber';
  }

  // 4. Mariscos / Pescados / Ceviches
  if (
    text.includes('marisco') ||
    text.includes('pescad') ||
    text.includes('cevich') ||
    text.includes('aguachile') ||
    text.includes('ostion') ||
    text.includes('camaron') ||
    text.includes('camarón') ||
    text.includes('mar')
  ) {
    return 'seafood';
  }

  // 5. Ropa / Boutique / Moda
  if (
    text.includes('ropa') ||
    text.includes('boutique') ||
    text.includes('moda') ||
    text.includes('vestid') ||
    text.includes('fashion') ||
    text.includes('calzad') ||
    text.includes('zapater') ||
    text.includes('sneaker') ||
    text.includes('accesorios')
  ) {
    return 'fashion';
  }

  // 6. Restaurante / Gastronomía General
  if (
    text.includes('rest') ||
    text.includes('comida') ||
    text.includes('gourmet') ||
    text.includes('taco') ||
    text.includes('taquer') ||
    text.includes('burger') ||
    text.includes('hamburguesa') ||
    text.includes('pizza') ||
    text.includes('pizzer') ||
    text.includes('sushi') ||
    text.includes('cocina') ||
    text.includes('bar') ||
    text.includes('cantina') ||
    text.includes('bistro') ||
    text.includes('alimento')
  ) {
    return 'restaurant';
  }

  return 'coffee';
}

const ADMIN_SECRET = 'rabbitty_admin_authorized_gtm_2026';
const AUTH_STORAGE_KEY = 'rabbitty_impresos_auth_v1';

function ImpresosContent() {
  const searchParams = useSearchParams();

  // Permite que CUALQUIER negocio genere su kit dinámicamente pasando ?name=...&bunz=...&ref=...&logo=...&niche=...
  const initialName = searchParams?.get('name') || '626 Café';
  const initialBunz = searchParams?.get('bunz') || '25';
  const initialRef = searchParams?.get('ref') || '626cafe';
  const initialLogo = searchParams?.get('logo') || '';
  const initialNicheParam = searchParams?.get('niche') || '';
  const initialUrl = searchParams?.get('url') || `https://rabbitty.me/download?ref=${initialRef}`;

  // Auth: Permitido para Admin y para Afiliados con token o refCode
  const [isAuthorized, setIsAuthorized] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const keyParam = searchParams?.get('admin_key') || searchParams?.get('auth');
    const refParam = searchParams?.get('ref');

    // 1. Clave secreta de Admin
    if (keyParam === ADMIN_SECRET) {
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, 'admin');
        window.history.replaceState({}, '', window.location.pathname + (refParam ? `?ref=${refParam}` : ''));
      } catch {}
      return true;
    }

    // 2. Revisar localStorage previo (admin / affiliate por QR / temp con expiry)
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored?.startsWith('temp:')) {
        const exp = Number(stored.split(':')[2] || 0);
        if (exp > Date.now()) return true;
        localStorage.removeItem(AUTH_STORAGE_KEY);
        return false;
      }
      return Boolean(stored);
    } catch {
      return false;
    }
  });

  const [authCodeInput, setAuthCodeInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [showQrModal, setShowQrModal] = useState(false);
  const [authMode, setAuthMode] = useState<'admin' | 'affiliate' | 'temp'>(() => {
    if (typeof window === 'undefined') return 'admin';
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY) || '';
      if (stored.startsWith('temp_')) {
        const exp = Number(stored.split(':')[2] || 0);
        if (exp > Date.now()) return 'temp';
      }
      return stored.startsWith('affiliate_') ? 'affiliate' : 'admin';
    } catch {
      return 'admin';
    }
  });
  const [tempAccessInfo, setTempAccessInfo] = useState<{ label: string; expiresAt: string } | null>(null);
  const [tempScopeBusinessId, setTempScopeBusinessId] = useState<string | null>(null);
  const [tempGenerated, setTempGenerated] = useState<{ code: string; url: string; expiresAt: string; scopeName?: string } | null>(null);
  const [tempLabel, setTempLabel] = useState('Impresor');
  const [showTempForm, setShowTempForm] = useState(false);
  const [tempScopePick, setTempScopePick] = useState<string>('ALL');
  const [authUserName, setAuthUserName] = useState<string>('');


  const [qrSessionId, setQrSessionId] = useState<string | null>(null);
  const [qrGateCode, setQrGateCode] = useState<string>('');
  const [showAuthLoader, setShowAuthLoader] = useState(false);
  const [qrSessionData, setQrSessionData] = useState<string>('');
  const [qrLoading, setQrLoading] = useState<boolean>(false);
  const [qrStatusMsg, setQrStatusMsg] = useState<string>('');

  // ── Acceso temporal via ?access=CODE (redeem server-side, 24h) ──
  useEffect(() => {
    const accessParam = searchParams?.get('access');
    if (!accessParam || !/^[A-Z0-9]{8}$/i.test(accessParam)) return;
    fetch('/api/auth/qr-impresos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'REDEEM_TEMP_CODE', code: accessParam.toUpperCase() }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.success) {
          localStorage.setItem(AUTH_STORAGE_KEY, `temp:${accessParam.toUpperCase()}:${new Date(d.expiresAt).getTime()}`);
          setAuthMode('temp');
          setTempAccessInfo({ label: d.label || 'Invitado', expiresAt: d.expiresAt });
          setTempScopeBusinessId(d.scopeBusinessId ?? null);
          setIsAuthorized(true);
          window.history.replaceState({}, '', window.location.pathname);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [businessName, setBusinessName] = useState(initialName);
  const [welcomeBunz, setWelcomeBunz] = useState(initialBunz);
  // ── Políticas de piezas (regla rectora: permanentes venden hábito/acceso; promocionales venden incentivo) ──
  type PiecePolicy = 'hero' | 'reward' | 'evergreen';
  const PIECE_DEFAULT_POLICY: Record<string, PiecePolicy> = {
    poster: 'evergreen', // A3 vidriera: EVERGREEN default; REWARD opcional
    table: 'hero',       // A5 frontal: HERO
    cashier: 'evergreen', // A6 caja: EVERGREEN default; REWARD opcional
    guide: 'hero',       // A4 comercial: HERO
  };
  const [pieceModeOverrides, setPieceModeOverrides] = useState<Record<string, PiecePolicy>>({});
  const [permanentMode, setPermanentMode] = useState(false);
  const [welcomeBonusActive, setWelcomeBonusActive] = useState(true);
  const [rewardPct, setRewardPct] = useState<number>(0);
  const [bunzDirty, setBunzDirty] = useState(false);
  const bunzNum = Math.max(0, Number(welcomeBunz) || 0);
  const effectivePolicy = (piece: string): PiecePolicy =>
    permanentMode ? 'evergreen' : (pieceModeOverrides[piece] ?? PIECE_DEFAULT_POLICY[piece] ?? 'evergreen');
  // hero: renderiza el monto SOLO si la promoción está activa y configurada (>0)
  const showBunz = (piece: string) => effectivePolicy(piece) === 'hero' && welcomeBonusActive && bunzNum >= 5;
  // reward: solo si la pieza es REWARD y hay % real (>0) — nunca 0% ni undefined
  const showPct = (piece: string) => {
    if (effectivePolicy(piece) !== 'reward') return false;
    const pct = Math.round(rewardPct);
    return pct > 0;
  };
  const [appUrl, setAppUrl] = useState(initialUrl);
  const [activeRef, setActiveRef] = useState(initialRef);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [urlManuallyEdited, setUrlManuallyEdited] = useState(false);
  const clampWelcomeBunz = (raw: string | number): number => {
    const n = Math.round(Number(String(raw).replace(/\D/g, '')) || 0);
    return Math.min(200, Math.max(5, n));
  };
  const buildDownloadUrl = (ref: string, bunz: number) =>
    `https://rabbitty.me/download?ref=${encodeURIComponent(ref)}&bunz=${bunz}`;
  const [businessLogo, setBusinessLogo] = useState(initialLogo);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>(() => {
    return detectNicheKey(initialNicheParam || initialName);
  });
  const [activeTab, setActiveTab] = useState<'all' | 'poster' | 'table' | 'cashier' | 'guide'>('all');

  // Selector inteligente de negocios de la BD
  const [businesses, setBusinesses] = useState<BusinessItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loadingBusinesses, setLoadingBusinesses] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentTemplate = NICHE_TEMPLATES[selectedTemplateKey] || NICHE_TEMPLATES.coffee;

  const generateNeonQrSession = async () => {
    setQrLoading(true);
    setQrStatusMsg('');
    try {
      const res = await fetch('/api/auth/qr-impresos', { method: 'POST' });
      const data = await res.json();
      if (data?.success && data.sessionId && data.qrData) {
        setQrSessionId(data.sessionId);
        setQrSessionData(data.qrData);
        setQrGateCode(data.gateCode || '');
      } else {
        setQrStatusMsg(data?.error || 'No se pudo generar el QR Neón');
      }
    } catch {
      setQrStatusMsg('Error de red al generar sesión QR Neón');
    } finally {
      setQrLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/qr-impresos', { method: 'POST' });
        const data = await res.json();
        if (cancelled) return;
        if (data?.success && data.sessionId && data.qrData) {
          setQrSessionId(data.sessionId);
          setQrSessionData(data.qrData);
          setQrStatusMsg('');
        } else {
          setQrStatusMsg(data?.error || 'No se pudo generar el QR Neón');
        }
      } catch {
        if (!cancelled) {
          setQrStatusMsg('Error de red al generar sesión QR Neón');
        }
      } finally {
        if (!cancelled) {
          setQrLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthorized]);

  useEffect(() => {
    if (isAuthorized || !qrSessionId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/auth/qr-impresos?sessionId=${encodeURIComponent(qrSessionId)}`);
        const data = await res.json();
        if (!data?.success) return;

        if (data.expired) {
          void generateNeonQrSession();
          return;
        }

        if (data.authenticated) {
          if (data.authorized && (data.mode === 'admin' || data.mode === 'affiliate')) {
            const resolvedMode = data.mode as 'admin' | 'affiliate';
            setAuthMode(resolvedMode);
            setAuthUserName(data.user?.name || (resolvedMode === 'admin' ? 'Admin Rabbitty' : 'Afiliado'));
            setShowAuthLoader(true);
            setTimeout(() => setShowAuthLoader(false), 900);

            if (resolvedMode === 'affiliate' && data.business) {
              const b = data.business as BusinessItem;
              setBusinessName(b.name);
              const bunzVal = clampWelcomeBunz(b.welcomeBunz ?? 25);
              setWelcomeBunz(String(bunzVal));
              setActiveRef(b.refCode);
              setSelectedBusinessId(b.id);
              setUrlManuallyEdited(false);
              setAppUrl(buildDownloadUrl(b.refCode, bunzVal));
              setBusinessLogo(b.logoUrl || '/icon_ra.png');
              setRewardPct(b.rewardPercentage || 0);
              setSelectedTemplateKey(detectNicheKey(`${b.category} ${b.name}`));
              try {
                localStorage.setItem(AUTH_STORAGE_KEY, `affiliate_${b.refCode}`);
              } catch {}
            } else {
              try {
                localStorage.setItem(AUTH_STORAGE_KEY, 'admin');
              } catch {}
            }

            setIsAuthorized(true);
            setShowQrModal(false);
            setAuthError('');
          } else {
            // Es un Rabbitter (cliente regular): denegar acceso y regenerar QR
            setAuthError(
              data.message ||
                '🚫 Tu cuenta es de Rabbitter (Cliente). Este generador es exclusivo para Comercios Afiliados y Administradores.'
            );
            setQrStatusMsg(
              data.message ||
                '🚫 Acceso exclusivo para Afiliados y Administradores (Rabbitters no autorizados).'
            );
            void generateNeonQrSession();
          }
        }
      } catch {
        // continuar sondeando
      }
    }, 2200);

    return () => clearInterval(interval);
  }, [isAuthorized, qrSessionId]);

  useEffect(() => {
    fetch('/api/affiliates')
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && Array.isArray(data.businesses)) {
          setBusinesses(data.businesses);
          if (typeof data.welcomeBonusActive === 'boolean') setWelcomeBonusActive(data.welcomeBonusActive);
          // Si no vino logo en URL o vino vacío, y estamos con el negocio inicial, auto-asignar el logo registrado y detectar nicho
          const match = data.businesses.find((b: BusinessItem) => 
            b.name.toLowerCase() === initialName.toLowerCase() || 
            b.refCode?.toLowerCase() === initialRef.toLowerCase()
          );
          if (match) {
            if (!initialLogo && match.logoUrl) {
              setBusinessLogo(match.logoUrl);
            }
            if (!initialNicheParam) {
              setSelectedTemplateKey(detectNicheKey(`${match.category || ''} ${match.name}`));
            }
          }
        }
      })
      .catch((err) => console.error('Error cargando afiliados:', err))
      .finally(() => setLoadingBusinesses(false));
  }, [initialLogo, initialName, initialRef, initialNicheParam]);

  // 🔒 Temp con scope: fijar SU negocio cuando la lista carga
  useEffect(() => {
    if (authMode !== 'temp' || businesses.length === 0) return;

    if (tempScopeBusinessId) {
      const mine = businesses.find((b) => b.id === tempScopeBusinessId);
      if (mine && selectedBusinessId !== mine.id) {
        const t = setTimeout(() => {
          setBusinessName(mine.name);
          setActiveRef(mine.refCode);
          setSelectedBusinessId(mine.id);
          setUrlManuallyEdited(false);
          const bunzVal = clampWelcomeBunz(mine.welcomeBunz ?? 25);
          setWelcomeBunz(String(bunzVal));
          setAppUrl(buildDownloadUrl(mine.refCode, bunzVal));
          setBusinessLogo(mine.logoUrl || '/icon_ra.png');
          setSelectedTemplateKey(detectNicheKey(`${mine.category || ''} ${mine.name}`));
        }, 0);
        return () => clearTimeout(t);
      }
    } else if (!selectedBusinessId) {
      // Temp global (sin scope de un solo negocio): inicializar con el que haga match o el primer afiliado
      const target = businesses.find((b) => 
        b.name.toLowerCase() === initialName.toLowerCase() || 
        b.refCode?.toLowerCase() === initialRef.toLowerCase()
      ) || businesses[0];
      if (target) {
        const t = setTimeout(() => {
          setBusinessName(target.name);
          setActiveRef(target.refCode);
          setSelectedBusinessId(target.id);
          setUrlManuallyEdited(false);
          const bunzVal = clampWelcomeBunz(target.welcomeBunz ?? 25);
          setWelcomeBunz(String(bunzVal));
          setAppUrl(buildDownloadUrl(target.refCode, bunzVal));
          setBusinessLogo(target.logoUrl || '/icon_ra.png');
          setSelectedTemplateKey(detectNicheKey(`${target.category || ''} ${target.name}`));
        }, 0);
        return () => clearTimeout(t);
      }
    }
  }, [authMode, tempScopeBusinessId, businesses, selectedBusinessId, initialName, initialRef]);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectBusiness = (b: BusinessItem) => {
    setBusinessName(b.name);
    const bunzVal = clampWelcomeBunz(b.welcomeBunz ?? 25);
    setWelcomeBunz(String(bunzVal));
    setActiveRef(b.refCode);
    setSelectedBusinessId(b.id);
    setUrlManuallyEdited(false);
    setAppUrl(buildDownloadUrl(b.refCode, bunzVal));
    setBusinessLogo(b.logoUrl || '/icon_ra.png');
    setRewardPct(b.rewardPercentage || 0);
    const detected = detectNicheKey(`${b.category} ${b.name}`);
    setSelectedTemplateKey(detected);
    setIsDropdownOpen(false);
    setSearchQuery('');
  };

  // ── Sincronización Bono de Bienvenida ↔ URL del QR (y persistencia por tenant) ──
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (urlManuallyEdited) return;
    const bunz = clampWelcomeBunz(welcomeBunz);
    const t = setTimeout(() => {
      setAppUrl((prev) => {
        // Solo regenerar si la URL actual es la autogenerada (el usuario no la editó a mano)
        if (prev.startsWith('https://rabbitty.me/download?ref=')) {
          return buildDownloadUrl(activeRef, bunz);
        }
        return prev;
      });
    }, 0);
    return () => clearTimeout(t);
  }, [welcomeBunz, activeRef, urlManuallyEdited]);

  useEffect(() => {
    if (!selectedBusinessId) return;
    if (authMode === 'temp') return; // acceso temporal: solo vista/impresión
    const bunz = clampWelcomeBunz(welcomeBunz);
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      fetch('/api/auth/qr-impresos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SET_WELCOME_BUNZ', sessionId: qrSessionId || '', businessId: selectedBusinessId, bunz }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (!d?.success) console.warn('[impresos] bono no persistido:', d?.error);
        })
        .catch(() => {});
    }, 900);
    return () => { if (persistTimer.current) clearTimeout(persistTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [welcomeBunz, selectedBusinessId]);

  // 🔒 Lock del selector: afiliados y accesos temporales con scope solo ven SU negocio
  const selectorLocked = authMode === 'affiliate' || (authMode === 'temp' && Boolean(tempScopeBusinessId));
  const filteredBusinesses = businesses.filter((b) =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handlePrint = () => {
    // ── Versionado: snapshot inmutable de la config al momento de enviar a imprenta ──
    try {
      const key = `rabbitty_impresos_versions_${selectedBusinessId || 'default'}`;
      const prev = JSON.parse(localStorage.getItem(key) || '[]');
      prev.unshift({
        date: new Date().toISOString(),
        bunz: welcomeBunz,
        pct: rewardPct,
        template: currentTemplate.label,
        policy: permanentMode ? 'evergreen' : 'mixto',
      });
      localStorage.setItem(key, JSON.stringify(prev.slice(0, 20)));
    } catch {}
    window.print();
  };

  // Helper para renderizar insignia o logo del afiliado con fallback elegante al logo de Ra
  const renderAffiliateBadge = (size: 'sm' | 'md' | 'lg' = 'md', dark = true) => {
    const sizeClasses = {
      sm: 'h-8 px-3 text-xs gap-2',
      md: 'h-11 px-3.5 text-sm gap-2.5',
      lg: 'h-14 px-4 text-base gap-3'
    };

    const logoSizes = {
      sm: 'w-6 h-6 max-h-6',
      md: 'w-8 h-8 max-h-8',
      lg: 'w-10 h-10 max-h-10'
    };

    const effectiveLogo = businessLogo || '/icon_ra.png';

    return (
      <div 
        className={`flex items-center rounded-2xl border transition-all ${
          dark 
            ? 'bg-zinc-900/95 border-zinc-700/80 text-white shadow-lg shadow-black/40' 
            : 'bg-white border-zinc-200 text-black shadow-sm'
        } ${sizeClasses[size]}`}
      >
        {/* Contenedor del logo con fondo contrastante para logos transparentes u oscuros */}
        <div className={`rounded-xl flex items-center justify-center p-0.5 shrink-0 overflow-hidden ${dark ? 'bg-white/10' : 'bg-zinc-100'} ${logoSizes[size]}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={effectiveLogo} 
            alt={businessName} 
            className="w-full h-full object-contain rounded-lg"
            onError={(e) => {
              // Si falla la imagen externa, hacer fallback inmediato al Ra de Rabbitty
              if (e.currentTarget.src !== window.location.origin + '/icon_ra.png') {
                e.currentTarget.src = '/icon_ra.png';
              }
            }}
          />
        </div>
        <span className="font-black whitespace-nowrap tracking-tight">{businessName}</span>
      </div>
    );
  };

  const handleUnlock = async (e: React.FormEvent) => {
      e.preventDefault();
      const clean = authCodeInput.trim();

      // Código temporal (24h) — validado server-side
      if (/^[A-Z0-9]{8}$/i.test(clean)) {
        try {
          const res = await fetch('/api/auth/qr-impresos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'REDEEM_TEMP_CODE', code: clean.toUpperCase() }),
          });
          const d = await res.json();
          if (d?.success) {
            localStorage.setItem(AUTH_STORAGE_KEY, `temp:${clean.toUpperCase()}:${new Date(d.expiresAt).getTime()}`);
            setAuthMode('temp');
            setTempAccessInfo({ label: d.label || 'Invitado', expiresAt: d.expiresAt });
            setTempScopeBusinessId(d.scopeBusinessId ?? null);
            setIsAuthorized(true);
            setAuthError('');
            return;
          }
          setAuthError(d?.error || 'Código inválido o expirado');
          return;
        } catch {
          setAuthError('Error de red al validar el código');
          return;
        }
      }

      // Clave de Admin (variable de entorno — sin bypass hardcodeado)
      if (ADMIN_SECRET && clean === ADMIN_SECRET) {
        try {
          localStorage.setItem(AUTH_STORAGE_KEY, 'admin');
        } catch {}
        setIsAuthorized(true);
        setAuthError('');
        return;
      }

      // Afiliados: SOLO vía escaneo QR con prueba de propiedad (sin atajos)
      setAuthError('Clave incorrecta. Usa tu clave de Admin, un código de acceso temporal, o escanea el QR con la App Rabbitty.');
    };

    if (!isAuthorized) {
    if (showAuthLoader) {
      return (
        <div className="min-h-screen bg-[#09090B] text-zinc-100 flex flex-col items-center justify-center p-6 relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
          <RabbittyLoader message="Acceso confirmado — abriendo…" codeData={qrSessionData} />
        </div>
      );
    }
      return (
        <div className="min-h-screen bg-[#09090B] text-zinc-100 flex flex-col items-center justify-center p-6 relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 w-full max-w-2xl bg-zinc-900/90 border border-zinc-800 rounded-3xl p-8 backdrop-blur-xl shadow-2xl grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            {/* COLUMNA IZQUIERDA: ESCANEO QR NEÓN CON APP RABBITTY */}
            <div className="flex flex-col items-center text-center border-b md:border-b-0 md:border-r border-zinc-800 pb-6 md:pb-0 md:pr-6">
              <span className="text-[10px] font-black uppercase tracking-widest text-pink-400 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 inline-flex items-center gap-1.5 mb-3">
                <Sparkles className="w-3 h-3" /> QR Neón · Afiliados
              </span>
              <h2 className="text-lg font-black text-white">Escanea con tu App Rabbitty</h2>
              <p className="text-[11px] text-zinc-400 mt-1 mb-4 leading-relaxed">
                Abre tu App de <strong className="text-white">Rabbitty</strong> (Escáner o Cámara). Acceso exclusivo para <strong className="text-pink-400">Negocios Afiliados</strong>.
              </p>

              <div className="relative flex items-center justify-center my-1">
                {qrSessionData && !qrLoading ? (
                  <div className="flex flex-col items-center gap-2">
                    <QRDiscovery
                      value={qrSessionData}
                      variant="affiliate"
                      size={230}
                      revealMode="discovery"
                      surfaceKey="impresos-gate"
                    />
                    {qrGateCode && (
                      <p className="text-xs text-zinc-400 text-center leading-snug">
                        Escanea el <b className="text-white">QR cuadrado</b> con la cámara del iPhone → se abre la App y autoriza.<br />
                        ¿Ya dentro de la App? <b className="text-white">Escáner → código manual</b>:{' '}
                        <b className="text-pink-400 font-mono tracking-[2px]">{qrGateCode}</b>
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="w-56 h-56 rounded-4xl bg-[#110520] border-2 border-pink-500/40 flex flex-col items-center justify-center gap-3 p-4">
                    <RefreshCw className="w-7 h-7 text-pink-400 animate-spin" />
                    <span className="text-xs font-bold text-zinc-300">Generando QR Neón...</span>
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center gap-2 text-[11px] text-emerald-400 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Esperando escaneo en vivo...</span>
                <button
                  type="button"
                  onClick={() => void generateNeonQrSession()}
                  className="text-zinc-400 hover:text-white ml-1 cursor-pointer"
                  title="Regenerar código QR Neón"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {qrStatusMsg && (
                <p className="text-[11px] text-rose-400 font-semibold mt-2 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">
                  {qrStatusMsg}
                </p>
              )}
            </div>

            {/* COLUMNA DERECHA: ACCESO POR CLAVE O REFCODE */}
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-pink-500/10 border border-pink-500/20 text-pink-400 shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl font-black tracking-tight text-white">
                    Kit de Materiales Impresos
                  </h1>
                  <p className="text-[11px] text-zinc-400">
                    Habladores de mesa, carteles A3 y señalética POS
                  </p>
                </div>
              </div>

              <form onSubmit={handleUnlock} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">
                    Clave Admin o Código de Acceso (24h)
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="password"
                      placeholder="Código temporal (8 caracteres) o Clave Admin"
                      value={authCodeInput}
                      onChange={(e) => setAuthCodeInput(e.target.value)}
                      className="w-full bg-black/60 border border-zinc-800 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition-all"
                    />
                  </div>
                  {authError && (
                    <p className="text-xs text-rose-400 mt-2 font-medium">{authError}</p>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full bg-linear-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-black text-sm py-3 rounded-xl shadow-lg shadow-pink-500/20 active:scale-[0.98] transition-all cursor-pointer"
                >
                  Acceder con Clave
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-500">
                <Link href="/" className="hover:text-zinc-300 transition-colors">
                  ← Volver al inicio
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setShowQrModal(true);
                    if (!qrSessionData) void generateNeonQrSession();
                  }}
                  className="flex items-center gap-1.5 text-pink-400 hover:text-pink-300 font-bold transition-colors cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5" /> Ampliar QR Neón
                </button>
              </div>
            </div>
          </div>

          {/* Modal de QR Neón Ampliado */}
          {showQrModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-sm w-full text-center relative shadow-2xl">
                <button
                  type="button"
                  onClick={() => setShowQrModal(false)}
                  className="absolute top-4 right-4 text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="w-12 h-12 rounded-2xl bg-pink-500/10 border border-pink-500/20 text-pink-400 flex items-center justify-center mx-auto mb-3">
                  <QrCode className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black text-white">Acceso QR Neón Rabbitty</h3>
                <p className="text-xs text-zinc-400 mt-1 mb-4">
                  Escanea con el lector de tu App Rabbitty. Válido únicamente para <strong className="text-white">Afiliados</strong>.
                </p>
                <div className="inline-block mb-4 pt-6">
                  {qrSessionData && !qrLoading ? (
                    <QRDiscovery
                      value={qrSessionData}
                      variant="affiliate"
                      size={210}
                      revealMode="discovery"
                      surfaceKey="impresos-gate-modal"
                    />
                  ) : (
                    <div className="w-60 h-60 rounded-4xl bg-[#110520] border-2 border-pink-500/40 flex flex-col items-center justify-center gap-3 p-4">
                      <RefreshCw className="w-7 h-7 text-pink-400 animate-spin" />
                      <span className="text-xs font-bold text-zinc-300">Sincronizando QR Neón...</span>
                    </div>
                  )}
                </div>
                {qrStatusMsg && (
                  <p className="text-xs text-rose-400 mb-3 font-medium">{qrStatusMsg}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void generateNeonQrSession()}
                    className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Actualizar Código QR
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 selection:bg-pink-500 selection:text-white">
      {/* BARRA SUPERIOR DE CONTROL (No imprimible) */}
      <header className="print:hidden sticky top-0 z-40 backdrop-blur-xl bg-black/85 border-b border-zinc-800 px-6 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* LADO IZQUIERDO: Marca + Kit en Fila 1; Pills compactas en Fila 2 */}
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2">
              <Link href="/" className="flex items-center gap-2 group shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo_conejo.png" alt="Rabbitty" className="w-7 h-7 object-contain transition-transform group-hover:scale-110" />
                <span className="font-black text-lg tracking-tight text-white">RABBITTY</span>
              </Link>
              <span className="text-zinc-600 font-mono text-xs">/</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20 flex items-center gap-1.5 shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-pink-400" /> Kit Impresos Piloto Oficial
              </span>
            </div>

            {/* Fila 2: Pills secundarias más pequeñas */}
            <div className="flex items-center gap-1.5 pl-0.5">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-300 shrink-0">
                {authMode === 'admin' ? `✅ Acceso autorizado${authUserName ? ` · ${authUserName}` : ''}` : authMode === 'temp' ? `⏳ Acceso temporal · ${tempAccessInfo?.label ?? 'Invitado'}` : `🏪 Afiliado · ${businessName}`}
              </span>

              {/* Si es invitado temporal, mostrar el negocio activo y switcher si tiene acceso global */}
              {authMode === 'temp' && (
                !tempScopeBusinessId && businesses.length > 1 ? (
                  <div className="relative inline-flex items-center shrink-0">
                    <select
                      value={selectedBusinessId || ''}
                      onChange={(e) => {
                        const found = businesses.find((b) => b.id === e.target.value);
                        if (found) handleSelectBusiness(found);
                      }}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-300 border border-pink-500/25 hover:bg-pink-500/20 transition-all cursor-pointer appearance-none pr-5 focus:outline-none"
                      title="Cambiar negocio a imprimir"
                    >
                      {businesses.map((b) => (
                        <option key={b.id} value={b.id} className="bg-zinc-900 text-white">
                          🏪 {b.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-2.5 h-2.5 text-pink-400 absolute right-1.5 pointer-events-none" />
                  </div>
                ) : (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-300 shrink-0">
                    🏪 {businessName}
                  </span>
                )
              )}

              {(authMode === 'admin' || authMode === 'affiliate') && (
                <button
                  type="button"
                  onClick={() => setShowTempForm(true)}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/25 hover:bg-sky-500/20 transition-all cursor-pointer flex items-center gap-1 shrink-0"
                  title="Generar acceso temporal de 24 horas"
                >
                  <KeyRound className="w-2.5 h-2.5" />
                  <span>🔑 Acceso temporal (24h)</span>
                </button>
              )}
            </div>
          </div>

          {/* LADO DERECHO: Tabs + Imprimir + Salir alineados a la derecha */}
          <div className="flex items-center gap-2.5 shrink-0 ml-auto">
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-1 text-xs font-medium">
              <button 
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${activeTab === 'all' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white'}`}
              >
                Todos
              </button>
              <button 
                type="button"
                onClick={() => setActiveTab('poster')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${activeTab === 'poster' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white'}`}
              >
                A3 Cartel
              </button>
              <button 
                type="button"
                onClick={() => setActiveTab('table')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${activeTab === 'table' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white'}`}
              >
                A5 Mesas
              </button>
              <button 
                type="button"
                onClick={() => setActiveTab('cashier')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${activeTab === 'cashier' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white'}`}
              >
                A6 Caja
              </button>
              <button 
                type="button"
                onClick={() => setActiveTab('guide')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${activeTab === 'guide' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white'}`}
              >
                Hoja Afiliado
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 bg-linear-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-black text-xs sm:text-sm px-4 py-2 rounded-xl shadow-lg shadow-pink-500/25 transition-all active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / Exportar PDF</span>
            </button>

            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.removeItem(AUTH_STORAGE_KEY);
                } catch {}
                setIsAuthorized(false);
              }}
              className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white font-bold text-xs px-3 py-2 rounded-xl transition-colors cursor-pointer"
              title="Cerrar sesión / Probar escaneo QR Neón"
            >
              <LogOut className="w-3.5 h-3.5 text-pink-400" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* MODAL DE ACCESO TEMPORAL (24H) */}
      {showTempForm && (authMode === 'admin' || authMode === 'affiliate') && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setShowTempForm(false)}
        >
          <div 
            className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 max-w-lg w-full relative shadow-2xl shadow-sky-950/40 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  <KeyRound className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-black text-white">Generar Acceso Temporal (24h)</h3>
                  <p className="text-[11px] text-zinc-400">
                    {authMode === 'affiliate' ? `Acceso limitado a ${businessName}` : 'Crea un pase temporal de 24 horas para impresores o marketing'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTempForm(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Nombre o Destinatario
                </label>
                <input
                  value={tempLabel}
                  onChange={(e) => setTempLabel(e.target.value)}
                  placeholder="Ej: Imprenta Rápida, Diseñador, Juan Pérez..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Alcance / Negocio visible
                </label>
                {authMode === 'admin' ? (
                  <select
                    value={tempScopePick}
                    onChange={(e) => setTempScopePick(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500 cursor-pointer"
                  >
                    <option value="ALL">👁️ Ver todos los negocios (Full Access)</option>
                    {businesses.map((b) => (
                      <option key={b.id} value={b.id}>🏪 Solo {b.name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-300 flex items-center justify-between">
                    <span>🏪 {businessName}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">(fijo)</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={async () => {
                  if (!tempLabel.trim()) { window.alert('Pon para quién es el acceso'); return; }
                  try {
                    const res = await fetch('/api/auth/qr-impresos', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        action: 'GENERATE_TEMP_CODE',
                        sessionId: qrSessionId || '',
                        label: tempLabel.trim(),
                        ...(authMode === 'admin' && tempScopePick !== 'ALL' ? { businessId: tempScopePick } : {}),
                      }),
                    });
                    const d = await res.json();
                    if (d?.success) {
                      setTempGenerated({ code: d.code, url: d.url, expiresAt: d.expiresAt, scopeName: d.scopeName });
                      navigator.clipboard.writeText(d.url).catch(() => {});
                    } else {
                      window.alert(d?.error || 'No se pudo generar el acceso');
                    }
                  } catch {
                    window.alert('Error de red al generar el acceso');
                  }
                }}
                className="w-full py-2.5 rounded-xl bg-linear-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-black cursor-pointer shadow-lg shadow-sky-500/20 transition-all active:scale-[0.99] flex items-center justify-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>⚡ Generar Código de 24 Horas</span>
              </button>

              {tempGenerated && (
                <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/30 space-y-2 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">Código de Acceso Activo</span>
                    <span className="text-[10px] text-zinc-400">Válido 24 horas</span>
                  </div>
                  <div className="flex items-center justify-between bg-black/60 rounded-xl px-3 py-2 border border-sky-500/20">
                    <span className="text-base font-mono font-black text-emerald-400 tracking-[3px]">{tempGenerated.code}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(tempGenerated.url || tempGenerated.code).catch(() => {});
                        window.alert('¡Enlace y código copiados al portapapeles!');
                      }}
                      className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 transition-colors cursor-pointer"
                    >
                      Copiar Enlace
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-400 break-all">
                    {tempGenerated.url} · {tempGenerated.scopeName ? `Alcance: ${tempGenerated.scopeName}` : 'Todos los negocios'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PANEL DE PERSONALIZACIÓN Y SELECCIÓN DE TEMPLATE (Solo visible para Admin y Afiliados; oculto para Invitados) */}
      {authMode !== 'temp' && (
        <section className="print:hidden border-b border-zinc-900 bg-zinc-950/70 py-6 px-6">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-5 shadow-2xl backdrop-blur-md">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
              <div>
                <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-pink-500" />
                  Generador de Materiales Físicos en Punto de Venta
                </h1>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Elige tu negocio afiliado, la plantilla de copy curada para tu nicho de mercado y posiciona tu logotipo estratégico.
                </p>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 pb-4 border-b border-zinc-800/60">
                <button
                  type="button"
                  onClick={() => setPermanentMode((v) => !v)}
                  className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
                    permanentMode
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-white/5 text-zinc-400 border-zinc-700 hover:bg-white/10'
                  }`}
                  title="Fuerza TODAS las piezas en versión evergreen (sin cifras) — señalética de larga duración"
                >
                  {permanentMode ? '🌿 Modo permanente activo' : '🌿 Modo permanente (sin cifras)'}
                </button>

                {/* A3/A6: elegir REWARD (con %) o EVERGREEN */}
                <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                  <span className="font-bold uppercase tracking-wider">A3 Vidriera:</span>
                  <select
                    value={pieceModeOverrides.poster ?? 'evergreen'}
                    onChange={(e) => setPieceModeOverrides((p) => ({ ...p, poster: e.target.value as PiecePolicy }))}
                    className="bg-black border border-zinc-800 rounded-lg px-2 py-1 text-[10px] text-white cursor-pointer focus:outline-none"
                  >
                    <option value="evergreen">🌿 Sin cifras (durable)</option>
                    <option value="reward">📊 Con %{Math.round(rewardPct)} (garantizado)</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                  <span className="font-bold uppercase tracking-wider">A6 Caja:</span>
                  <select
                    value={pieceModeOverrides.cashier ?? 'evergreen'}
                    onChange={(e) => setPieceModeOverrides((p) => ({ ...p, cashier: e.target.value as PiecePolicy }))}
                    className="bg-black border border-zinc-800 rounded-lg px-2 py-1 text-[10px] text-white cursor-pointer focus:outline-none"
                  >
                    <option value="evergreen">🌿 Sin cifras (durable)</option>
                    <option value="reward">📊 Con %{Math.round(rewardPct)} (garantizado)</option>
                  </select>
                </div>

                {bunzDirty && (
                  <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-full">
                    ⚠️ Cambiar el bono obsoleta: A5 frontal + A4 — reimprímelas o activa Modo permanente
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-zinc-400 bg-zinc-800/60 px-2.5 py-1 rounded-md border border-zinc-700/50">
                  Piloto Rabbitty 2026
                </span>
              </div>
            </div>

            {/* Smart Business Selector */}
            <div className="mb-4 pt-2 border-t border-zinc-800 relative" ref={dropdownRef}>
              <label className="text-[11px] font-bold text-pink-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> {selectorLocked ? 'Tu Negocio Afiliado' : '1. Seleccionar Negocio Afiliado de la Red'}
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { if (!selectorLocked) setIsDropdownOpen(!isDropdownOpen); }}
                  disabled={selectorLocked}
                  className={`w-full bg-black border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-left flex items-center justify-between text-white transition-colors ${selectorLocked ? 'opacity-70 cursor-not-allowed' : 'hover:border-pink-500/50 cursor-pointer'}`}
                >
                  <div className="flex items-center gap-3">
                    {businessLogo ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={businessLogo} alt={businessName} className="w-6 h-6 rounded-md object-contain bg-zinc-900 border border-zinc-800" />
                    ) : (
                      <span className="w-2.5 h-2.5 rounded-full bg-pink-500" />
                    )}
                    <span className="font-bold text-white">{businessName}</span>
                    <span className="text-xs text-zinc-500 font-mono">({currentTemplate.label})</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-400 text-xs">
                    <span>{loadingBusinesses ? 'Cargando red...' : `${businesses.length} afiliados`}</span>
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                {isDropdownOpen && !selectorLocked && (
                  <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-[#121216] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-2xl">
                    <div className="p-3 border-b border-zinc-800 flex items-center gap-2 bg-zinc-950/60">
                      <Search className="w-4 h-4 text-zinc-500" />
                      <input
                        type="text"
                        placeholder="Buscar por nombre, categoría o dirección..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                        className="bg-transparent border-none text-white text-xs w-full focus:outline-none placeholder:text-zinc-600"
                      />
                    </div>
                    <div className="max-h-60 overflow-y-auto divide-y divide-zinc-800/50">
                      {filteredBusinesses.length === 0 ? (
                        <div className="p-4 text-center text-xs text-zinc-500">
                          No se encontraron negocios con ese término.
                        </div>
                      ) : (
                        filteredBusinesses.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => handleSelectBusiness(b)}
                            className="w-full px-4 py-3 text-left hover:bg-pink-500/10 flex items-center justify-between transition-colors group cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              {b.logoUrl ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={b.logoUrl} alt={b.name} className="w-7 h-7 rounded-md object-contain bg-zinc-900 border border-zinc-800 shrink-0" />
                              ) : (
                                <div className="w-7 h-7 rounded-md bg-zinc-800 text-[10px] font-bold text-zinc-400 flex items-center justify-center shrink-0">
                                  {b.name.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <div className="text-sm font-bold text-white group-hover:text-pink-400 flex items-center gap-2">
                                  {b.name}
                                  {b.name === businessName && <Check className="w-3.5 h-3.5 text-pink-500" />}
                                </div>
                                <div className="text-[11px] text-zinc-400 flex items-center gap-2 mt-0.5">
                                  <span className="text-zinc-500">{b.category}</span>
                                  {b.address && <span>· {b.address}</span>}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-mono font-bold text-pink-400">+{b.rewardPercentage}% Bunz</span>
                              <span className="block text-[9px] font-mono text-zinc-500">ref: {b.refCode}</span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Selector de Plantilla por Nicho de Mercado (Control de Marca e Identidad) */}
            <div className="mb-4 pt-3 border-t border-zinc-800">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-bold text-pink-400 uppercase tracking-wider flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5" /> 2. Plantilla de Copy por Nicho de Mercado (Preserva Nuestra Identidad)
                </label>
                <span className="text-[10px] text-zinc-400 italic">
                  Frases curadas y de alta conversión
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {Object.values(NICHE_TEMPLATES).map((template) => {
                  const isSelected = template.key === selectedTemplateKey;
                  return (
                    <button
                      key={template.key}
                      type="button"
                      onClick={() => setSelectedTemplateKey(template.key)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected 
                          ? 'bg-pink-500/15 border-pink-500 text-white shadow-md shadow-pink-500/10 ring-1 ring-pink-500' 
                          : 'bg-black/60 border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <div className="text-lg mb-1">{template.icon}</div>
                      <div>
                        <span className={`block text-xs font-bold leading-tight ${isSelected ? 'text-pink-300' : 'text-zinc-300'}`}>
                          {template.label.split('/')[0].trim()}
                        </span>
                        <span className="text-[10px] text-zinc-500 line-clamp-1 mt-0.5">
                          {template.categoryHint}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Campos de Ajuste Rápido y URL de Logo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-zinc-800/60">
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Nombre en Carteles
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-pink-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Bono de Bienvenida ($ MXN)
                </label>
                <input
                  type="text"
                  value={welcomeBunz}
                  onChange={(e) => { setBunzDirty(true); setWelcomeBunz(e.target.value); }}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-pink-500 font-medium"
                />
              </div>

              <div>
                <label className="flex items-center justify-between text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  <span>Logo del Afiliado (URL)</span>
                  {businessLogo && <span className="text-[10px] text-pink-400 font-mono">Cargado</span>}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={businessLogo}
                    onChange={(e) => setBusinessLogo(e.target.value)}
                    placeholder="https://.../logo.png"
                    className="w-full bg-black border border-zinc-800 rounded-xl pl-8 pr-3 py-2 text-xs text-zinc-300 font-mono focus:outline-none focus:border-pink-500"
                  />
                  <ImageIcon className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  URL Destino del QR (Referido)
                </label>
                <input
                  type="text"
                  value={appUrl}
                  onChange={(e) => { setUrlManuallyEdited(true); setAppUrl(e.target.value); }}
                  placeholder="https://rabbitty.me/download?ref=..."
                  className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs text-pink-400 font-mono focus:outline-none focus:border-pink-500"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* ÁREA DE CONTENIDO IMPRESO / RENDERIZADO */}
      <main className="max-w-7xl mx-auto p-6 md:p-12 space-y-16 print:p-0 print:space-y-0 print:m-0">

        {/* PIEZA 1: CARTEL PRINCIPAL A3 */}
        {(activeTab === 'all' || activeTab === 'poster') && (
          <section className="print:break-after-page flex flex-col items-center">
            <div className="print:hidden w-full flex items-center justify-between pb-3 mb-4 border-b border-zinc-800 text-xs text-zinc-400 font-mono">
              <span className="font-bold text-white uppercase tracking-wider">Pieza 1 · Cartel Principal para Entrada / Cristalera (Formato A3)</span>
              <span>Medidas: 297mm × 420mm · Plantilla: {currentTemplate.label}</span>
            </div>

            {/* Canvas Cartel A3 (Fondo negro minimalista Rabbitty + Co-branding estratégico) */}
            <div className="w-95 sm:w-120 md:w-150 min-h-212.5 bg-black text-white border border-zinc-800 rounded-3xl p-10 md:p-12 flex flex-col justify-between shadow-2xl relative overflow-hidden print:w-full print:min-h-screen print:rounded-none print:border-none print:p-14">
              
              {/* Marca de agua sutil de Rabbitty */}
              <div className="absolute -right-20 -bottom-20 w-96 h-96 opacity-10 pointer-events-none">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo_conejo.png" alt="" className="w-full h-full object-contain filter invert" />
              </div>

              {/* Cabecera Cartel con Posición Estratégica del Logo del Afiliado */}
              <div>
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-6 gap-4">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo_conejo.png" alt="Rabbitty" className="w-12 h-12 object-contain" />
                    <div>
                      <h2 className="font-black text-2xl tracking-tighter text-white">RABBITTY</h2>
                      <p className="text-[10px] uppercase tracking-widest text-pink-400 font-bold">The Real-World Loyalty Network</p>
                    </div>
                  </div>

                  {/* Co-Branding Estratégico en Cartel Principal */}
                  <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                      <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-bold">En alianza con</span>
                    </div>
                    {renderAffiliateBadge('lg', true)}
                  </div>
                </div>

                {/* Titular Impactante según Nicho */}
                <div className="mt-10 space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="inline-flex items-center gap-2 text-xs font-mono font-bold tracking-widest text-pink-400 uppercase px-3 py-1.5 bg-pink-500/10 rounded-xl border border-pink-500/25 shadow-xs">
                      {businessLogo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={businessLogo}
                          alt={businessName}
                          className="w-5 h-5 object-contain rounded-md bg-white/10 p-0.5"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                      <span>{currentTemplate.posterTag} · {businessName}</span>
                    </div>
                  </div>
                  <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-[1.08] text-white">
                    {currentTemplate.posterHeadlinePrefix} <br />
                    <span className="text-transparent bg-clip-text bg-linear-to-r from-pink-400 via-rose-500 to-pink-500">
                      {currentTemplate.posterHeadlineHighlight}
                    </span>
                  </h1>
                  <p className="text-sm md:text-base text-zinc-400 font-normal leading-relaxed max-w-md pt-2">
                    {currentTemplate.posterDescription}
                  </p>
                </div>
              </div>

              {/* Centro: Oferta + QR Gigante */}
              <div className="my-8 bg-zinc-950/80 border border-zinc-800 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
                <div className="flex-1 space-y-3 text-center md:text-left">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 font-bold">
                    {showPct('poster') ? 'Beneficio Permanente' : 'Únete a la Red'}
                  </span>
                  {showPct('poster') ? (
                    <>
                      <div className="flex items-baseline justify-center md:justify-start gap-1">
                        <span className="text-5xl md:text-6xl font-black tracking-tighter text-white">+{Math.round(rewardPct)}%</span>
                        <span className="text-xl md:text-2xl font-black text-pink-500 tracking-tight">BUNZ</span>
                      </div>
                      <p className="text-xs text-zinc-300 font-medium">
                        En cada consumo en <strong className="text-white">{businessName}</strong>. Acumula y canjea cuando quieras.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-baseline justify-center md:justify-start gap-1">
                        <span className="text-4xl md:text-5xl font-black tracking-tighter text-white">GANA BUNZ</span>
                      </div>
                      <p className="text-xs text-zinc-300 font-medium">
                        En cada visita a <strong className="text-white">{businessName}</strong>. Únete a la red y descubre tu red de beneficios.
                      </p>
                    </>
                  )}
                  <div className="pt-2 flex items-center justify-center md:justify-start gap-2 text-[11px] text-zinc-400">
                    <CheckCircle2 className="w-3.5 h-3.5 text-pink-500" /> Sin trámites engorrosos · Registro en 30s
                  </div>
                </div>

                {/* QR Container */}
                <div className="flex flex-col items-center">
                  <SimpleQRCode value={appUrl} size={190} />
                  <span className="text-[11px] font-mono text-zinc-400 mt-2 font-bold tracking-wider">ESCANEA CON TU CÁMARA</span>
                </div>
              </div>

              {/* Pie Cartel A3 con Co-Firma */}
              <div className="pt-6 border-t border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left text-xs text-zinc-400">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-4 h-4 text-pink-500" />
                  <span>Disponible para iOS & Android · Rabbitty Network</span>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] text-zinc-400 font-mono">
                    Punto oficial verificado en {businessName}
                  </p>
                </div>
              </div>

            </div>
          </section>
        )}

        {/* PIEZA 2: DISPLAYS DE MESA (A5) */}
        {(activeTab === 'all' || activeTab === 'table') && (
          <section className="print:break-after-page flex flex-col items-center">
            <div className="print:hidden w-full flex items-center justify-between pb-3 mb-4 border-b border-zinc-800 text-xs text-zinc-400 font-mono">
              <span className="font-bold text-white uppercase tracking-wider">Pieza 2 · Habladores de Mesa / Carpas Acrílicas (Formato A5 / A6)</span>
              <span>Medidas: 148mm × 210mm · Plantilla: {currentTemplate.label}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 print:grid-cols-2 print:gap-4 w-full max-w-4xl">
              
              {/* Cara Frontal Mesa (Fondo Blanco, Alta Legibilidad) */}
              <div className="bg-white text-black rounded-3xl p-8 border border-zinc-200 shadow-xl flex flex-col justify-between min-h-115 relative overflow-hidden print:border-black">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo_conejo_blk.png" alt="Rabbitty" className="w-7 h-7 object-contain" />
                    <span className="font-black tracking-tight text-black text-lg">RABBITTY</span>
                  </div>

                  {/* Logo / Insignia Afiliado Estratégica */}
                  {renderAffiliateBadge('md', false)}
                </div>

                <div className="my-6 text-center">
                  <span className="text-[10px] font-mono font-black text-pink-600 uppercase tracking-widest">
                    {currentTemplate.tableWaitingCallout}
                  </span>
                  <h3 className="text-2xl md:text-3xl font-black tracking-tight text-black mt-1 leading-tight">
                    {currentTemplate.tableHeadline} <br />
                    {showBunz('table') ? (
                      <>DE <span className="text-pink-600">${welcomeBunz} BUNZ</span> DE BIENVENIDA</>
                    ) : (
                      <>GANA <span className="text-pink-600">BUNZ</span> EN CADA VISITA</>
                    )}
                  </h3>
                  <p className="text-xs text-zinc-600 mt-2 font-medium">
                    1. Escanea el código con tu celular.<br />
                    2. Instala y regístrate en 30 segundos.<br />
                    3. Descubre tu saldo disponible al instante.
                  </p>
                </div>

                <div className="flex flex-col items-center justify-center">
                  <SimpleQRCode value={appUrl} size={150} color="#000000" bgColor="#FFFFFF" />
                  <span className="text-[10px] font-mono font-bold text-zinc-500 mt-2">
                    CÁMARA DEL CELULAR · IOS & ANDROID
                  </span>
                </div>

                <div className="pt-4 border-t border-zinc-200 text-center text-[9px] text-zinc-500 font-mono flex items-center justify-between">
                  <span>1 BUNZ = $1 MXN</span>
                  <span className="font-bold text-zinc-800">{businessName}</span>
                </div>
              </div>

              {/* Cara Posterior Mesa (Fondo Negro, Gamificada / Explicativa) */}
              <div className="bg-black text-white rounded-3xl p-8 border border-zinc-800 shadow-xl flex flex-col justify-between min-h-115 relative overflow-hidden print:border-black">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo_conejo.png" alt="Rabbitty" className="w-7 h-7 object-contain" />
                    <span className="font-black tracking-tight text-white text-lg">RABBITTY</span>
                  </div>
                  {renderAffiliateBadge('md', true)}
                </div>

                <div className="my-4 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-pink-500 text-white font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Acumula en cada visita</h4>
                      <p className="text-[11px] text-zinc-400">{currentTemplate.tableStep1}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-zinc-800 text-zinc-300 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Sin tarjetas de plástico</h4>
                      <p className="text-[11px] text-zinc-400">Todo vive en tu app de Rabbitty, siempre accesible y seguro.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-zinc-800 text-zinc-300 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Canjea en tus compras</h4>
                      <p className="text-[11px] text-zinc-400">{currentTemplate.tableStep3}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center pt-2">
                  <SimpleQRCode value={appUrl} size={110} />
                  <span className="text-[9px] font-mono text-zinc-400 mt-2 font-bold">
                    ESCANEAME PARA REGISTRARTE
                  </span>
                </div>

                <div className="pt-3 border-t border-zinc-800 text-center text-[9px] text-zinc-400 font-mono">
                  {currentTemplate.tableFooterHint}
                </div>
              </div>

            </div>
          </section>
        )}

        {/* PIEZA 3: SEÑAL DE CAJA (A6) */}
        {(activeTab === 'all' || activeTab === 'cashier') && (
          <section className="print:break-after-page flex flex-col items-center">
            <div className="print:hidden w-full flex items-center justify-between pb-3 mb-4 border-b border-zinc-800 text-xs text-zinc-400 font-mono">
              <span className="font-bold text-white uppercase tracking-wider">Pieza 3 · Señal de Mostrador / Caja Registradora (Formato A6)</span>
              <span>Medidas: 105mm × 148mm (Junto al lector de tarjetas / POS)</span>
            </div>

            <div className="w-full max-w-sm bg-linear-to-b from-zinc-950 to-black text-white border-2 border-pink-500 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center justify-between min-h-95">
              <div className="w-full flex items-center justify-between pb-2 border-b border-zinc-800/80">
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo_conejo.png" alt="Rabbitty" className="w-6 h-6 object-contain" />
                  <span className="font-black text-xs tracking-tight">RABBITTY POINT</span>
                </div>
                {renderAffiliateBadge('md', true)}
              </div>

              <div className="my-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-pink-400 font-bold bg-pink-500/10 px-2.5 py-0.5 rounded-full border border-pink-500/20">
                  {currentTemplate.cashierTag}
                </span>
                <h3 className="text-xl font-black tracking-tight mt-1">
                  ¿YA TIENES TU CUENTA?
                </h3>
                <p className="text-xs text-zinc-400 mt-1 max-w-xs">
                  {showBunz('guide')
                    ? `${currentTemplate.cashierCallout} (${welcomeBunz} Bunz de bienvenida para nuevos Rabbitters).`
                    : `${currentTemplate.cashierCallout} — presenta tu Mi Código y acumula Bunz en cada visita.`}
                </p>
              </div>

              <SimpleQRCode value={appUrl} size={140} />

              <div className="w-full pt-3 border-t border-zinc-800 flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                <span className="truncate max-w-32">{businessName}</span>
                <span className="text-pink-400 font-bold">1 Bunz = $1 MXN</span>
              </div>
            </div>
          </section>
        )}

        {/* PIEZA 4: HOJA COMERCIAL Y GUION PARA EL NEGOCIO (A4) */}
        {(activeTab === 'all' || activeTab === 'guide') && (
          <section className="print:break-after-page flex flex-col items-center">
            <div className="print:hidden w-full flex items-center justify-between pb-3 mb-4 border-b border-zinc-800 text-xs text-zinc-400 font-mono">
              <span className="font-bold text-white uppercase tracking-wider">Pieza 4 · Hoja de Operación & Argumentario para el Dueño / Personal (Formato A4)</span>
              <span>Medidas: 210mm × 297mm (Documento interno del negocio)</span>
            </div>

            <div className="w-full max-w-3xl bg-white text-zinc-900 rounded-3xl p-10 md:p-12 border border-zinc-200 shadow-xl print:p-8 print:border-none">
              
              {/* Header Hoja con Co-Branding de Afiliado */}
              <div className="flex items-center justify-between pb-6 border-b border-zinc-200 gap-4">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo_conejo_blk.png" alt="Rabbitty" className="w-10 h-10 object-contain" />
                  <div>
                    <h2 className="text-xl font-black text-black tracking-tight">RABBITTY FOR BUSINESS</h2>
                    <p className="text-xs text-zinc-500 font-mono">Guía de Lanzamiento Piloto · {businessName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {renderAffiliateBadge('md', false)}
                  <span className="text-xs font-bold text-pink-600 bg-pink-50 px-3 py-1 rounded-full border border-pink-200 shrink-0">
                    Octubre 2026
                  </span>
                </div>
              </div>

              {/* Guion Adaptado al Nicho para el Personal */}
              <div className="mt-8">
                <h3 className="text-sm font-black uppercase tracking-wider text-pink-600 flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-4 h-4" /> {currentTemplate.guideStaffTitle}
                </h3>
                <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 space-y-3 text-sm">
                  <p className="text-zinc-800 font-medium">
                    <strong className="text-black">Al cobrar o entregar el servicio / producto:</strong> <br />
                    <em>{currentTemplate.guideScriptGreeting}</em>
                  </p>
                  <p className="text-zinc-800 font-medium">
                    <strong className="text-black">Si el cliente pregunta cómo funciona:</strong> <br />
                    <em>{currentTemplate.guideScriptExplain}</em>
                  </p>
                </div>
              </div>

              {/* Parámetros Acordados del Piloto */}
              <div className="mt-8">
                <h3 className="text-sm font-black uppercase tracking-wider text-zinc-900 flex items-center gap-2 mb-3">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" /> Parámetros del Piloto Controlado
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/50">
                    <span className="text-[10px] font-mono text-zinc-500 font-bold uppercase block">Bono Bienvenida</span>
                    <span className="text-xl font-black text-black">{welcomeBonusActive && bunzNum >= 5 ? `$${welcomeBunz} Bunz` : '—'}</span>
                    <span className="text-[11px] text-zinc-500 block mt-0.5">{welcomeBonusActive && bunzNum >= 5 ? `(= $${welcomeBunz} MXN)` : 'Promoción inactiva'}</span>
                  </div>
                  <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/50">
                    <span className="text-[10px] font-mono text-zinc-500 font-bold uppercase block">Nicho Seleccionado</span>
                    <span className="text-base font-black text-black">{currentTemplate.label.split('/')[0]}</span>
                    <span className="text-[11px] text-zinc-500 block mt-0.5">Identidad protegida</span>
                  </div>
                  <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/50">
                    <span className="text-[10px] font-mono text-zinc-500 font-bold uppercase block">Integridad Financiera</span>
                    <span className="text-base font-black text-emerald-700">Ledger Inmutable</span>
                    <span className="text-[11px] text-zinc-500 block mt-0.5">Anti-doble canje criptográfico</span>
                  </div>
                </div>
              </div>

              {/* Qué Métricas Recibirá el Dueño */}
              <div className="mt-8">
                <h3 className="text-sm font-black uppercase tracking-wider text-zinc-900 mb-3">
                  Métricas de Retorno que Rabbitty Entregará a {businessName}
                </h3>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-700">
                  <li className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 border border-zinc-100">
                    <ArrowRight className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                    <span>Total de escaneos únicos captados en mesa y caja.</span>
                  </li>
                  <li className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 border border-zinc-100">
                    <ArrowRight className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                    <span>Clientes nuevos registrados y activados en el local.</span>
                  </li>
                  <li className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 border border-zinc-100">
                    <ArrowRight className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                    <span>Bunz emitidos vs Bunz efectivamente canjeados.</span>
                  </li>
                  <li className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 border border-zinc-100">
                    <ArrowRight className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                    <span>Tasa de retorno de clientes durante las siguientes semanas.</span>
                  </li>
                </ul>
              </div>

              {/* Firma y Contacto */}
              <div className="mt-8 pt-6 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
                <span>Rabbitty Network · Soporte en Vivo: contacto@rabbitty.me</span>
                <span className="font-mono text-[11px]">Identidad de Marca Oficial Rabbitty © 2026</span>
              </div>

            </div>
          </section>
        )}

      </main>

      {/* ESTILOS DE IMPRESIÓN DEDICADOS */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 0;
            size: auto;
          }
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}

export default function ImpresosPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#09090B] text-white flex items-center justify-center font-mono text-sm">Cargando kit de impresión...</div>}>
      <ImpresosContent />
    </Suspense>
  );
}

```

*(1912 líneas)*


## 📄 `landing-page/src/app/api/auth/qr-impresos/route.ts`

**QR-IMPRESOS API — sesión de gate + SET_WELCOME_BUNZ + temp codes + pending codes**

```typescript
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { code6FromData } from '@/lib/rabbittyCodeCodec';

function getDbUrl(): string | undefined {
  return process.env.CORE_DATABASE_URL || process.env.POSTGRES_URL;
}

export async function POST(req: Request) {
  const dbUrl = getDbUrl();
  if (!dbUrl) {
    return NextResponse.json(
      { success: false, error: 'Base de datos no configurada en landing-page' },
      { status: 500 }
    );
  }

  // ── SET_WELCOME_BUNZ: persiste el Bono de Bienvenida del tenant (Bunz) ──
  // Requiere sesión qr-impresos autenticada (God admin o dueño del negocio).
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.action === 'SET_WELCOME_BUNZ') {
      const sessionId = String(body.sessionId || '');
      const businessId = String(body.businessId || '');
      const bunz = Math.round(Number(body.bunz));
      if (!sessionId || !businessId || !Number.isFinite(bunz) || bunz < 5 || bunz > 200) {
        return NextResponse.json({ success: false, error: 'Parámetros inválidos (bunz 5–200)' }, { status: 400 });
      }

      const postgres = (await import('postgres')).default;
      const sql = postgres(dbUrl, { ssl: 'require', max: 1 });
      const sessions = await sql`SELECT id, "userId" FROM "webSessions" WHERE id = ${sessionId} LIMIT 1`;
      const session = sessions[0];
      if (!session?.userId) {
        await sql.end();
        return NextResponse.json({ success: false, error: 'Sesión no autenticada' }, { status: 401 });
      }

      const userRows = await sql`
        SELECT id, username, email, role FROM users WHERE id = ${session.userId} LIMIT 1`;
      const user = userRows[0];
      if (!user) { await sql.end(); return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 }); }

      const isGod = ['admin@rabbitty.com', 'marco.munoz9@gmail.com'].includes(String(user.email || '').toLowerCase()) ||
        ['deltoro', 'mardelbull'].includes(String(user.username || '').toLowerCase()) ||
        String(user.role || '').toUpperCase() === 'ADMIN';
      let isOwner = false;
      if (!isGod) {
        const owned = await sql`
          SELECT id FROM "ownedBusinesses" WHERE id = ${businessId} AND "ownerId" = ${session.userId} LIMIT 1`;
        isOwner = owned.length > 0;
      }
      if (!isGod && !isOwner) {
        await sql.end();
        return NextResponse.json({ success: false, error: 'Solo el dueño del negocio o God Admin puede definir el bono' }, { status: 403 });
      }

      // Persistir en systemSettings: welcome_bonus_tenant_config = { [businessId]: bunz }
      const cfgRows = await sql`SELECT value FROM "systemSettings" WHERE key = 'welcome_bonus_tenant_config' LIMIT 1`;
      let config: Record<string, number> = {};
      try { if (cfgRows[0]?.value) config = JSON.parse(cfgRows[0].value); } catch { config = {}; }
      config[businessId] = bunz;
      if (cfgRows.length > 0) {
        await sql`UPDATE "systemSettings" SET value = ${JSON.stringify(config)} WHERE key = 'welcome_bonus_tenant_config'`;
      } else {
        await sql`INSERT INTO "systemSettings" (key, value) VALUES ('welcome_bonus_tenant_config', ${JSON.stringify(config)})`;
      }
      await sql.end();

      return NextResponse.json({ success: true, businessId, welcomeBunz: bunz });
    }

    // ── Códigos de acceso temporal a /impresos (24h) para impresor/marketing ──
    if (body?.action === 'GENERATE_TEMP_CODE') {
      try {
        const sessionId = String(body.sessionId || '');
        const label = String(body.label || 'Invitado').slice(0, 40);
        if (!sessionId) {
          return NextResponse.json({ success: false, error: 'Sesión requerida' }, { status: 401 });
        }
        const postgres = (await import('postgres')).default;
        const sql = postgres(dbUrl, { ssl: 'require', max: 1 });
        const sessions = await sql`SELECT id, "userId" FROM "webSessions" WHERE id = ${sessionId} LIMIT 1`;
        const session = sessions[0];
        if (!session?.userId) { await sql.end(); return NextResponse.json({ success: false, error: 'Sesión no autenticada' }, { status: 401 }); }
        const userRows = await sql`SELECT username, email, role FROM users WHERE id = ${session.userId} LIMIT 1`;
        const user = userRows[0];
        const isGod = ['admin@rabbitty.com', 'marco.munoz9@gmail.com'].includes(String(user?.email || '').toLowerCase()) ||
          ['deltoro', 'mardelbull'].includes(String(user?.username || '').toLowerCase()) ||
          String(user?.role || '').toUpperCase() === 'ADMIN';
        await sql.end();

        // God → elige el tenant del scope (o todos). Dueño de negocio → scope a SU negocio.
        let scopeBusinessId: string | null = null;
        let scopeName = 'todos los tenants (God)';
        if (isGod && body.businessId) {
          const postgres4 = (await import('postgres')).default;
          const sql4 = postgres4(dbUrl, { ssl: 'require', max: 1 });
          const bizRows = await sql4`SELECT id, name FROM "ownedBusinesses" WHERE id = ${String(body.businessId)} LIMIT 1`;
          await sql4.end();
          if (bizRows[0]) {
            scopeBusinessId = bizRows[0].id;
            scopeName = bizRows[0].name;
          }
        }
        if (!isGod) {
          const postgres3 = (await import('postgres')).default;
          const sql3 = postgres3(dbUrl, { ssl: 'require', max: 1 });
          const ownedRows = await sql3`
            SELECT b.id, b.name FROM "ownedBusinesses" b WHERE b."ownerId" = ${session.userId}
            AND (b.status = 'APPROVED' OR b.status = 'ACTIVE') LIMIT 1`;
          await sql3.end();
          if (!ownedRows[0]) {
            return NextResponse.json({ success: false, error: 'Sin negocio afiliado asociado a tu cuenta' }, { status: 403 });
          }
          scopeBusinessId = ownedRows[0].id;
          scopeName = ownedRows[0].name;
        }

        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        const bytes = crypto.randomBytes(8);
        for (let i = 0; i < 8; i++) code += alphabet[bytes[i] % alphabet.length];
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        const postgres2 = (await import('postgres')).default;
        const sql2 = postgres2(dbUrl, { ssl: 'require', max: 1 });
        const cfgRows = await sql2`SELECT value FROM "systemSettings" WHERE key = 'impresos_temp_access' LIMIT 1`;
        let config: Record<string, { label: string; createdAt: string; expiresAt: string; scopeBusinessId?: string | null }> = {};
        try { if (cfgRows[0]?.value) config = JSON.parse(cfgRows[0].value); } catch { config = {}; }
        const now = Date.now();
        for (const [k, v] of Object.entries(config)) {
          if (new Date(v.expiresAt).getTime() < now) delete config[k];
        }
        config[code] = { label, createdAt: new Date().toISOString(), expiresAt, scopeBusinessId };
        if (cfgRows.length > 0) {
          await sql2`UPDATE "systemSettings" SET value = ${JSON.stringify(config)} WHERE key = 'impresos_temp_access'`;
        } else {
          await sql2`INSERT INTO "systemSettings" (key, value) VALUES ('impresos_temp_access', ${JSON.stringify(config)})`;
        }
        await sql2.end();
        return NextResponse.json({ success: true, code, label, expiresAt, scopeBusinessId, scopeName, url: `https://www.rabbitty.me/impresos?access=${code}` });
      } catch (err) {
        console.error('[QR_IMPRESOS GENERATE_TEMP]', err);
        return NextResponse.json({ success: false, error: 'Error generando acceso' }, { status: 500 });
      }
    }

    if (body?.action === 'REDEEM_TEMP_CODE') {
      try {
        const code = String(body.code || '').trim().toUpperCase();
        if (!/^[A-Z0-9]{8}$/.test(code)) {
          return NextResponse.json({ success: false, error: 'Formato de código inválido' }, { status: 400 });
        }
        const postgres = (await import('postgres')).default;
        const sql = postgres(dbUrl, { ssl: 'require', max: 1 });
        const cfgRows = await sql`SELECT value FROM "systemSettings" WHERE key = 'impresos_temp_access' LIMIT 1`;
        await sql.end();
        let config: Record<string, { label: string; createdAt: string; expiresAt: string; scopeBusinessId?: string | null }> = {};
        try { if (cfgRows[0]?.value) config = JSON.parse(cfgRows[0].value); } catch { config = {}; }
        const entry = config[code];
        if (!entry || new Date(entry.expiresAt).getTime() < Date.now()) {
          return NextResponse.json({ success: false, error: 'Código inválido o expirado' }, { status: 401 });
        }
        return NextResponse.json({ success: true, label: entry.label, expiresAt: entry.expiresAt, scopeBusinessId: entry.scopeBusinessId ?? null });
      } catch (err) {
        console.error('[QR_IMPRESOS REDEEM_TEMP]', err);
        return NextResponse.json({ success: false, error: 'Error validando acceso' }, { status: 500 });
      }
    }
  } catch (err) {
    console.error('[QR_IMPRESOS SET_WELCOME_BUNZ]', err);
    return NextResponse.json({ success: false, error: 'Error al guardar el bono' }, { status: 500 });
  }

  try {
    const postgres = (await import('postgres')).default;
    const sql = postgres(dbUrl, { ssl: 'require', max: 1 });

    const sessionId = crypto.randomUUID();
    const qrToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(qrToken).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    await sql`
      INSERT INTO "webSessions" (id, "jwtToken", "expiresAt")
      VALUES (${sessionId}, ${tokenHash}, ${expiresAt})
    `;

    // ── Gate scaneable por NEÓN: mapear el código de 6 dígitos del RabbittyCode
    //    de esta sesión → {sessionId, token}, para que el decoder de la App
    //    vincule la sesión sin QR cuadrado. ──
    const gateUrl = `https://app.rabbitty.me/scan?qrlogin_${qrToken}`;
    const gateCode = code6FromData(gateUrl);
    const cfgRows = await sql`SELECT value FROM "systemSettings" WHERE key = 'impresos_pending_codes' LIMIT 1`;
    let pending: Record<string, { sessionId: string; token: string; expiresAt: string }> = {};
    try { if (cfgRows[0]?.value) pending = JSON.parse(cfgRows[0].value); } catch { pending = {}; }
    const nowMs = Date.now();
    for (const [k, v] of Object.entries(pending)) {
      if (new Date(v.expiresAt).getTime() < nowMs) delete pending[k];
    }
    pending[String(gateCode)] = { sessionId, token: qrToken, expiresAt: expiresAt.toISOString() };
    if (cfgRows.length > 0) {
      await sql`UPDATE "systemSettings" SET value = ${JSON.stringify(pending)} WHERE key = 'impresos_pending_codes'`;
    } else {
      await sql`INSERT INTO "systemSettings" (key, value) VALUES ('impresos_pending_codes', ${JSON.stringify(pending)})`;
    }

    await sql.end();

    return NextResponse.json({
      success: true,
      sessionId,
      qrToken,
      qrData: gateUrl,
      gateCode: String(gateCode).padStart(6, '0'),
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('[QR_IMPRESOS_GENERATE]', error);
    return NextResponse.json(
      { success: false, error: 'Error al generar sesión QR Neón' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const dbUrl = getDbUrl();
  if (!dbUrl) {
    return NextResponse.json(
      { success: false, error: 'Base de datos no configurada' },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ success: false, error: 'Falta sessionId' }, { status: 400 });
    }

    const postgres = (await import('postgres')).default;
    const sql = postgres(dbUrl, { ssl: 'require', max: 1 });

    const sessions = await sql`
      SELECT id, "userId", "expiresAt"
      FROM "webSessions"
      WHERE id = ${sessionId}
      LIMIT 1
    `;

    if (sessions.length === 0) {
      await sql.end();
      return NextResponse.json({ success: false, error: 'Sesión no encontrada' }, { status: 404 });
    }

    const session = sessions[0];

    if (!session.userId) {
      const isExpired = session.expiresAt && new Date(session.expiresAt) < new Date();
      await sql.end();
      return NextResponse.json({
        success: true,
        authenticated: false,
        expired: Boolean(isExpired),
      });
    }

    // Usuario ya escaneó el QR con la App de Rabbitty
    const userRows = await sql`
      SELECT id, "telegramId", username, "phoneNumber", "firstName", "lastName", email, role
      FROM users
      WHERE id = ${session.userId}
      LIMIT 1
    `;

    if (userRows.length === 0) {
      await sql.end();
      return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 });
    }

    const user = userRows[0];

    // Buscar si tiene negocios afiliados registrados
    const bizRows = await sql`
      SELECT 
        id,
        name,
        category,
        "rewardPercentage",
        address,
        "logoUrl",
        gallery,
        COALESCE(slug, SUBSTRING(id::text, 1, 8)) as "refCode",
        status
      FROM "ownedBusinesses"
      WHERE "ownerId" = ${user.id}
      ORDER BY "createdAt" DESC
    `;

    await sql.end();

    // Bono de bienvenida configurado por tenant (fallback 25)
    let welcomeConfig: Record<string, number> = {};
    try {
      const cfgRows = await sql`SELECT value FROM "systemSettings" WHERE key = 'welcome_bonus_tenant_config' LIMIT 1`;
      if (cfgRows[0]?.value) welcomeConfig = JSON.parse(cfgRows[0].value);
    } catch { welcomeConfig = {}; }

    const usernameNorm = String(user.username || '').toLowerCase().trim();
    const emailNorm = String(user.email || '').toLowerCase().trim();
    const phoneDigits = String(user.phoneNumber || '').replace(/\D/g, '');
    const tgId = String(user.telegramId || '').trim();

    const isAdmin =
      user.role === 'ADMIN' ||
      user.role === 'SUPERADMIN' ||
      tgId === '798431743' ||
      emailNorm === 'marco.munoz9@gmail.com' ||
      ['deltoro', 'mardelbull', 'marco'].includes(usernameNorm) ||
      phoneDigits.endsWith('3222741987');

    const isAffiliate = bizRows.length > 0 || user.role === 'AFFILIATE';

    if (isAdmin) {
      return NextResponse.json({
        success: true,
        authenticated: true,
        authorized: true,
        mode: 'admin',
        user: {
          id: user.id,
          name: user.firstName || user.username || 'Marco (Admin)',
          username: user.username,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: 'ADMIN',
        },
      });
    }

    if (isAffiliate) {
      const primaryBiz = bizRows[0] || null;
      let resolvedLogo = primaryBiz?.logoUrl || null;
      if (!resolvedLogo && primaryBiz?.gallery) {
        try {
          const parsed = JSON.parse(primaryBiz.gallery);
          if (Array.isArray(parsed) && parsed.length > 0) resolvedLogo = parsed[0];
        } catch {
          // ignore
        }
      }

      return NextResponse.json({
        success: true,
        authenticated: true,
        authorized: true,
        mode: 'affiliate',
        user: {
          id: user.id,
          name: user.firstName || user.username || 'Afiliado Rabbitty',
          username: user.username,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: 'AFFILIATE',
        },
        business: primaryBiz
          ? {
              id: primaryBiz.id,
              name: primaryBiz.name,
              category: primaryBiz.category || 'Local Afiliado',
              rewardPercentage: primaryBiz.rewardPercentage || 25,
              address: primaryBiz.address || '',
              logoUrl: resolvedLogo,
              welcomeBunz: welcomeConfig[primaryBiz.id] ?? 25,
              refCode:
                primaryBiz.refCode ||
                String(primaryBiz.name || '')
                  .toLowerCase()
                  .replace(/[^a-z0-9]/g, ''),
            }
          : null,
      });
    }

    // Es un Rabbitter (cliente regular sin negocio ni rol Admin) -> Rechazar acceso a /impresos
    return NextResponse.json({
      success: true,
      authenticated: true,
      authorized: false,
      mode: 'rabbitter',
      user: {
        id: user.id,
        name: user.firstName || user.username || 'Rabbitter',
        role: user.role,
      },
      message:
        'Acceso exclusivo para Negocios Afiliados y Administradores de Rabbitty. Tu cuenta actual es de cliente (Rabbitter).',
    });
  } catch (error) {
    console.error('[QR_IMPRESOS_POLL]', error);
    return NextResponse.json(
      { success: false, error: 'Error al verificar sesión QR Neón' },
      { status: 500 }
    );
  }
}


```

*(411 líneas)*


## 📄 `landing-page/src/app/.well-known/apple-app-site-association/route.ts`

**AASA (rabbitty.me) — route handler con content-type application/json**

```typescript
import { NextResponse } from "next/server";

/** AASA con content-type application/json (iOS exige este tipo para Universal Links). */
export async function GET() {
  const aasa = {
    applinks: {
      details: [
        {
          appIDs: ["FW97275K5X.com.rabbitty.app"],
          components: [
            { "/": "/download*", "comment": "Pósters impresos: miembros abren la app; no instalados → landing con App Store" },
            { "/": "/scan*", "comment": "Escáner / check-in / qrlogin" },
            { "/": "/qr/*", "comment": "QRs de mesa" },
            { "/": "/pay/*", "comment": "Pagos POS" },
            { "/": "/affiliate/*", "comment": "Fichas de afiliados" },
            { "/": "/kiosk-confirm*", "comment": "Identidad del cliente para el kiosko" },
          ],
        },
      ],
    },
  };
  return new NextResponse(JSON.stringify(aasa), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" },
  });
}

```

*(26 líneas)*


## 📄 `telegram-miniapp/public/.well-known/apple-app-site-association`

**AASA (app.rabbitty.me) — Universal Links para /scan*, /download*, /kiosk-confirm***

```
{
  "applinks": {
    "details": [
      {
        "appIDs": [
          "FW97275K5X.com.rabbitty.app"
        ],
        "components": [
          {
            "/": "/scan*",
            "comment": "Tickets QR y vinculaci\u00f3n de mesa"
          },
          {
            "/": "/qr/*"
          },
          {
            "/": "/pay/*"
          },
          {
            "/": "/download*"
          },
          {
            "/": "/affiliate/*"
          },
          {
            "/": "/kiosk-confirm*",
            "comment": "Identidad del cliente para el kiosko"
          }
        ]
      }
    ]
  }
}
```

*(33 líneas)*


## 📄 `telegram-miniapp/src/components/DeepLinkHandler.tsx`

**DEEP LINK HANDLER — Universal Links → rutas internas de la app**

```typescript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

/**
 * Enruta Universal Links (https://app.rabbitty.me/scan?...) y el esquema
 * rabbitty://scan?... al interior de la app nativa. Sin esto, la app se abre
 * pero se queda en la pantalla anterior y el claimToken se pierde.
 */
export default function DeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const route = (rawUrl: string) => {
      try {
        const url = new URL(rawUrl);
        const isScheme = url.protocol === 'rabbitty:';
        const path = isScheme ? `/${url.host}${url.pathname}`.replace(/\/+$/, '') : url.pathname;
        if (path.startsWith('/download')) {
          // Miembro existente escanea un póster: ya tiene la app → su Mi Código
          router.push('/scan?tab=my-code');
          return;
        }
        if (path.startsWith('/kiosk-confirm')) {
          router.push(`${path}${url.search}`);
          return;
        }
        if (path.startsWith('/affiliate')) {
          router.push(`${path}${url.search}`);
          return;
        }
        if (path.startsWith('/scan') || path.startsWith('/qr') || path.startsWith('/pay')) {
          router.push(`${path}${url.search}`);
        }
      } catch {
        // URL inválida: ignorar
      }
    };

    const handle = App.addListener('appUrlOpen', (event) => route(event.url));
    // Cold start: la app se abrió desde el link
    App.getLaunchUrl().then((launch) => { if (launch?.url) route(launch.url); }).catch(() => {});

    return () => { handle.then((h) => h.remove()).catch(() => {}); };
  }, [router]);

  return null;
}

```

*(53 líneas)*


## 📄 `packages/api/src/routers/passkeys.ts`

**PASSKEYS ROUTER (trpc) — registro/verificación server-side con @simplewebauthn**

```typescript
import { z } from "zod";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { verify as verifyTotp } from "otplib";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { router, protectedProcedure, publicLimitedProcedure } from "../trpc";
import { passkeys, users, verificationTokens } from "@rabbitty/database-core";
import { TRPCError } from "@trpc/server";
import { decryptText } from "../services/crypto";

async function requireTotpIfEnabled(coreDb: any, userId: string, code?: string) {
  const [user] = await coreDb.select({ totpEnabled: users.totpEnabled, totpSecret: users.totpSecret }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.totpEnabled) return;
  if (!code || code.length !== 6) throw new TRPCError({ code: "BAD_REQUEST", message: "Se requiere un código de verificación 2FA" });
  const secret = decryptText(user.totpSecret ?? "");
  const result = await verifyTotp({ token: code, secret });
  if (!result.valid) throw new TRPCError({ code: "BAD_REQUEST", message: "Código de verificación inválido" });
}

const rpName = process.env.RP_NAME ?? "Rabbitty Admin";
const rpID = process.env.RP_ID ?? "localhost";
const origin = process.env.ORIGIN ?? `http://${rpID}:3003`;

const challengeMap = new Map<string, string>();

export const passkeysRouter = router({
  generateRegistrationOptions: protectedProcedure.mutation(async ({ ctx }) => {
    const existing = await ctx.coreDb.select({ credentialId: passkeys.credentialId }).from(passkeys).where(eq(passkeys.userId, ctx.userId));
    const excludeCredentials = existing.map((pk) => ({
      id: pk.credentialId,
      transports: [] as AuthenticatorTransportFuture[],
    }));

    const [user] = await ctx.coreDb.select({ email: users.email, firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, ctx.userId)).limit(1);
    const userName = user?.email ?? ctx.userId;
    const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || userName;

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName,
      userDisplayName: displayName,
      attestationType: "none",
      excludeCredentials,
    });

    challengeMap.set(ctx.userId, options.challenge);
    return options;
  }),

  verifyRegistration: protectedProcedure
    .input(z.object({
      credential: z.any(),
      deviceName: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const challenge = challengeMap.get(ctx.userId);
      if (!challenge) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No registration challenge found. Generate one first." });

      const verification = await verifyRegistrationResponse({
        response: input.credential,
        expectedChallenge: challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });

      challengeMap.delete(ctx.userId);

      if (!verification.verified || !verification.registrationInfo) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Verification failed" });
      }

      const { credential } = verification.registrationInfo;

      await ctx.coreDb.insert(passkeys).values({
        userId: ctx.userId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString("base64url"),
        counter: credential.counter,
        transports: JSON.stringify(credential.transports ?? []),
        deviceName: input.deviceName ?? "Passkey",
      });

      return { success: true };
    }),

  generateAuthenticationOptions: publicLimitedProcedure.query(async ({ ctx }) => {
    if (!ctx.userId) {
      const options = await generateAuthenticationOptions({ rpID, allowCredentials: [] });
      return { ...options, allowCredentials: [] };
    }

    const existing = await ctx.coreDb.select({ credentialId: passkeys.credentialId, transports: passkeys.transports }).from(passkeys).where(eq(passkeys.userId, ctx.userId));
    const allowCredentials = existing.map((pk) => ({
      id: pk.credentialId,
      transports: JSON.parse(pk.transports) as AuthenticatorTransportFuture[],
    }));

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
      userVerification: "preferred",
    });

    challengeMap.set(ctx.userId, options.challenge);
    return options;
  }),

  verifyAuthentication: protectedProcedure
    .input(z.object({ credential: z.any() }))
    .mutation(async ({ ctx, input }) => {
      const challenge = challengeMap.get(ctx.userId);
      if (!challenge) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No authentication challenge found" });

      const [cred] = await ctx.coreDb.select().from(passkeys).where(eq(passkeys.userId, ctx.userId)).limit(1);
      if (!cred) throw new TRPCError({ code: "NOT_FOUND", message: "No passkey found for this user" });

      const verification = await verifyAuthenticationResponse({
        response: input.credential,
        expectedChallenge: challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: cred.credentialId,
          publicKey: Buffer.from(cred.publicKey, "base64url"),
          counter: cred.counter,
          transports: JSON.parse(cred.transports) as AuthenticatorTransportFuture[],
        },
      });

      challengeMap.delete(ctx.userId);

      if (!verification.verified) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Passkey verification failed" });
      }

      await ctx.coreDb.update(passkeys).set({ counter: verification.authenticationInfo.newCounter }).where(eq(passkeys.id, cred.id));

      return { success: true, credentialId: cred.id };
    }),

  // ── LOGIN con passkey (público): options → verify → token single-use para NextAuth ──
  loginOptions: publicLimitedProcedure.mutation(async ({ ctx }) => {
    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: [], // discoverable credentials (Face ID elige la passkey)
      userVerification: "required",
    });
    const loginId = crypto.randomBytes(16).toString("hex");
    await ctx.coreDb.insert(verificationTokens).values({
      identifier: `pk_challenge:${loginId}`,
      token: options.challenge,
      expires: new Date(Date.now() + 3 * 60 * 1000),
    });
    return { options, loginId };
  }),

  loginVerify: publicLimitedProcedure
    .input(z.object({ response: z.any(), loginId: z.string().min(10) }))
    .mutation(async ({ ctx, input }) => {
      const idKey = `pk_challenge:${input.loginId}`;
      const [challengeRow] = await ctx.coreDb
        .select()
        .from(verificationTokens)
        .where(eq(verificationTokens.identifier, idKey))
        .limit(1);
      if (!challengeRow || new Date(challengeRow.expires) < new Date()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Challenge expirado. Intenta de nuevo." });
      }
      const challenge = challengeRow.token;

      // Localizar la credencial por rawId
      let credentialId = "";
      try {
        const resp = input.response as { id?: string; rawId?: string };
        credentialId = resp.id || resp.rawId || "";
      } catch {}
      if (!credentialId) throw new TRPCError({ code: "BAD_REQUEST", message: "Respuesta inválida" });

      const [cred] = await ctx.coreDb.select().from(passkeys).where(eq(passkeys.credentialId, credentialId)).limit(1);
      if (!cred) throw new TRPCError({ code: "NOT_FOUND", message: "Passkey no registrada en este servidor" });

      const verification = await verifyAuthenticationResponse({
        response: input.response,
        expectedChallenge: challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: cred.credentialId,
          publicKey: Buffer.from(cred.publicKey, "base64url"),
          counter: cred.counter,
          transports: JSON.parse(cred.transports || "[]") as AuthenticatorTransportFuture[],
        },
      });
      if (!verification.verified) throw new TRPCError({ code: "BAD_REQUEST", message: "Verificación fallida" });

      await ctx.coreDb.update(passkeys).set({ counter: verification.authenticationInfo.newCounter }).where(eq(passkeys.id, cred.id));
      // challenge single-use
      await ctx.coreDb.delete(verificationTokens).where(eq(verificationTokens.identifier, idKey));

      const [user] = await ctx.coreDb.select({ email: users.email, firstName: users.firstName }).from(users).where(eq(users.id, cred.userId)).limit(1);
      const email = (user?.email || `passkey-${cred.userId}@rabbitty.me`).toLowerCase();

      // Token single-use (5 min) para el proveedor NextAuth "passkey"
      const loginToken = crypto.randomBytes(32).toString("hex");
      await ctx.coreDb.insert(verificationTokens).values({
        identifier: `pk_login:${email}`,
        token: loginToken,
        expires: new Date(Date.now() + 5 * 60 * 1000),
      });

      return { success: true, token: loginToken, email };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.coreDb.select({
      id: passkeys.id,
      deviceName: passkeys.deviceName,
      createdAt: passkeys.createdAt,
    }).from(passkeys).where(eq(passkeys.userId, ctx.userId)).orderBy(passkeys.createdAt);
  }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid(), verificationCode: z.string().length(6).optional() }))
    .mutation(async ({ ctx, input }) => {
      await requireTotpIfEnabled(ctx.coreDb, ctx.userId, input.verificationCode);
      const [existing] = await ctx.coreDb.select().from(passkeys).where(eq(passkeys.id, input.id)).limit(1);
      if (!existing || existing.userId !== ctx.userId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      await ctx.coreDb.delete(passkeys).where(eq(passkeys.id, input.id));
      return { success: true };
    }),
});

```

*(240 líneas)*


## 📄 `apps/admin/src/app/api/auth/2fa/passkey/route.ts`

**2FA PASSKEY (gate unlock) — registro + unlock del God Admin**

```typescript
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@rabbitty/auth";
import { getCoreDb } from "@rabbitty/api/db";
import { systemSettings } from "@rabbitty/database-core";
import { eq } from "drizzle-orm";
import {
  isGodAdminIdentity,
  cborDecodeFull,
  verifyGod2faCookieValue,
  issueGod2faCookieValue,
  GOD_2FA_COOKIE,
  createWebauthnChallenge,
  popWebauthnChallenge,
  parseAuthData,
  coseKeyToJwk,
  verifyPasskeySignature,
  expectedRpIdHash,
  b64urlDecode,
  b64urlEncode,
  type StoredPasskey,
} from "@rabbitty/api/services/god2fa";

export const runtime = "nodejs";

const PASSKEYS_KEY = "god_admin_passkeys";

function readGod2faCookie(req: NextRequest): string | undefined {
  return req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("god2fa="))
    ?.slice(7);
}

async function loadPasskeys(): Promise<StoredPasskey[]> {
  const db = getCoreDb();
  const [row] = await db.select().from(systemSettings).where(eq(systemSettings.key, PASSKEYS_KEY)).limit(1);
  if (!row?.value) return [];
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? (parsed as StoredPasskey[]) : [];
  } catch {
    return [];
  }
}

async function savePasskeys(list: StoredPasskey[]): Promise<void> {
  const db = getCoreDb();
  const [row] = await db.select().from(systemSettings).where(eq(systemSettings.key, PASSKEYS_KEY)).limit(1);
  if (row) {
    await db.update(systemSettings).set({ value: JSON.stringify(list), updatedAt: new Date() }).where(eq(systemSettings.key, PASSKEYS_KEY));
  } else {
    await db.insert(systemSettings).values({ key: PASSKEYS_KEY, value: JSON.stringify(list) });
  }
}

function rpIdFrom(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "admin.rabbitty.me";
  return host.split(":")[0];
}

function bufferToB64(buf: ArrayBuffer): string {
  return b64urlEncode(Buffer.from(new Uint8Array(buf)));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email || "";
  const name = session?.user?.name || "";
  if (!isGodAdminIdentity(email, name)) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Body inválido" }, { status: 400 });
  }
  const action = String(body.action || "");
  const rpId = rpIdFrom(req);

  // ── Registrar nueva passkey: requiere 2FA TOTP ya verificado en esta sesión ──
  if (action === "register_options") {
    if (!verifyGod2faCookieValue(readGod2faCookie(req))) {
      return NextResponse.json({ success: false, error: "Verifica tu 2FA antes de registrar una passkey" }, { status: 401 });
    }
    const challenge = createWebauthnChallenge(`reg:${email}`);
    return NextResponse.json({
      success: true,
      challenge,
      rp: { id: rpId, name: "Rabbitty God Admin" },
      user: {
        id: b64urlEncode(crypto.createHash("sha256").update(email).digest()),
        name: email,
        displayName: "God Admin",
      },
    });
  }

  if (action === "register_verify") {
    if (!verifyGod2faCookieValue(readGod2faCookie(req))) {
      return NextResponse.json({ success: false, error: "Sesión 2FA expirada" }, { status: 401 });
    }
    try {
      const clientDataJSON = b64urlDecode(String(body.clientDataJSON));
      const clientData = JSON.parse(clientDataJSON.toString("utf8")) as { challenge: string; origin: string; type: string };
      if (clientData.type !== "webauthn.create") throw new Error("Tipo de ceremony inválido");
      if (!popWebauthnChallenge(`reg:${email}`, clientData.challenge)) throw new Error("Challenge inválido o expirado");
      const origin = `https://${rpId}`;
      if (!clientData.origin.endsWith(rpId)) throw new Error(`Origen no permitido: ${clientData.origin}`);

      const attestationObject = b64urlDecode(String(body.attestationObject));
      const decoded = cborDecodeFull(attestationObject) as Record<string, unknown>;
      const authDataBuf = Buffer.from(
        decoded.authData instanceof ArrayBuffer
          ? new Uint8Array(decoded.authData)
          : (decoded.authData as Uint8Array)
      );
      const parsed = parseAuthData(authDataBuf);
      if (!parsed.credId || !parsed.coseKey) throw new Error("authData sin credencial");
      const jwk = coseKeyToJwk(parsed.coseKey);
      if (!jwk) throw new Error("Algoritmo no soportado (solo ES256/P-256)");

      const passkeys = await loadPasskeys();
      const credIdB64 = b64urlEncode(parsed.credId);
      if (passkeys.some((p) => p.credId === credIdB64)) throw new Error("Passkey ya registrada");
      passkeys.push({
        credId: credIdB64,
        publicKeyJwk: jwk,
        signCount: parsed.signCount,
        label: String(body.label || `Passkey ${passkeys.length + 1}`),
        createdAt: new Date().toISOString(),
      });
      await savePasskeys(passkeys);
      return NextResponse.json({ success: true, total: passkeys.length });
    } catch (err) {
      return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Registro fallido" }, { status: 400 });
    }
  }

  // ── Unlock biométrico: reemplaza el TOTP en dispositivos de confianza ──
  if (action === "unlock_options") {
    const passkeys = await loadPasskeys();
    if (passkeys.length === 0) {
      return NextResponse.json({ success: false, error: "Sin passkeys registradas. Entra con TOTP y registra una en Configuración." }, { status: 404 });
    }
    const challenge = createWebauthnChallenge(`unlock:${email}`);
    return NextResponse.json({
      success: true,
      challenge,
      allowCredentialIds: passkeys.map((p) => p.credId),
    });
  }

  if (action === "unlock_verify") {
    try {
      const clientDataJSON = b64urlDecode(String(body.clientDataJSON));
      const clientData = JSON.parse(clientDataJSON.toString("utf8")) as { challenge: string; origin: string; type: string };
      if (clientData.type !== "webauthn.get") throw new Error("Tipo de ceremony inválido");
      if (!popWebauthnChallenge(`unlock:${email}`, clientData.challenge)) throw new Error("Challenge inválido o expirado");
      if (!clientData.origin.endsWith(rpId)) throw new Error("Origen no permitido");

      const authDataBuf = b64urlDecode(String(body.authenticatorData));
      const signature = b64urlDecode(String(body.signature));
      const presentedCredId = b64urlDecode(String(body.credentialId));

      const passkeys = await loadPasskeys();
      const match = passkeys.find((p) => p.credId === b64urlEncode(presentedCredId));
      if (!match) throw new Error("Passkey no registrada en este servidor");

      const parsed = parseAuthData(authDataBuf);
      if (!parsed.flags || !(parsed.flags & 0x01)) throw new Error("User presence no verificada");
      if (!(parsed.flags & 0x04)) throw new Error("User verification (biometría) requerida");
      if (Buffer.compare(parsed.rpIdHash, expectedRpIdHash(rpId)) !== 0) throw new Error("rpIdHash no coincide");
      if (parsed.signCount < match.signCount && match.signCount > 0) throw new Error("Contador de firma sospechoso (posible clon)");

      const ok = verifyPasskeySignature(match.publicKeyJwk, authDataBuf, clientDataJSON, signature);
      if (!ok) throw new Error("Firma inválida");

      // Actualizar signCount
      match.signCount = parsed.signCount;
      await savePasskeys(passkeys);

      const res = NextResponse.json({ success: true });
      res.cookies.set(GOD_2FA_COOKIE, issueGod2faCookieValue(), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 12 * 60 * 60,
        path: "/",
      });
      return res;
    } catch (err) {
      return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Verificación fallida" }, { status: 401 });
    }
  }

  // ── Listar / eliminar passkeys (requiere 2FA verificado) ──
  if (action === "list") {
    if (!verifyGod2faCookieValue(readGod2faCookie(req))) {
      return NextResponse.json({ success: false, error: "Verifica tu 2FA" }, { status: 401 });
    }
    const passkeys = await loadPasskeys();
    return NextResponse.json({
      success: true,
      passkeys: passkeys.map((p) => ({ credId: p.credId, label: p.label, createdAt: p.createdAt })),
    });
  }

  if (action === "delete") {
    if (!verifyGod2faCookieValue(readGod2faCookie(req))) {
      return NextResponse.json({ success: false, error: "Verifica tu 2FA" }, { status: 401 });
    }
    const passkeys = await loadPasskeys();
    const next = passkeys.filter((p) => p.credId !== String(body.credId));
    await savePasskeys(next);
    return NextResponse.json({ success: true, total: next.length });
  }

  return NextResponse.json({ success: false, error: "Acción desconocida" }, { status: 400 });
}

```

*(224 líneas)*


## 📄 `apps/admin/src/app/api/auth/2fa/grant/route.ts`

**2FA GRANT — emite la cookie god2fa tras verificación**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@rabbitty/auth";
import {
  isGodAdminIdentity,
  issueGod2faCookieValue,
  GOD_2FA_COOKIE,
} from "@rabbitty/api/services/god2fa";

export const runtime = "nodejs";

/** POST /api/auth/2fa/grant — emite la cookie god2fa tras verificación exitosa. */
export async function POST(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email || "";
  const name = session?.user?.name || "";

  if (!isGodAdminIdentity(email, name)) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(GOD_2FA_COOKIE, issueGod2faCookieValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 12 * 60 * 60,
    path: "/",
  });
  return res;
}

```

*(30 líneas)*


## 📄 `packages/api/src/services/god2fa.ts`

**GOD2FA SERVICE — cookie firmada, impersonación, TOTP, WebAuthn helpers**

```typescript
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
  return process.env.GOD_ADMIN_TOTP_SECRET || "dev-only-god2fa-signing-key";
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

// ── Rate limit simple de intentos 2FA (en memoria, por IP) ──
const attempts = new Map<string, { count: number; resetAt: number }>();
export function check2faRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + 5 * 60 * 1000 });
    return true;
  }
  entry.count += 1;
  return entry.count <= 8; // 8 intentos / 5 min
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

```

*(278 líneas)*


## 📄 `apps/admin/src/app/verify-2fa/page.tsx`

**VERIFY-2FA — pantalla de verificación (TOTP + Face ID/passkey)**

```typescript
"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Lock, ArrowRight, Fingerprint, Loader2 } from "lucide-react";
import { Button, Input, cn } from "@rabbitty/ui";

export default function Verify2FAPage() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<{ required: boolean; verified: boolean; totpConfigured: boolean } | null>(null);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const b64 = (bytes: Uint8Array) => {
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s);
  };

  useEffect(() => {
    fetch("/api/auth/2fa/verify")
      .then((r) => r.json())
      .then((d) => {
        setStatus(d);
        if (d.verified) window.location.href = "/";
      })
      .catch(() => setStatus({ required: true, verified: false, totpConfigured: true }));
  }, []);

  useEffect(() => {
    if (code.length === 6 && !loading) void submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const submit = async () => {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (data.success) {
        window.location.href = "/";
        return;
      }
      setError(data.error || "Código incorrecto");
      setCode("");
      inputRef.current?.focus();
    } catch {
      setError("Error de red");
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  const unlockWithPasskey = async () => {
    setPasskeyLoading(true);
    setError('');
    try {
      // 1. Options del server (trpc — passkeys del god admin)
      const optRes = await fetch('/api/trpc/passkeys.generateAuthenticationOptions?batch=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ '0': { json: null } }),
      });
      const optData = await optRes.json();
      if (optData?.[0]?.error) throw new Error(optData[0].error.message);
      const options = optData[0].result.data.json;

      // 2. Face ID / Touch ID
      const b64u = (s2: string) => s2.replace(/-/g, '+').replace(/_/g, '/');
      const fromB64u = (s2: string) => Uint8Array.from(atob(b64u(s2)), (c) => c.charCodeAt(0));
      const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));

      const cred = await navigator.credentials.get({
        publicKey: {
          challenge: fromB64u(options.challenge),
          userVerification: 'required',
          timeout: 60000,
          rpId: options.rpId,
        },
      });
      if (!cred) throw new Error('Sin credencial');
      const pk = cred as PublicKeyCredential;
      const resp = pk.response as unknown as AuthenticatorAssertionResponse;

      // 3. Verificación server-side (trpc.passkeys — @simplewebauthn)
      const verRes = await fetch('/api/trpc/passkeys.verifyAuthentication?batch=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ '0': { json: { credential: {
          id: toB64(new Uint8Array(pk.rawId)),
          rawId: toB64(new Uint8Array(pk.rawId)),
          type: pk.type,
          response: {
            authenticatorData: toB64(new Uint8Array(resp.authenticatorData)),
            clientDataJSON: toB64(new Uint8Array(resp.clientDataJSON)),
            signature: toB64(new Uint8Array(resp.signature)),
            userHandle: resp.userHandle ? toB64(new Uint8Array(resp.userHandle)) : undefined,
          },
          clientExtensionResults: {},
        } } } }),
      });
      const verData = await verRes.json();
      if (verData?.[0]?.error) throw new Error(verData[0].error.message);

      // 4. Canjear el unlockCode por la cookie god2fa
      const grantRes = await fetch('/api/auth/2fa/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verified: true }),
      });
      const grantData = await grantRes.json();
      if (!grantData?.success) throw new Error(grantData?.error || 'No se pudo otorgar el acceso');
      window.location.href = '/';
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : 'Error';
      setError(m.includes('NotAllowed') ? 'Biometría cancelada' : m);
    } finally {
      setPasskeyLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050508] p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm rounded-[2rem] border border-white/10 bg-[#0e0e14] p-8 shadow-2xl"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="p-4 rounded-2xl bg-linear-to-br from-pink-600/20 to-purple-600/20 border border-pink-500/30">
            <ShieldCheck className="h-8 w-8 text-pink-400" />
          </div>
          <h1 className="text-xl font-black text-white">Verificación God Admin</h1>
          <p className="text-xs text-gray-400 leading-relaxed">
            Tu cuenta requiere doble factor. Ingresa el código de 6 dígitos de tu app de autenticación.
          </p>
        </div>

        <div className="mt-6 space-y-3">
          <Input
            ref={inputRef as never}
            autoFocus
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="••••••"
            className="text-center text-2xl font-black tracking-[0.5em] h-14 bg-black/60 border-white/15 text-white"
          />

          {error && <p className="text-[11px] font-bold text-rose-400 text-center">{error}</p>}

          <Button
            onClick={submit}
            disabled={code.length !== 6 || loading}
            className="w-full h-12 rounded-xl bg-linear-to-r from-pink-600 to-purple-600 font-black text-white shadow-lg cursor-pointer disabled:opacity-40"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4 mr-1" />}
            {loading ? "Verificando..." : "Verificar y Entrar"}
          </Button>

          <div className="flex items-center gap-3 py-1">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-[10px] font-bold text-gray-500 uppercase">o</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <Button
            variant="secondary"
            onClick={unlockWithPasskey}
            disabled={passkeyLoading}
            className={cn(
              "w-full h-11 rounded-xl bg-white/5 border border-white/10 font-bold text-gray-200 hover:bg-white/10 cursor-pointer disabled:opacity-40"
            )}
          >
            {passkeyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4 mr-1 text-cyan-400" />}
            {passkeyLoading ? "Esperando biometría..." : "Usar Face ID / Touch ID (passkey)"}
          </Button>

          {status && !status.totpConfigured && (
            <p className="text-[11px] text-amber-400 text-center font-bold">
              ⚠️ El servidor no tiene GOD_ADMIN_TOTP_SECRET configurado.
            </p>
          )}
        </div>

        <p className="mt-6 text-[10px] text-gray-600 text-center leading-relaxed">
          Código de un solo uso con ventana de 30s · 8 intentos cada 5 min · Sesión 2FA válida por 12h
        </p>
      </motion.div>
    </div>
  );
}

```

*(203 líneas)*


## 📄 `packages/auth/src/auth.ts`

**NEXTAUTH — proveedores (passkey, email-token, magic-link, telegram) + fail-fast AUTH_SECRET**

```typescript
import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import Credentials from "next-auth/providers/credentials";
import crypto, { createHash } from "crypto";
import { getCoreDb } from "@rabbitty/api/db";
import { verificationTokens, users } from "@rabbitty/database-core";
import { eq, sql } from "drizzle-orm";

if (process.env.NODE_ENV === "production") {
  if (!process.env.AUTH_URL || process.env.AUTH_URL.includes("localhost")) {
    process.env.AUTH_URL = "https://admin.rabbitty.me";
  }
  if (!process.env.NEXTAUTH_URL || process.env.NEXTAUTH_URL.includes("localhost")) {
    process.env.NEXTAUTH_URL = "https://admin.rabbitty.me";
  }
}

// DB-backed admin user store (for email/magic link authentication)
const NEON_URL = process.env.CORE_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL;

async function getPool() {
  if (!NEON_URL) {
    throw new Error(
      "[Auth] Database URL not configured: set CORE_DATABASE_URL (or DATABASE_URL / POSTGRES_URL)."
    );
  }
  const { default: pg } = await import("pg");
  const { Pool } = pg;
  return new Pool({ connectionString: NEON_URL, max: 3 });
}

// Ensure admin_auth_users table exists
async function ensureAdminUsersTable() {
  const pool = await getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "adminAuthUsers" (
      "id" text PRIMARY KEY,
      "email" text NOT NULL UNIQUE,
      "emailVerified" timestamptz,
      "name" text,
      "image" text,
      "createdAt" timestamptz DEFAULT now()
    )
  `);
  await pool.end();
}

// Run once at startup
ensureAdminUsersTable().catch(e => console.error("[Auth] Failed to ensure adminAuthUsers table:", e));

const customAdapter: any = {
  createUser: async (user: any) => {
    const newUser = {
      id: user.id || crypto.randomUUID(),
      email: user.email,
      emailVerified: user.emailVerified ? new Date(user.emailVerified) : null,
      name: user.name ?? null,
      image: user.image ?? null,
    };
    try {
      const pool = await getPool();
      await pool.query(
        `INSERT INTO "adminAuthUsers" ("id", "email", "emailVerified", "name", "image")
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT ("email") DO UPDATE SET "emailVerified" = EXCLUDED."emailVerified"`,
        [newUser.id, newUser.email, newUser.emailVerified, newUser.name, newUser.image]
      );
      const result = await pool.query(`SELECT * FROM "adminAuthUsers" WHERE "email" = $1`, [newUser.email]);
      await pool.end();
      return result.rows[0] ?? newUser;
    } catch (e) {
      console.error("[Auth DB] createUser error:", e);
      return newUser;
    }
  },
  getUser: async (id: string) => {
    try {
      const pool = await getPool();
      const result = await pool.query(`SELECT * FROM "adminAuthUsers" WHERE "id" = $1`, [id]);
      await pool.end();
      return result.rows[0] ?? null;
    } catch {
      return null;
    }
  },
  getUserByEmail: async (email: string) => {
    try {
      const pool = await getPool();
      const result = await pool.query(`SELECT * FROM "adminAuthUsers" WHERE "email" = $1`, [email]);
      await pool.end();
      return result.rows[0] ?? null;
    } catch {
      return null;
    }
  },
  getUserByAccount: async () => null,
  updateUser: async (user: any) => {
    try {
      const pool = await getPool();
      await pool.query(
        `UPDATE "adminAuthUsers" SET "emailVerified" = $1, "name" = $2 WHERE "id" = $3`,
        [user.emailVerified ?? null, user.name ?? null, user.id]
      );
      const result = await pool.query(`SELECT * FROM "adminAuthUsers" WHERE "id" = $1`, [user.id]);
      await pool.end();
      return result.rows[0] ?? user;
    } catch {
      return user;
    }
  },
  // Required by NextAuth when using Email provider — must exist even if empty
  linkAccount: async () => null,
  createVerificationToken: async (verificationToken: any) => {
    try {
      const db = getCoreDb();
      await db.insert(verificationTokens).values({
        identifier: verificationToken.identifier,
        token: verificationToken.token,
        expires: new Date(verificationToken.expires),
      }).onConflictDoNothing();
    } catch (e) {
      console.error("[Auth DB Error] Error saving verification token:", e);
    }
    return verificationToken;
  },
  useVerificationToken: async ({ identifier, token }: any) => {
    try {
      const db = getCoreDb();
      const [stored] = await db
        .select()
        .from(verificationTokens)
        .where(eq(verificationTokens.token, token));
      if (stored) {
        await db.delete(verificationTokens).where(eq(verificationTokens.token, token));
        return { identifier: stored.identifier, token: stored.token, expires: stored.expires };
      }
    } catch (e) {
      console.error("[Auth DB Error] Error using verification token:", e);
    }
    return null;
  },
};

  // ── Fail-fast SOLO en runtime: durante el build (sin envs) usamos un secreto
  //    efímero que jamás sirve tráfico; en runtime de producción sin AUTH_SECRET
  //    el panel se niega a arrancar antes que firmar sesiones con llave pública. ──
  function resolveAuthSecret(): string {
    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
    if (secret && secret.length >= 32) return secret;
    if (process.env.NEXT_PHASE === "phase-production-build") {
      return crypto.randomBytes(32).toString("hex");
    }
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "[Auth] AUTH_SECRET no configurado (mínimo 32 caracteres). El panel de administración se niega a firmar sesiones con un secreto hardcodeado."
      );
    }
    return "rabbitty-dev-secret-do-not-use-in-production-0123456789";
  }

const authResult = NextAuth({
  adapter: customAdapter,
  session: { strategy: "jwt" },
  trustHost: true,
  secret: resolveAuthSecret(),
  providers: [
    Resend({
      from: process.env.AUTH_RESEND_FROM || "Rabbitty Team <hola@rabbitty.me>",
      apiKey: process.env.RESEND_API_KEY || process.env.AUTH_RESEND_KEY || process.env.RESEND_KEY,
      async sendVerificationRequest({ identifier: email, url }) {
        const apiKey = process.env.RESEND_API_KEY || process.env.AUTH_RESEND_KEY || process.env.RESEND_KEY;
        if (!apiKey) {
          console.error("[Auth Resend] API Key no encontrada");
          return;
        }

        const targetOrigin = "https://admin.rabbitty.me";

        // We build our OWN token and confirm page URL so we bypass NextAuth's CSRF cookie
        // requirement AND its internal token hashing. We delete the token NextAuth just
        // inserted, and insert our own raw UUID token.
        const myToken = crypto.randomUUID();
        try {
          const db = getCoreDb();
          await db.delete(verificationTokens).where(eq(verificationTokens.identifier, email));
          await db.insert(verificationTokens).values({
            identifier: email,
            token: myToken,
            expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          });
        } catch (e) {
          console.error("[Auth Resend] Error replacing token in DB:", e);
        }

        // /magic-confirm verifies token server-side without CSRF cookies
        const finalUrl = `${targetOrigin}/magic-confirm?token=${encodeURIComponent(myToken)}&email=${encodeURIComponent(email)}`;

        const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Acceso Mágico - Rabbitty Admin</title>
</head>
<body style="margin: 0; padding: 0; background-color: #050508; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ffffff;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #050508; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" max-width="560" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #0e0e14; border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 40px; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
          <!-- Header Logo -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="background: linear-gradient(135deg, #ec4899 0%, #a855f7 100%); border-radius: 16px; padding: 12px 20px;">
                    <span style="font-size: 20px; font-weight: 900; color: #ffffff; letter-spacing: 2px;">RABBITTY ADMIN</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Title -->
          <tr>
            <td align="center" style="padding-bottom: 16px;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">Acceso Mágico a tu Panel</h1>
            </td>
          </tr>

          <!-- Description -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #a1a1aa;">
                Has solicitado un enlace directo para ingresar a tu panel de administración con la cuenta <strong style="color: #ffffff;">${email}</strong>.
              </p>
            </td>
          </tr>

          <!-- Button CTA -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <a href="${finalUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); color: #ffffff; font-size: 15px; font-weight: 800; text-decoration: none; padding: 16px 36px; border-radius: 14px; box-shadow: 0 8px 25px rgba(236,72,153,0.35);">
                🚀 Ingresar a mi Panel de Administración
              </a>
            </td>
          </tr>

          <!-- Security note -->
          <tr>
            <td align="center" style="border-t: 1px solid rgba(255,255,255,0.08); padding-top: 24px;">
              <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #71717a;">
                Si no solicitaste este correo, puedes ignorarlo de manera segura. El enlace expirará automáticamente.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `;

        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: process.env.AUTH_RESEND_FROM || "Rabbitty Team <hola@rabbitty.me>",
              to: email,
              subject: "🔑 Acceso Mágico a tu Panel - Rabbitty Admin",
              html,
            }),
          });
          const data = await res.json();
          console.log("[Auth Resend] Email enviado:", data);
        } catch (err) {
          console.error("[Auth Resend Error]:", err);
        }
      },
    }),
    ...(process.env.E2E_TEST === "true" && process.env.NODE_ENV !== "production" ? [
      Credentials({
        id: "test-e2e",
        name: "E2E Test",
        credentials: {
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials) {
          if (credentials?.password === "test") {
            return { id: "e2e-test-user", name: "E2E Tester", email: "e2e@test.me" };
          }
          return null;
        },
      }),
    ] : []),
    Credentials({
      id: "telegram",
      name: "Telegram",
      credentials: {
        id: { label: "Telegram ID", type: "text" },
        username: { label: "Username", type: "text" },
        firstName: { label: "First Name", type: "text" },
        lastName: { label: "Last Name", type: "text" },
        photoUrl: { label: "Photo URL", type: "text" },
        authDate: { label: "Auth Date", type: "text" },
        hash: { label: "Hash", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.id || !credentials?.hash) return null;

        const botToken = process.env.AUTH_TELEGRAM_BOT_TOKEN;
        if (!botToken) return null;

        const dataCheckString = [
          `auth_date=${credentials.authDate ?? ""}`,
          `first_name=${credentials.firstName ?? ""}`,
          `id=${credentials.id}`,
          ...(credentials.lastName ? [`last_name=${credentials.lastName}`] : []),
          ...(credentials.photoUrl ? [`photo_url=${credentials.photoUrl}`] : []),
          `username=${credentials.username ?? ""}`,
        ].join("\n");

        const secretKey = crypto.createHash("sha256").update(botToken).digest();
        const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

        if (computedHash !== credentials.hash) return null;

        const authDate = parseInt(credentials.authDate as string, 10);
        if (Number.isNaN(authDate) || Date.now() / 1000 - authDate > 86400) return null;

        return {
          id: credentials.id as string,
          name: [credentials.firstName, credentials.lastName].filter(Boolean).join(" "),
          email: `${credentials.id}@telegram.rabbitty`,
          image: (credentials.photoUrl as string) ?? undefined,
        };
      },
    }),
    Credentials({
      id: "email-token",
      name: "Email Token",
      credentials: {
        token: { label: "Token", type: "text" },
        email: { label: "Email", type: "email" },
      },
      async authorize(credentials) {
        if (!credentials?.token || !credentials?.email) return null;

        try {
          const db = getCoreDb();

          // 1. Find the token in DB
          const [stored] = await db
            .select()
            .from(verificationTokens)
            .where(eq(verificationTokens.token, credentials.token as string));

          if (!stored) {
            console.warn("[email-token] Token no encontrado:", credentials.email);
            return null;
          }

          // 2. Check expiry
          if (new Date(stored.expires) < new Date()) {
            await db.delete(verificationTokens).where(eq(verificationTokens.token, credentials.token as string));
            console.warn("[email-token] Token expirado:", credentials.email);
            return null;
          }

          // 3. Verify email or identifier matches
          const credClean = (credentials.email as string).trim().toLowerCase();
          const storedClean = stored.identifier.trim().toLowerCase();
          let isMatch = storedClean === credClean;
          
          let resolvedEmail = stored.identifier;

          if (!isMatch) {
            const credDigits = credClean.replace(/\D/g, "");
            const storedDigits = storedClean.replace(/\D/g, "");

            // Comparación de dígitos telefónicos si ambos son números
            if (
              credDigits.length >= 8 &&
              storedDigits.length >= 8 &&
              (credDigits.endsWith(storedDigits.slice(-10)) || storedDigits.endsWith(credDigits.slice(-10)))
            ) {
              isMatch = true;
            } else if (credDigits.length >= 8) {
              // El usuario envió un teléfono pero el token se guardó con su correo (o viceversa)
              const [userByPhone] = await db
                .select({ id: users.id, email: users.email })
                .from(users)
                .where(sql`regexp_replace(${users.phoneNumber}, '\\D', '', 'g') LIKE ${'%' + credDigits.slice(-10)}`)
                .limit(1);

              if (userByPhone && userByPhone.email?.toLowerCase() === storedClean) {
                isMatch = true;
                resolvedEmail = userByPhone.email;
              }
            } else if (storedDigits.length >= 8) {
              // El token se guardó con teléfono y el usuario envió correo
              const [userByEmail] = await db
                .select({ id: users.id, phoneNumber: users.phoneNumber })
                .from(users)
                .where(eq(users.email, credClean))
                .limit(1);

              if (userByEmail && userByEmail.phoneNumber) {
                const userPhoneDigits = userByEmail.phoneNumber.replace(/\D/g, "");
                if (userPhoneDigits.endsWith(storedDigits.slice(-10))) {
                  isMatch = true;
                  resolvedEmail = credClean;
                }
              }
            }

            if (!isMatch) {
              console.warn("[email-token] Email mismatch", stored.identifier, credentials.email);
              return null;
            }
          }

          // 4. Consume token (single-use)
          await db.delete(verificationTokens).where(eq(verificationTokens.token, credentials.token as string));

          // If identifier has @, use it for adminAuthUsers; otherwise find email from users table
          if (!resolvedEmail.includes("@")) {
            const digits = resolvedEmail.replace(/\D/g, "");
            const [u] = await db
              .select({ email: users.email })
              .from(users)
              .where(sql`regexp_replace(${users.phoneNumber}, '\\D', '', 'g') LIKE ${'%' + digits.slice(-10)}`)
              .limit(1);
            if (u && u.email) {
              resolvedEmail = u.email;
            } else {
              resolvedEmail = `${digits}@phone.rabbitty.me`;
            }
          }

          // 5. Upsert user and return
          const pool = await getPool();
          await pool.query(
            `INSERT INTO "adminAuthUsers" ("id", "email", "emailVerified")
             VALUES (gen_random_uuid()::text, $1, NOW())
             ON CONFLICT ("email") DO UPDATE SET "emailVerified" = NOW()`,
            [resolvedEmail]
          );
          const res = await pool.query(
            `SELECT "id", "email" FROM "adminAuthUsers" WHERE "email" = $1`,
            [resolvedEmail]
          );
          await pool.end();

          const user = res.rows[0];
          if (!user) return null;

          console.log("[email-token] ✅ Sesión creada para:", user.email);
          return { id: user.id, email: user.email, name: user.email };
        } catch (err) {
          console.error("[email-token] Error:", err);
          return null;
        }
      },
    }),
    Credentials({
      id: "passkey",
      name: "Passkey",
      credentials: {
        token: { label: "Token", type: "text" },
        email: { label: "Email", type: "email" },
      },
      async authorize(credentials) {
        if (!credentials?.token || !credentials?.email) return null;
        try {
          const db = getCoreDb();
          const identifier = `pk_login:${(credentials.email as string).trim().toLowerCase()}`;
          // Single-use atómico: buscar y borrar el token en un solo paso
          const [row] = await db
            .select()
            .from(verificationTokens)
            .where(eq(verificationTokens.token, credentials.token as string))
            .limit(1);
          if (!row || row.identifier !== identifier) return null;
          if (new Date(row.expires) < new Date()) return null;
          await db.delete(verificationTokens).where(eq(verificationTokens.token, credentials.token as string));

          // Upsert adminAuthUsers (misma ruta que el email-token provider)
          const pool = await getPool();
          await pool.query(
            `INSERT INTO "adminAuthUsers" ("id", "email", "emailVerified")
             VALUES (gen_random_uuid()::text, $1, NOW())
             ON CONFLICT ("email") DO UPDATE SET "emailVerified" = NOW()`,
            [(credentials.email as string).trim().toLowerCase()]
          );
          const res = await pool.query(`SELECT "id", "email" FROM "adminAuthUsers" WHERE "email" = $1`, [(credentials.email as string).trim().toLowerCase()]);
          await pool.end();
          const user = res.rows[0];
          if (!user) return null;
          console.log("[passkey] ✅ Login con passkey:", user.email);
          return { id: user.id, email: user.email, name: user.email };
        } catch (err) {
          console.error("[passkey] authorize error:", err);
          return null;
        }
      },
    }),
    Credentials({
      id: "magic-link",
      name: "Magic Link",
      credentials: {
        token: { label: "Token", type: "text" },
        sid: { label: "Session ID", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.token || !credentials?.sid) return null;

        const coreDbUrl = process.env.CORE_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL;
        if (!coreDbUrl) {
          console.error("[magic-link] CORE_DATABASE_URL or DATABASE_URL is not set.");
          return null;
        }

        try {
          const { default: pg } = await import("pg");
          const { Pool } = pg;
          const pool = new Pool({ connectionString: coreDbUrl });
          const jwtToken = createHash("sha256").update(credentials.token as string).digest("hex");

          const result = await pool.query(
            `SELECT ws."userId", u."telegramId", u."firstName", u."lastName", u."username"
             FROM "webSessions" ws
             JOIN "users" u ON u."id" = ws."userId"
             WHERE ws."id" = $1 AND ws."jwtToken" = $2 AND ws."expiresAt" > NOW()
             LIMIT 1`,
            [credentials.sid, jwtToken]
          );

          await pool.end();

          if (result.rows.length === 0) {
            console.warn('[Magic Link Auth] Session not found or expired:', { sid: credentials.sid });
            return null;
          }

          const user = result.rows[0];
          return {
            id: user.telegramId,
            name: [user.firstName, user.lastName].filter(Boolean).join(" "),
            email: `${user.telegramId}@telegram.rabbitty`,
          };
        } catch (err) {
          console.error('[Magic Link Auth Error]:', err);
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
    async jwt({ token }) {
      return token;
    },
  },
}) as any;

export const auth = authResult.auth;
export const handlers = authResult.handlers;
export const signIn = authResult.signIn;
export const signOut = authResult.signOut;

```

*(582 líneas)*


## 📄 `telegram-miniapp/src/lib/securityVault.ts`

**SECURITY VAULT — Face ID/PIN/passkeys + fast login stash + biometría honesta**

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

/* ───────────────────────── Fast Login (tras cerrar sesión) ───────────────────────── */

const FASTLOGIN_KEY = 'rabbitty_fastlogin_v1';

/** Guarda la sesión activa para re-login biométrico (SOLO si hay Face ID/PIN activo). */
export async function stashFastLogin(sessionToken: string): Promise<void> {
  if (!sessionToken) return;
  if (!hasAnyLocalSecurity()) return; // sin Face ID ni PIN → no hay fast login
  try {
    writeJson(FASTLOGIN_KEY, {
      token: sessionToken,
      savedAt: Date.now(),
      // La sesión del server expira en 30d — el fastlogin muere con ella
      expiresAt: Date.now() + 30 * 86400_000,
    });
  } catch { /* noop */ }
}

export function getFastLogin(): { token: string } | null {
  const rec = readJson<{ token: string; expiresAt: number }>(FASTLOGIN_KEY);
  if (!rec?.token || Date.now() > rec.expiresAt) return null;
  return { token: rec.token };
}

export function clearFastLogin(): void {
  try { localStorage.removeItem(FASTLOGIN_KEY); } catch { /* noop */ }
}

```

*(580 líneas)*


## 📄 `telegram-miniapp/src/features/auth/PhoneAuthFlow.tsx`

**PHONE AUTH FLOW — OTP + celebración bunz + fast login Face ID**

```typescript
'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { PlatformBridge } from '@/lib/platform';
import { useAuth } from '@/features/auth/AuthProvider';
import { getFastLogin, verifyBiometric, hasAnyLocalSecurity } from '@/lib/securityVault';

interface CountryCode {
  code: string;
  dialCode: string;
  flag: string;
  name: string;
}

const COUNTRIES: CountryCode[] = [
  { code: 'MX', dialCode: '+52', flag: '🇲🇽', name: 'México' },
  { code: 'US', dialCode: '+1', flag: '🇺🇸', name: 'EE.UU. / CA' },
  { code: 'ES', dialCode: '+34', flag: '🇪🇸', name: 'España' },
  { code: 'CO', dialCode: '+57', flag: '🇨🇴', name: 'Colombia' },
  { code: 'AR', dialCode: '+54', flag: '🇦🇷', name: 'Argentina' },
  { code: 'CL', dialCode: '+56', flag: '🇨🇱', name: 'Chile' },
  { code: 'PE', dialCode: '+51', flag: '🇵🇪', name: 'Perú' },
];

interface PhoneAuthFlowProps {
  mode: 'register' | 'login';
  onBack?: () => void;
}

export default function PhoneAuthFlow({ mode, onBack }: PhoneAuthFlowProps) {
  const router = useRouter();
  const isRegisterMode = mode === 'register';
  const { user, loading: authLoading, checkAuth } = useAuth();

  const [step, setStep] = useState<'input' | 'otp'>('input');
  const [inputVal, setInputVal] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(COUNTRIES[0]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [targetDisplay, setTargetDisplay] = useState('');
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [autoDetecting, setAutoDetecting] = useState(() => PlatformBridge.isTelegram());
  const [celebration, setCelebration] = useState<{ totalBunz: number; businessName: string } | null>(null);
  const [fastLoginAvailable, setFastLoginAvailable] = useState(false);
  const [fastLoginBusy, setFastLoginBusy] = useState(false);
  const pendingNavRef = useRef<{ isNewUser: boolean; role?: string } | null>(null);

  // Continúa la navegación post-login (tras cerrar la celebración si aplicó)
  const continueAfterLogin = (data: { isNewUser?: boolean; user?: { firstName?: string | null; role?: string | null } | null }) => {
    if (data.isNewUser || !data.user?.firstName) {
      // New members must complete their identity before entering the app
      router.replace('/signup?setup=1');
    } else if (data.user?.role === 'AFFILIATE') {
      router.replace('/business');
    } else {
      router.replace('/');
    }
  };

  const closeCelebration = () => {
    setCelebration(null);
    const pending = pendingNavRef.current;
    pendingNavRef.current = null;
    if (pending) {
      if (pending.isNewUser) router.replace('/signup?setup=1');
      else if (pending.role === 'AFFILIATE') router.replace('/business');
      else router.replace('/');
    }
  };

  const otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  // Auto-redirect if already logged in (active session opens the app directly)
  useEffect(() => {
    if (!authLoading && user) {
      if (!user.firstName) {
        router.replace('/signup?setup=1');
      } else if (user.role === 'AFFILIATE') {
        router.replace('/business');
      } else {
        router.replace('/');
      }
    }
  }, [user, authLoading, router]);

  // ── Fast login: detectar stash de sesión (tras logout con seguridad activa) ──
  useEffect(() => {
    if (autoDetecting) return;
    (async () => {
      try {
        const stash = getFastLogin();
        if (stash?.token && hasAnyLocalSecurity()) setFastLoginAvailable(true);
      } catch { /* noop */ }
    })();
  }, [autoDetecting]);

  const handleFastLogin = async () => {
    const stash = getFastLogin();
    if (!stash) return;
    setFastLoginBusy(true);
    try {
      const bio = await verifyBiometric('Entrada rápida a tu cuenta Rabbitty');
      if (!bio.ok) { setFastLoginBusy(false); return; } // cancelado/fallido → OTP normal
      await PlatformBridge.setSessionToken(stash.token);
      // Verificar que la sesión sigue válida en el server
      const checkRes = await fetch('/api/auth/session', { headers: { Authorization: `Bearer ${stash.token}` } });
      if (checkRes.ok) {
        PlatformBridge.hapticFeedback('success');
        await checkAuth();
        router.replace('/');
      } else {
        // sesión expirada/revocada → limpiar stash, OTP normal
        localStorage.removeItem('rabbitty_fastlogin_v1');
        setFastLoginAvailable(false);
        setFastLoginBusy(false);
      }
    } catch {
      setFastLoginBusy(false);
    }
  };

  // Determinar si lo que escribe parece teléfono
  const isPhoneNumber = (() => {
    const trimmed = inputVal.trim();
    if (!trimmed) return false;
    if (trimmed.includes('@')) return false;
    return /^[\d\s\-\+\(\)]+$/.test(trimmed) && trimmed.replace(/\D/g, '').length >= 1;
  })();

  // Chequeo de entorno local derivado
  const isLocalDev =
    typeof window !== 'undefined' &&
    process.env.NODE_ENV === 'development' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  // Auto-detect Telegram Identity if launched inside Telegram
  useEffect(() => {
    let mounted = true;

    if (!PlatformBridge.isTelegram()) {
      return;
    }

    import('@twa-dev/sdk')
      .then(async (mod) => {
        const app = mod.default;
        if (!mounted) return;

        if (app.initData) {
          try {
            const res = await fetch('/api/auth/telegram', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ initData: app.initData }),
            });
            const data = await res.json();
            if (data?.success && data?.user) {
              if (data.sessionToken) {
                await PlatformBridge.setSessionToken(data.sessionToken);
              }
              await checkAuth();
              if (!data.user?.firstName) {
                router.replace('/signup?setup=1');
              } else {
                router.replace('/');
              }
              return;
            }
          } catch (e) {
            console.error('Auto login check failed', e);
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setAutoDetecting(false);
      });

    return () => {
      mounted = false;
    };
  }, [router, checkAuth]);

  useEffect(() => {
    if (step === 'otp') {
      const t = setTimeout(() => {
        otpInputRef.current?.focus({ preventScroll: true });
        window.scrollTo(0, 0);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [step]);

  const getCanonicalRecipient = () => {
    const trimmed = inputVal.trim();
    if (trimmed.includes('@')) {
      return trimmed.toLowerCase();
    }
    if (trimmed.startsWith('+')) {
      return trimmed;
    }
    const cleanDigits = trimmed.replace(/\D/g, '');
    const dialDigits = selectedCountry.dialCode.replace(/\D/g, '');
    if (cleanDigits.startsWith(dialDigits)) {
      return `+${cleanDigits}`;
    }
    return `${selectedCountry.dialCode}${cleanDigits}`;
  };

  const handleSendOtp = async () => {
    const raw = inputVal.trim();
    if (!raw) {
      setError('Por favor ingresa un correo electrónico o tu número celular.');
      await PlatformBridge.hapticFeedback('warning');
      return;
    }

    const isTester = raw.toLowerCase() === 'tester' || raw.toLowerCase() === 'tester@rabbitty.me';
    const recipient = isTester ? 'tester@rabbitty.me' : getCanonicalRecipient();
    const isEmail = recipient.includes('@');

    if (!isTester && isEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      setError('Por favor ingresa un correo electrónico válido.');
      await PlatformBridge.hapticFeedback('warning');
      return;
    }

    if (!isTester && !isEmail && recipient.replace(/\D/g, '').length < 8) {
      setError('Por favor ingresa un número de teléfono válido.');
      await PlatformBridge.hapticFeedback('warning');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    setDevOtpHint(null);

    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: recipient }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setTargetDisplay(recipient);
        if (data.otpCode) {
          setDevOtpHint(data.otpCode);
        }
        setStep('otp');
        setMessage(
          data.message || (
            data.channel === 'email' && data.mode === 'phone'
              ? `Enviamos un código de 6 dígitos a tu correo vinculado`
              : data.mode === 'phone'
                ? `Enviamos un código de 6 dígitos a tu celular ${recipient}`
                : `Enviamos un código de 6 dígitos a ${recipient}`
          )
        );
        await PlatformBridge.hapticFeedback('medium');
      } else {
        setError(data.error || 'No se pudo enviar el código. Intenta de nuevo.');
        await PlatformBridge.hapticFeedback('error');
      }
    } catch (e) {
      console.error(e);
      setError('Error al conectar con el servidor.');
      await PlatformBridge.hapticFeedback('error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (codeToVerify?: string) => {
    const code = (codeToVerify || otpCode).trim();
    if (code.length < 6) {
      setError('Por favor introduce el código de 6 dígitos completo.');
      await PlatformBridge.hapticFeedback('warning');
      return;
    }

    setLoading(true);
    setError('');

    const recipient = targetDisplay || getCanonicalRecipient();

    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: recipient,
          code,
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        await PlatformBridge.hapticFeedback('success');
        if (data.sessionToken) {
          await PlatformBridge.setSessionToken(data.sessionToken);
        }
        await checkAuth();

        // ── Celebración de Bono de Bienvenida: el usuario VE sus Bunz acreditados
        //    justo después del login (además de la notificación in-app + push) ──
        const wb = data.welcomeBonus;
        if (wb?.awarded) {
          pendingNavRef.current = { isNewUser: Boolean(data.isNewUser), role: data.user?.role ?? undefined };
          setCelebration({ totalBunz: Number(wb.totalBunz) || 0, businessName: String(wb.businessName || 'Rabbitty') });
          return; // la navegación continúa al cerrar la celebración
        }
        continueAfterLogin(data);
      } else {
        setError(data.error || 'Código incorrecto o expirado.');
        await PlatformBridge.hapticFeedback('error');
      }
    } catch (e) {
      console.error(e);
      setError('Error al validar código. Intenta de nuevo.');
      await PlatformBridge.hapticFeedback('error');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (val: string) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 6);
    setOtpCode(cleaned);
    if (cleaned.length === 6) {
      handleVerifyOtp(cleaned);
    }
  };

  const handleBack = () => {
    if (step === 'otp') {
      setStep('input');
      setError('');
      return;
    }
    if (onBack) {
      onBack();
    } else {
      router.push('/onboarding');
    }
  };

  // ── Celebración de Bono de Bienvenida (se muestra sobre cualquier paso) ──
  if (celebration) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-[#0A0A0A] px-6 relative overflow-hidden">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-[#E91E63]/25 blur-[90px] pointer-events-none" />
        <motion.div
          initial={{ scale: 0.7, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 18 }}
          className="relative z-10 flex flex-col items-center text-center"
        >
          <motion.div
            animate={{ rotate: [0, -8, 8, -5, 5, 0] }}
            transition={{ duration: 1.2, delay: 0.3 }}
            className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[#E91E63] to-[#A855F7] flex items-center justify-center text-5xl shadow-[0_0_60px_rgba(233,30,99,0.45)]"
          >
            🐰
          </motion.div>
          <motion.p
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.45, type: 'spring', stiffness: 260 }}
            className="mt-6 text-5xl font-black tracking-tight bg-gradient-to-r from-[#E91E63] via-[#F472B6] to-[#A855F7] bg-clip-text text-transparent"
          >
            +{celebration.totalBunz}
          </motion.p>
          <p className="mt-1 text-base font-black text-white">Bunz acreditados 🎉</p>
          <p className="mt-2 text-xs text-neutral-400 leading-relaxed max-w-xs">
            Te esperan en tu billetera, listos para usarlos en{' '}
            <strong className="text-white">{celebration.businessName}</strong>. Se aplican automáticamente en tu consumo.
          </p>
          <button
            onClick={closeCelebration}
            className="mt-8 w-full max-w-xs py-3.5 rounded-2xl bg-gradient-to-r from-[#E91E63] to-[#A855F7] text-white font-black text-sm shadow-[0_8px_30px_rgba(233,30,99,0.4)] active:scale-95 transition-transform cursor-pointer"
          >
            Empezar a usar mis Bunz →
          </button>
          <button
            onClick={closeCelebration}
            className="mt-3 text-[11px] font-bold text-neutral-500 hover:text-neutral-300 cursor-pointer"
          >
            Continuar
          </button>
        </motion.div>
      </div>
    );
  }

  if (autoDetecting) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-[#0A0A0A]">
        <div className="w-10 h-10 rounded-full border-3 border-neutral-800 border-t-[#E91E63] animate-spin" />
        <p className="mt-4 text-xs font-semibold text-neutral-400">Verificando sesión segura...</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-dvh flex flex-col px-7 pb-10"
      style={{
        fontFamily: 'var(--font-family-base)',
        backgroundColor: 'var(--bg-primary)',
        paddingTop: 'calc(var(--safe-top, 0px) + 24px)',
      }}
    >
      {/* Back button */}
      <div className="mb-7 flex items-center justify-between">
        <button
          onClick={handleBack}
          className="p-2 -ml-2 bg-none border-none cursor-pointer flex items-center text-neutral-400 active:text-white"
        >
          <svg width="10" height="18" viewBox="0 0 10 18" fill="none">
            <path d="M9 1L1 9L9 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">
          {step === 'input' ? (isRegisterMode ? 'Paso 1 de 3' : 'Paso 1 de 2') : 'Verificación OTP'}
        </span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1
          className="text-[34px] font-extrabold tracking-[-0.5px] leading-[1.15] mb-2"
          style={{ color: 'var(--text-primary)' }}
        >
          {step === 'input'
            ? (isRegisterMode ? 'Comienza en Rabbitty' : 'Bienvenido a Rabbitty')
            : 'Introduce tu Código'}
        </h1>
        <p className="text-[14px] leading-relaxed text-neutral-400">
          {step === 'input'
            ? (isRegisterMode
                ? 'Ingresa tu número celular o correo para crear tu cuenta y ganar bunz.'
                : 'Ingresa tu número celular o correo para iniciar sesión de forma rápida y segura.')
            : message || 'Introduce el código de 6 dígitos que te enviamos.'}
        </p>
      </motion.div>

      <AnimatePresence mode="wait">
        {step === 'input' ? (
          <motion.div
            key="input-step"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex-1 flex flex-col justify-between"
          >
            <div>
              <div className="relative mb-2">
                <div className="flex items-center gap-2">
                  {/* Selector / indicador de país cuando es teléfono */}
                  {isPhoneNumber && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowCountryPicker(!showCountryPicker)}
                        className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 rounded-2xl px-3 py-4 text-white hover:border-pink-500 transition-colors"
                      >
                        <span className="text-xl">{selectedCountry.flag}</span>
                        <span className="text-sm font-bold text-neutral-300">{selectedCountry.dialCode}</span>
                        <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {showCountryPicker && (
                        <div className="absolute left-0 top-full mt-2 z-50 w-52 bg-[#161616] border border-neutral-800 rounded-2xl p-2 shadow-2xl backdrop-blur-xl max-h-56 overflow-y-auto">
                          {COUNTRIES.map((c) => (
                            <button
                              key={c.code}
                              type="button"
                              onClick={() => {
                                setSelectedCountry(c);
                                setShowCountryPicker(false);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs transition-colors ${
                                selectedCountry.code === c.code ? 'bg-[#E91E63]/20 text-[#E91E63] font-bold' : 'text-neutral-300 hover:bg-neutral-800'
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                <span>{c.flag}</span>
                                <span>{c.name}</span>
                              </span>
                              <span className="text-neutral-400 font-mono text-[11px]">{c.dialCode}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <input
                    type="text"
                    inputMode={isPhoneNumber ? 'tel' : 'email'}
                    placeholder="Celular o correo (ej. 322...)"
                    value={inputVal}
                    onChange={(e) => {
                      const val = e.target.value;
                      setInputVal(val);
                      const trimmed = val.trim();
                      if (trimmed.startsWith('+52')) setSelectedCountry(COUNTRIES.find((c) => c.code === 'MX')!);
                      else if (trimmed.startsWith('+1')) setSelectedCountry(COUNTRIES.find((c) => c.code === 'US')!);
                      else if (trimmed.startsWith('+34')) setSelectedCountry(COUNTRIES.find((c) => c.code === 'ES')!);
                      else if (trimmed.startsWith('+57')) setSelectedCountry(COUNTRIES.find((c) => c.code === 'CO')!);
                      else if (trimmed.startsWith('+54')) setSelectedCountry(COUNTRIES.find((c) => c.code === 'AR')!);
                      else if (trimmed.startsWith('+56')) setSelectedCountry(COUNTRIES.find((c) => c.code === 'CL')!);
                      else if (trimmed.startsWith('+51')) setSelectedCountry(COUNTRIES.find((c) => c.code === 'PE')!);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                    className="flex-1 bg-neutral-900/80 border border-neutral-800 focus:border-[#E91E63] rounded-2xl px-5 py-4 text-[17px] text-white outline-none transition-all placeholder:text-neutral-600 shadow-inner"
                  />
                </div>
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-[13px] font-medium text-rose-500 mt-3"
                >
                  {error}
                </motion.p>
              )}
            </div>

            <div className="flex flex-col items-center gap-4 mt-8">
              <button
                onClick={handleSendOtp}
                disabled={loading || !inputVal.trim()}
                className="w-full text-base font-bold py-4.25 rounded-full border-none transition-all duration-200 active:scale-[0.98] shadow-lg shadow-[#E91E63]/25"
                style={{
                  background: loading || !inputVal.trim() ? '#222' : 'linear-gradient(135deg, #FF2E93 0%, #E91E63 100%)',
                  color: loading || !inputVal.trim() ? '#666' : '#FFF',
                  cursor: loading || !inputVal.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Enviando código…' : isPhoneNumber ? 'Continuar con Celular 📱' : 'Continuar con Código 🔑'}
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="otp-step"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 flex flex-col justify-between"
          >
            <div>
              {/* Margen espacioso entre datos y el OTP */}
              <div className="relative mt-4 mb-6">
                <input
                  ref={otpInputRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={otpCode}
                  onChange={(e) => handleOtpChange(e.target.value)}
                  className="w-full text-center tracking-[0.4em] font-mono text-[32px] font-black bg-neutral-900/80 border border-neutral-800 focus:border-[#E91E63] rounded-2xl py-4 text-white outline-none transition-all shadow-inner"
                />
              </div>

              {/* Botón de llenado rápido de prueba en local dev */}
              {isLocalDev && devOtpHint && (
                <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between">
                  <span className="text-xs text-amber-300 font-mono">
                    Código de prueba: <strong>{devOtpHint}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setOtpCode(devOtpHint);
                      handleVerifyOtp(devOtpHint);
                    }}
                    className="text-xs bg-amber-500 text-black font-bold px-3 py-1 rounded-lg border-none cursor-pointer"
                  >
                    Rellenar ⚡
                  </button>
                </div>
              )}

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-[13px] font-medium text-rose-500 mt-3 text-center"
                >
                  {error}
                </motion.p>
              )}

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={loading}
                  className="text-xs font-semibold text-neutral-400 hover:text-[#E91E63] bg-transparent border-none cursor-pointer"
                >
                  ¿No recibiste el código? Reenviar
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center gap-4 mt-8">
              <button
                onClick={() => handleVerifyOtp()}
                disabled={loading || otpCode.length < 6}
                className="w-full text-base font-bold py-4.25 rounded-full border-none transition-all duration-200 active:scale-[0.98] shadow-lg shadow-[#E91E63]/25"
                style={{
                  background: loading || otpCode.length < 6 ? '#222' : 'linear-gradient(135deg, #FF2E93 0%, #E91E63 100%)',
                  color: loading || otpCode.length < 6 ? '#666' : '#FFF',
                  cursor: loading || otpCode.length < 6 ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Verificando…' : 'Acceder a Rabbitty 🚀'}
              </button>

              <button
                type="button"
                className="bg-none border-none text-xs font-medium cursor-pointer text-neutral-500 hover:text-neutral-300"
                onClick={() => {
                  setStep('input');
                  setOtpCode('');
                  setError('');
                }}
              >
                Cambiar número o correo
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

```

*(661 líneas)*


## 📄 `apps/admin/src/app/api/kiosk/pair/generate/route.ts`

**KIOSK PAIR GENERATE — sesión de identificación (10 min)**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@rabbitty/auth";
import { getCoreDb } from "@rabbitty/api/db";
import { systemSettings } from "@rabbitty/database-core";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export const runtime = "nodejs";

/** POST /api/kiosk/pair/generate — el kiosko crea una sesión de identificación (10 min). */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const token = crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const label = String(body.restaurantName || "Kiosko Rabbitty").slice(0, 60);

    const db = getCoreDb();
    const rows = await db.select().from(systemSettings).where(eq(systemSettings.key, "kiosk_pair_sessions")).limit(1);
    let sessions: Record<string, { label: string; expiresAt: string; customerId: null; customerName: null }> = {};
    try { if (rows[0]?.value) sessions = JSON.parse(rows[0].value); } catch { sessions = {}; }
    const now = Date.now();
    for (const [k, v] of Object.entries(sessions)) {
      if (new Date(v.expiresAt).getTime() < now) delete sessions[k];
    }
    sessions[token] = { label, expiresAt, customerId: null, customerName: null };
    if (rows.length) {
      await db.update(systemSettings).set({ value: JSON.stringify(sessions), updatedAt: new Date() }).where(eq(systemSettings.key, "kiosk_pair_sessions"));
    } else {
      await db.insert(systemSettings).values({ key: "kiosk_pair_sessions", value: JSON.stringify(sessions) });
    }

    return NextResponse.json({ success: true, token, expiresAt });
  } catch (err) {
    console.error("[KIOSK_PAIR_GENERATE]", err);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}

```

*(41 líneas)*


## 📄 `apps/admin/src/app/api/kiosk/pair/status/route.ts`

**KIOSK PAIR STATUS — polling del kiosko**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCoreDb } from "@rabbitty/api/db";
import { systemSettings } from "@rabbitty/database-core";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

/** GET /api/kiosk/pair/status?token= — el kiosko consulta si el cliente ya se identificó. */
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token") || "";
    const db = getCoreDb();
    const rows = await db.select().from(systemSettings).where(eq(systemSettings.key, "kiosk_pair_sessions")).limit(1);
    let sessions: Record<string, { label: string; expiresAt: string; customerId: string | null; customerName: string | null }> = {};
    try { if (rows[0]?.value) sessions = JSON.parse(rows[0].value); } catch { sessions = {}; }
    const entry = sessions[token];
    if (!entry || new Date(entry.expiresAt).getTime() < Date.now()) {
      return NextResponse.json({ success: true, linked: false, expired: true });
    }
    return NextResponse.json({
      success: true,
      linked: Boolean(entry.customerId),
      customerId: entry.customerId,
      customerName: entry.customerName,
    });
  } catch (err) {
    console.error("[KIOSK_PAIR_STATUS]", err);
    return NextResponse.json({ success: false, linked: false }, { status: 500 });
  }
}

```

*(30 líneas)*


## 📄 `telegram-miniapp/src/app/api/kiosk/pair/confirm/route.ts`

**KIOSK PAIR CONFIRM — el cliente confirma su identidad**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { systemSettings, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/serverAuth";

export const runtime = "nodejs";

interface KioskSession { label: string; expiresAt: string; customerId: string | null; customerName: string | null }

/** POST /api/kiosk/pair/confirm { token } — el cliente confirma su identidad para el kiosko. */
export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

    const { token } = await req.json().catch(() => ({}));
    if (!token || typeof token !== "string") {
      return NextResponse.json({ success: false, error: "Token requerido" }, { status: 400 });
    }

    const rows = await db.select().from(systemSettings).where(eq(systemSettings.key, "kiosk_pair_sessions")).limit(1);
    let sessions: Record<string, KioskSession> = {};
    try { if (rows[0]?.value) sessions = JSON.parse(rows[0].value); } catch { sessions = {}; }
    const entry = sessions[token];
    if (!entry || new Date(entry.expiresAt).getTime() < Date.now()) {
      return NextResponse.json({ success: false, error: "Sesión del kiosko inválida o expirada" }, { status: 401 });
    }
    if (entry.customerId) {
      return NextResponse.json({ success: false, error: "Sesión ya reclamada" }, { status: 409 });
    }

    const [me] = await db.select({ id: users.id, username: users.username, firstName: users.firstName, phoneNumber: users.phoneNumber }).from(users).where(eq(users.id, caller.id)).limit(1);
    if (!me) return NextResponse.json({ success: false, error: "Usuario no encontrado" }, { status: 404 });

    entry.customerId = me.id;
    entry.customerName = me.firstName || me.username || "Rabbitter";
    await db.update(systemSettings).set({ value: JSON.stringify(sessions), updatedAt: new Date() }).where(eq(systemSettings.key, "kiosk_pair_sessions"));

    return NextResponse.json({ success: true, customerName: entry.customerName, label: entry.label });
  } catch (err) {
    console.error("[KIOSK_PAIR_CONFIRM]", err);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}

```

*(45 líneas)*


## 📄 `telegram-miniapp/src/app/kiosk-confirm/page.tsx`

**KIOSK CONFIRM — pantalla de confirmación del cliente**

```typescript
'use client';

/**
 * ── Kiosk Confirm ── El cliente escanea el QR del kiosko y confirma su identidad.
 * El pago se hace después desde el kiosko (Rabbitty Pay) — aquí SOLO se vincula
 * la identidad para que los Bunz de esa orden se acrediten a su cuenta.
 */

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { PlatformBridge } from '@/lib/platform';
import { useAuth } from '@/features/auth/AuthProvider';

function ConfirmInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const { user } = useAuth();
  const [state, setState] = useState<'idle' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    import('@twa-dev/sdk').then((mod) => { mod.default.ready(); mod.default.expand(); }).catch(() => {});
  }, []);

  const confirm = async () => {
    setBusy(true);
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch('/api/kiosk/pair/confirm', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data?.success) {
        PlatformBridge.hapticFeedback('success');
        setState('done');
        setMsg(`¡Listo, ${data.customerName}! Tus Bunz de esta orden se acreditan a tu cuenta.`);
      } else {
        setState('error');
        setMsg(data?.error || 'No se pudo confirmar');
      }
    } catch {
      setState('error');
      setMsg('Error de conexión');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-black px-6 relative overflow-hidden">
      <div className="absolute top-[-15%] w-64 h-64 rounded-full bg-[#E91E63]/20 blur-[80px] pointer-events-none" />
      <motion.div initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative z-10 w-full max-w-sm rounded-[2rem] border border-white/10 bg-[#12121B] p-7 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-[#E91E63]/15 border border-[#E91E63]/30 flex items-center justify-center text-3xl">
          🖥️
        </div>
        <h1 className="mt-4 text-xl font-black text-white">
          {state === 'done' ? '🎉 ¡Identidad vinculada!' : '¿Eres tú en el kiosko?'}
        </h1>

        {state === 'idle' && (
          <>
            <p className="mt-3 text-xs text-neutral-400 leading-relaxed">
              Confirma tu identidad para que los Bunz de esta orden se acrediten a tu cuenta automáticamente.
            </p>
            <p className="mt-2 text-[11px] text-neutral-500 font-mono break-all">token: {token.slice(0, 12)}…</p>
            <button
              onClick={confirm}
              disabled={busy}
              className="mt-6 w-full py-3.5 rounded-2xl bg-[#E91E63] text-white font-black text-sm active:scale-95 transition-transform cursor-pointer disabled:opacity-50"
            >
              {busy ? 'Confirmando…' : `Sí, soy ${user?.firstName || 'yo'} — vincular`}
            </button>
            <button
              onClick={() => window.history.back()}
              className="mt-2 w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-neutral-400 font-bold text-xs cursor-pointer"
            >
              Cancelar
            </button>
          </>
        )}

        {state === 'done' && (
          <>
            <p className="mt-2 text-sm text-emerald-400 font-bold">{msg}</p>
            <p className="mt-4 text-xs text-neutral-400">Ahora termina tu pago en el kiosko — el saldo de Bunz se aplicará solo.</p>
            <button
              onClick={() => window.history.back()}
              className="mt-6 w-full py-3.5 rounded-2xl bg-white/10 border border-white/10 text-white font-black text-sm cursor-pointer"
            >
              Volver al kiosko
            </button>
          </>
        )}

        {state === 'error' && (
          <>
            <p className="mt-2 text-sm text-rose-400 font-bold">{msg}</p>
            <button
              onClick={() => setState('idle')}
              className="mt-6 w-full py-3.5 rounded-2xl bg-white/10 border border-white/10 text-white font-black text-sm cursor-pointer"
            >
              Reintentar
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}

export default function KioskConfirmPage() {
  return (
    <Suspense>
      <ConfirmInner />
    </Suspense>
  );
}

```

*(121 líneas)*
