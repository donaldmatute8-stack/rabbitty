'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { codeFromBars } from '@/lib/rabbittyCodeCodec';
import { PlatformBridge } from '@/lib/platform';
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
    const HI = 240;
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

        // Medir las 13 barras de onda
        const y0 = Math.floor(HI * 0.22);
        const y1 = Math.floor(HI * 0.78);
        const colNeon = new Float32Array(HI);
        for (let x = 0; x < HI; x++) {
          let count = 0;
          for (let y = y0; y < y1; y++) {
            const idx = (y * HI + x) * 4;
            if (isNeonPx(data[idx], data[idx + 1], data[idx + 2])) count++;
          }
          colNeon[x] = count;
        }
        const threshold = 2;
        let clusters: Array<{ x0: number; x1: number }> = [];
        let cur: { x0: number; x1: number } | null = null;
        for (let x = 0; x < HI; x++) {
          if (colNeon[x] >= threshold) {
            if (!cur) cur = { x0: x, x1: x };
            else cur.x1 = x;
          } else if (cur) {
            if (cur.x1 - cur.x0 >= 1) clusters.push(cur);
            cur = null;
          }
        }
        if (cur && cur.x1 - cur.x0 >= 1) clusters.push(cur);
        const mergeSmallest = (list: Array<{ x0: number; x1: number }>) => {
          if (list.length < 2) return list;
          let best = 0;
          let bestGap = Infinity;
          for (let i = 0; i < list.length - 1; i++) {
            const gap = list[i + 1].x0 - list[i].x1;
            if (gap < bestGap) { bestGap = gap; best = i; }
          }
          const merged = [...list];
          merged[best] = { x0: merged[best].x0, x1: merged[best + 1].x1 };
          merged.splice(best + 1, 1);
          return merged;
        };
        while (clusters.length > 13) clusters = mergeSmallest(clusters);

        let decoded: number | null = null;
        if (clusters.length === 13) {
          const heights: number[] = [];
          for (const c of clusters) {
            let minY = HI, maxY = 0;
            for (let x = c.x0; x <= c.x1; x++) {
              for (let y = y0; y < y1; y++) {
                const idx = (y * HI + x) * 4;
                if (isNeonPx(data[idx], data[idx + 1], data[idx + 2])) {
                  if (y < minY) minY = y;
                  if (y > maxY) maxY = y;
                }
              }
            }
            heights.push(maxY > minY ? maxY - minY : 0);
          }
          decoded = codeFromBars(heights);
        }

        if (decoded !== null) {
          try {
            const res = await fetch('/api/rabbitty-code/lookup', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code: decoded }),
            });
            const d = await res.json();
            if (d?.success && d.type === 'user' && d.user) {
              stopped = true;
              try { await scannerRef.current?.stop(); } catch {}
              PlatformBridge.hapticFeedback('success');
              onScan(`rabbitty://pay?to=${encodeURIComponent(d.user.handle || d.user.id)}`);
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

    const stopNeon = () => { stopped = true; clearInterval(interval); };

    const scanner = new Html5Qrcode("reader");
    scannerRef.current = scanner;

    scanner.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
      },
      (decodedText) => {
        // Stop scanning once we get a result to prevent multiple triggers
        scanner.stop().then(() => {
          onScan(decodedText);
        }).catch(err => {
          console.error("Failed to stop scanner", err);
          onScan(decodedText);
        });
      },
      (errorMessage) => {
        // parse error, ignored usually
      }
    ).catch(err => {
      console.error(err);
      setError("No se pudo acceder a la cámara. Revisa los permisos.");
    });

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center">
      <div className="w-full max-w-md p-4 flex flex-col items-center">
        <div className="w-full bg-white rounded-[24px] overflow-hidden relative">
          <div id="reader" className="w-full bg-black min-h-[300px]"></div>
          
          <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none z-10" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] border-2 border-pink-500 rounded-3xl pointer-events-none z-20" />
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
