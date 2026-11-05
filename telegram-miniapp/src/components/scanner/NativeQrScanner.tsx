'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Flashlight, FlashlightOff, Images, ScanLine, X } from 'lucide-react';
import { PlatformBridge } from '@/lib/platform';
import { createNativeScanner, type NativeScannerApi } from '@/lib/nativeScanner';
import { useToast } from '@/contexts/ToastContext';

type CornerPoint = [number, number];

interface NativeQrScannerProps {
  /**
   * Devuelve `false` cuando el payload no se pudo reconocer: la sesión sigue
   * activa y la cámara NO se apaga. Cualquier otro valor (o `void`) cierra.
   */
  onScan: (value: string) => boolean | void | Promise<boolean | void>;
  onClose: () => void;
  onFallback?: () => void;
  /** Payload aceptado y cámara ya detenida (el padre puede liberar el overlay). */
  onConsumed?: () => void;
}

const DEFAULT_SIZE = 280;
const MIN_SIZE = 132;

/**
 * Escáner nativo estilo Telegram:
 *  - cámara nativa detrás del WebView (ML Kit / AVFoundation)
 *  - recuadro central con esquinas gruesas y fade alrededor
 *  - el recuadro sigue al QR con cornerPoints
 *  - linterna, zoom y foto de galería
 *  - multiframe: acepta tras 2 lecturas coherentes
 */
