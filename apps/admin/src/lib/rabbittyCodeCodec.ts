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
