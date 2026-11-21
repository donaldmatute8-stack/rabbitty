import QRCode from "qrcode";

/**
 * ── QR para tickets térmicos, generado en casa ──
 * Antes el POS pedía la imagen a `api.qrserver.com`. Si esa red fallaba (o el
 * local la bloqueaba), `rasterizeImage` devolvía null EN SILENCIO y el ticket
 * salía sin el QR de recompensa. Generarlo aquí quita esa dependencia externa.
 */
export const QR_ALLOWED_PREFIXES = [
  "https://app.rabbitty.me/",
  "https://rabbitty.me/",
] as const;

/** Solo se aceptan destinos de Rabbitty (evita un proxy QR abierto). */
export function isAllowedQrTarget(text: string): boolean {
  if (!text || text.length > 512) return false;
  return QR_ALLOWED_PREFIXES.some((prefix) => text.startsWith(prefix));
}

export async function qrPng(text: string, width = 240): Promise<Buffer> {
  return QRCode.toBuffer(text, {
    type: "png",
    width,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}