export function NativeQrScanner({ onScan, onClose, onFallback, onConsumed }: NativeQrScannerProps) {
  const { showToast } = useToast();
  const [frame, setFrame] = useState({ left: 0, top: 0, size: DEFAULT_SIZE });
  const [found, setFound] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [zoomMax, setZoomMax] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const scannerRef = useRef<NativeScannerApi | null>(null);
  const stoppedRef = useRef(false);
  const busyRef = useRef(false);
  const scanningRef = useRef(false);
  const rejectedRef = useRef<{ raw: string; until: number }>({ raw: '', until: 0 });
  const lastRawRef = useRef('');
  const firstSeenRef = useRef(0);

  // Posición inicial centrada
  useEffect(() => {
    const size = Math.min(window.innerWidth * 0.72, 300);
    setFrame({
      left: (window.innerWidth - size) / 2,
      top: (window.innerHeight - size) / 2,
      size,
    });
  }, []);

  // El aviso de "código no reconocido" no debe quedarse pegado.
  useEffect(() => {
    if (hint !== 'Ese código no es de Rabbitty') return;
    const timer = window.setTimeout(() => setHint(null), 2600);
    return () => window.clearTimeout(timer);
  }, [hint]);

  const updateFrame = useCallback((points: CornerPoint[]) => {
    if (!points || points.length !== 4) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const normalized = points.every(([x, y]) => x <= 1.5 && y <= 1.5);
    const pts = normalized
      ? points.map(([x, y]) => [x * w, y * h] as CornerPoint)
      : points;

    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const pad = 14;
    const size = Math.max(MIN_SIZE, Math.min(Math.max(maxX - minX, maxY - minY) + pad * 2, w * 0.86));
    const left = Math.max(10, Math.min(w - size - 10, (minX + maxX) / 2 - size / 2));
    const top = Math.max(80, Math.min(h - size - 120, (minY + maxY) / 2 - size / 2));
    setFrame({ left, top, size });
  }, []);

  const stopNative = useCallback(async () => {
    scanningRef.current = false;
    try {
      await scannerRef.current?.disableTorch();
    } catch {
      /* sin linterna */
    }
    try {
      await scannerRef.current?.stop();
    } catch {
      /* sin cámara */
    }
    document.body.classList.remove('barcode-scanner-active');
    document.documentElement.style.background = '';
  }, []);

  /**
   * Reanuda la sesión de cámara si algo la pausó (p. ej. abrir la galería).
   * No hace nada si la sesión ya se cerró o no hay cámara nativa.
   */
  const resumeScanning = useCallback(async () => {
    if (stoppedRef.current) return;
    try {
      document.body.classList.add('barcode-scanner-active');
      document.documentElement.style.background = 'transparent';
      await scannerRef.current?.start();
      scanningRef.current = true;
    } catch (err) {
      // "already scanning" es benigno; solo reportamos fallos reales.
      if (!stoppedRef.current && !/already|active/i.test(String(err))) {
        setError(err instanceof Error ? err.message : 'No se pudo reanudar la cámara.');
      }
    }
  }, []);

  /**
   * Valida ANTES de cerrar: si `onScan` devuelve `false`, el código no es de
   * Rabbitty y la sesión sigue escaneando (no se apaga la cámara).
   */
  const finish = useCallback(
    async (raw: string) => {
      if (stoppedRef.current || busyRef.current) return;
      busyRef.current = true;
      setFound(true);
      setHint('Leyendo…');
      PlatformBridge.hapticFeedback('success');

      let accepted = true;
      try {
        accepted = (await onScan(raw)) !== false;
      } catch {
        accepted = false;
      }

      // Si se cerró durante la validación, no hay nada que hacer.
      if (stoppedRef.current) {
        busyRef.current = false;
        return;
      }

      if (!accepted) {
        // Payload no reconocible: mantener la cámara y evitar reintentos en bucle
        // con el mismo código durante unos segundos.
        rejectedRef.current = { raw, until: Date.now() + 4000 };
        lastRawRef.current = '';
        firstSeenRef.current = 0;
        setFound(false);
        setHint('Ese código no es de Rabbitty');
        showToast('Ese código no es de Rabbitty', 'info');
        busyRef.current = false;
        return;
      }

      stoppedRef.current = true;
      setFound(false);
      setHint(null);
      await stopNative();
      busyRef.current = false;
      onConsumed?.();
    },
    [onConsumed, onScan, showToast, stopNative],
  );

  useEffect(() => {
    let listener: { remove: () => Promise<void> } | null = null;
    let cancelled = false;

    // Teardown idempotente: se usa tanto en el cleanup como en las salidas
    // tempranas del arranque asíncrono.
    const teardown = async () => {
      if (listener) {
        const current = listener;
        listener = null;
        await current.remove().catch(() => undefined);
      }
      await stopNative();
    };

    const api = createNativeScanner();
    if (!api) {
      setError('El escáner nativo no está disponible en esta plataforma.');
      return;
    }
    scannerRef.current = api;

    (async () => {
      try {
        // Android: ML Kit expone permisos. iOS: el plugin los pide al iniciar.
        if (api.platform === 'android') {
          const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
          const permission = await BarcodeScanner.checkPermissions();
          if (permission.camera !== 'granted') {
            const requested = await BarcodeScanner.requestPermissions();
            if (requested.camera !== 'granted') {
              if (!cancelled) setError('Necesitamos la cámara para escanear el QR. Actívala en Ajustes.');
              return;
            }
          }
        }
        // El usuario pudo cerrar o navegar durante el permiso.
        if (cancelled) return;

        listener = await api.onBarcodes((barcodes) => {
          const barcode = barcodes?.[0];
          if (!barcode) return;
          if (barcode.cornerPoints && barcode.cornerPoints.length === 4) {
            updateFrame(barcode.cornerPoints as CornerPoint[]);
          }
          const raw = barcode.rawValue || '';
          if (!raw) return;
          if (busyRef.current) return;
          const rejected = rejectedRef.current;
          if (rejected.raw === raw && Date.now() < rejected.until) return;

          const now = Date.now();
          if (raw !== lastRawRef.current) {
            lastRawRef.current = raw;
            firstSeenRef.current = now;
            return;
          }
          // Multiframe corto: deja que el recuadro siga al QR antes de aceptar.
          if (now - firstSeenRef.current >= 280) {
            void finish(raw);
          }
        });

        // El listener pudo quedar huérfano si se cerró durante el await.
        if (cancelled) {
          await teardown();
          return;
        }

        document.body.classList.add('barcode-scanner-active');
        document.documentElement.style.background = 'transparent';

        try {
          await api.start();
          scanningRef.current = true;
        } catch (err) {
          // Si la cámara ya estaba activa seguimos; otro fallo se reporta abajo.
          if (!/already|active/i.test(String(err))) throw err;
        }

        // Cierre durante el arranque: apagar la cámara aunque startScan haya
        // ganado la carrera contra el cleanup.
        if (cancelled) {
          await teardown();
          return;
        }

        const torch = await api.isTorchAvailable().catch(() => false);
        if (!cancelled) setTorchAvailable(Boolean(torch));
        const max = await api.getMaxZoom().catch(() => 1);
        if (!cancelled) setZoomMax(Math.max(1, Number(max) || 1));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo iniciar la cámara.');
        }
        await teardown();
      }
    })();

    return () => {
      cancelled = true;
      busyRef.current = false;
      stoppedRef.current = true;
      void teardown();
    };
  }, [finish, stopNative, updateFrame]);

  const toggleTorch = async () => {
    try {
      if (torchOn) await scannerRef.current?.disableTorch();
      else await scannerRef.current?.enableTorch();
      setTorchOn((v) => !v);
      PlatformBridge.hapticFeedback('light');
    } catch {
      showToast('La linterna no está disponible en este dispositivo', 'info');
    }
  };

  const applyZoom = async (value: number) => {
    try {
      await scannerRef.current?.setZoom(value);
      setZoom(value);
      PlatformBridge.hapticFeedback('light');
    } catch {
      showToast('El zoom no está disponible en este dispositivo', 'info');
    }
  };

  const pickPhoto = async () => {
    if (busyRef.current || stoppedRef.current) return;
    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
      const photo = await Camera.getPhoto({
        source: CameraSource.Photos,
        resultType: CameraResultType.Uri,
        quality: 90,
      });
      const path = photo.path || photo.webPath;
      if (!path) throw new Error('No se pudo leer la foto');
      const raw = await scannerRef.current?.scanImage(path);
      if (raw) {
        await finish(raw);
        return;
      }
      showToast('No encontramos un QR en esa foto', 'info');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo abrir la foto';
      if (!/cancel|canceled|cancelled/i.test(message)) showToast(message, 'error');
    } finally {
      // Abrir la galería puede pausar la cámara: reanudar explícitamente la sesión
      // (también cuando la foto no tenía QR o el usuario canceló).
      await resumeScanning();
    }
  };

  if (typeof document === 'undefined') return null;

  const borderColor = found ? '#22C55E' : '#FFFFFF';
  const corner = (position: 'tl' | 'tr' | 'bl' | 'br') => ({
    position: 'absolute' as const,
    width: 34,
    height: 34,
    top: position.startsWith('t') ? 0 : undefined,
    bottom: position.startsWith('b') ? 0 : undefined,
    left: position.endsWith('l') ? 0 : undefined,
    right: position.endsWith('r') ? 0 : undefined,
    borderTop: position.startsWith('t') ? `4px solid ${borderColor}` : undefined,
    borderBottom: position.startsWith('b') ? `4px solid ${borderColor}` : undefined,
    borderLeft: position.endsWith('l') ? `4px solid ${borderColor}` : undefined,
    borderRight: position.endsWith('r') ? `4px solid ${borderColor}` : undefined,
    borderTopLeftRadius: position === 'tl' ? 10 : undefined,
    borderTopRightRadius: position === 'tr' ? 10 : undefined,
    borderBottomLeftRadius: position === 'bl' ? 10 : undefined,
    borderBottomRightRadius: position === 'br' ? 10 : undefined,
    filter: 'drop-shadow(0 0 6px rgba(0,0,0,0.45))',
    transition: 'border-color 150ms ease',
  });

  return createPortal(
    <div className="scanner-portal fixed inset-0 z-[200] select-none">
      {/* Recuadro: el box-shadow dimmea todo alrededor; dentro se ve la cámara */}
      <div
        style={{
          position: 'absolute',
          left: frame.left,
          top: frame.top,
          width: frame.size,
          height: frame.size,
          borderRadius: 22,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.62)',
          transition: 'left 140ms ease-out, top 140ms ease-out, width 140ms ease-out, height 140ms ease-out',
        }}
      >
        {(['tl', 'tr', 'bl', 'br'] as const).map((p) => (
          <div key={p} style={corner(p)} />
        ))}

        <motion.div
          className="absolute left-3 right-3 h-0.5 rounded-full bg-[#FF2E93]/80"
          animate={{ top: ['8%', '90%', '8%'] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          style={{ boxShadow: '0 0 12px rgba(255,46,147,0.7)' }}
        />

        {found && (
          <div className="absolute inset-0 flex items-center justify-center rounded-[22px] bg-emerald-500/15">
            <span className="rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-black text-white">
              QR detectado
            </span>
          </div>
        )}
      </div>

      {/* Header */}
      <div
        className="absolute inset-x-0 top-0 flex items-center justify-between px-5 pb-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
      >
        <button
          type="button"
          onClick={() => {
            PlatformBridge.hapticFeedback('light');
            // Marca el cierre antes del unmount: el arranque async aborta y
            // no vuelve a encender la cámara.
            stoppedRef.current = true;
            void stopNative();
            onClose();
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white backdrop-blur-md"
          aria-label="Cerrar escáner"
        >
          <X size={19} />
        </button>
        <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-3.5 py-2 backdrop-blur-md">
          <ScanLine size={14} className="text-pink-300" />
          <span className="text-[11px] font-black uppercase tracking-[1.4px] text-white">Escanear QR</span>
        </div>
        <div className="h-10 w-10" />
      </div>

      {/* Hint */}
      <div className="absolute inset-x-0 px-6" style={{ top: frame.top + frame.size + 22 }}>
        <p
          className={`m-0 text-center text-[11px] font-bold ${
            hint === 'Ese código no es de Rabbitty' ? 'text-amber-300' : 'text-white/75'
          }`}
        >
          {hint ?? 'Apunta al QR; el recuadro lo sigue y se detecta solo'}
        </p>
      </div>

      {/* Controls */}
      <div
        className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 px-6 pb-2"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 22px)' }}
      >
        <button
          type="button"
          onClick={pickPhoto}
          className="flex h-13 w-13 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-md active:scale-95"
          aria-label="Escanear desde una foto"
        >
          <Images size={21} />
        </button>

        <div className="flex items-center gap-1 rounded-full border border-white/15 bg-black/40 p-1 backdrop-blur-md">
          {[1, 2, 3].map((z) => {
            const disabled = z > zoomMax + 0.01;
            return (
              <button
                key={z}
                type="button"
                disabled={disabled}
                onClick={() => void applyZoom(z)}
                className={`h-9 min-w-9 rounded-full px-2 text-[11px] font-black transition-colors ${
                  zoom === z ? 'bg-white text-black' : 'text-white/70 disabled:opacity-25'
                }`}
                aria-label={`Zoom ${z}x`}
              >
                {z}x
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={toggleTorch}
          disabled={!torchAvailable}
          className={`flex h-13 w-13 items-center justify-center rounded-full border backdrop-blur-md active:scale-95 ${
            torchOn
              ? 'border-amber-300/50 bg-amber-400/25 text-amber-200'
              : 'border-white/20 bg-black/40 text-white disabled:opacity-30'
          }`}
          aria-label={torchOn ? 'Apagar linterna' : 'Encender linterna'}
        >
          {torchOn ? <FlashlightOff size={21} /> : <Flashlight size={21} />}
        </button>
      </div>

      {error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 px-6">
          <div className="w-full max-w-sm rounded-3xl border border-white/15 bg-[#141418] p-5 text-center">
            <p className="m-0 text-sm font-black text-white">No pudimos abrir el escáner</p>
            <p className="m-0 mt-1.5 text-xs leading-relaxed text-white/55">{error}</p>
            {onFallback && (
              <button
                type="button"
                onClick={() => {
                  stoppedRef.current = true;
                  void stopNative();
                  onFallback();
                }}
                className="mt-4 w-full rounded-2xl bg-pink-500 py-3 text-sm font-black text-white"
              >
                Usar escáner básico
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                stoppedRef.current = true;
                onClose();
              }}
              className="mt-2 w-full rounded-2xl border border-white/15 bg-white/5 py-3 text-sm font-black text-white/80"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
