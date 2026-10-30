import { codeFromBars, measureBarsFromFrame } from './rabbittyCodeCodec';

/**
 * ── Decodificador de RabbittyCode (barras neón) para cámaras del admin ──
 * Corre en paralelo al html5-qrcode: lee el mismo <video> del reader,
 * mide las 13 barras por posición esperada y emite el scanCode numérico.
 * Port del miniapp (features/transactions/QRScanner.tsx) — mismos umbrales.
 */
export function startNeonDecoder(readerId: string, onDecoded: (code: number) => void): () => void {
  const HI = 520;
  const hiCanvas = document.createElement('canvas');
  hiCanvas.width = HI;
  hiCanvas.height = HI;
  const hctx = hiCanvas.getContext('2d', { willReadFrequently: true });

  const isNeonPx = (r: number, g: number, b: number) =>
    (r >= 110 && b >= 75 && r - g >= 20) ||
    (b >= 110 && r >= 65 && b - g >= 20) ||
    (r >= 190 && b >= 160 && g >= 100 && r - g >= 15);

  let consecutiveNeonFrames = 0;
  let lastDecoded: number | null = null;
  let consecutiveAgree = 0;
  let isDecoding = false;
  let stopped = false;

  const interval = setInterval(async () => {
    if (isDecoding || stopped || !hctx) return;
    const container = document.getElementById(readerId);
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

      const heights = measureBarsFromFrame(data, HI);
      if (heights) {
        const decoded = codeFromBars(heights);
        if (decoded !== null) {
          if (lastDecoded === decoded) {
            consecutiveAgree += 1;
          } else {
            consecutiveAgree = 0;
          }
          lastDecoded = decoded;
          if (consecutiveAgree >= 1) {
            stopped = true;
            clearInterval(interval);
            onDecoded(decoded);
            return;
          }
        }
      }
      isDecoding = false;
    } catch {
      isDecoding = false;
    }
  }, 180);

  return () => {
    stopped = true;
    clearInterval(interval);
  };
}
