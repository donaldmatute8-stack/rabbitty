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
