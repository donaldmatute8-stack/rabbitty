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
