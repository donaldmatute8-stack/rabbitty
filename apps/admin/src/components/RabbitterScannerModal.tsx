'use client';

import { useEffect, useRef, useState } from "react";
import { startNeonDecoder } from "@/lib/neonDecoder";
import { toast } from "@rabbitty/ui";

/**
 * Escáner de código Rabbitter (QR estándar o barras neón) para el admin.
 * Devuelve el texto decodificado (to=/user=/phone= o scanCode numérico) vía onDecoded.
 */
export default function RabbitterScannerModal({ onDecoded, onClose }: { onDecoded: (text: string) => void; onClose: () => void }) {
  const stopDecoderRef = useRef<(() => void) | null>(null);
  const scannerRef = useRef<any>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!active) return;
        if (!document.getElementById("rabbitter-scan-reader")) return;
        const scanner = new Html5Qrcode("rabbitter-scan-reader");
        scannerRef.current = scanner;
        const config = { fps: 10, qrbox: { width: 220, height: 220 } };

        const handle = (decodedText: string) => {
          if (!active) return;
          active = false;
          try { scanner.stop().catch(() => {}); } catch {}
          stopDecoderRef.current?.();
          onDecoded(decodedText.trim());
          onClose();
        };

        await scanner.start({ facingMode: "environment" }, config, handle, () => {});
        if (!active) return;
        // Decoder neón en paralelo (mismo video)
        stopDecoderRef.current = startNeonDecoder("rabbitter-scan-reader", (code) => {
          if (!active) return;
          active = false;
          stopDecoderRef.current?.();
          onDecoded(String(code));
          onClose();
        });
        setStarting(false);
      } catch (err) {
        console.warn("[Scanner] error:", err);
        toast.error("Cámara no disponible o permiso denegado");
        setStarting(false);
        onClose();
      }
    })();
    return () => {
      active = false;
      stopDecoderRef.current?.();
      try { scannerRef.current?.stop().catch(() => {}); } catch {}
    };
  }, [onDecoded, onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-950 p-4" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-bold text-white mb-1 font-black">📷 Escanea el código del rabbitter</p>
        <p className="text-xs text-white/50 mb-3">Su QR dorado (Mi Código) o su RabbittyCode neón — también funciona el código numérico de su ticket de perfil.</p>
        <div id="rabbitter-scan-reader" className="rounded-xl overflow-hidden bg-black min-h-[240px]" />
        {starting && <p className="text-xs text-white/40 text-center mt-2">Abriendo cámara…</p>}
        <button onClick={onClose} className="w-full mt-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-white/70">Cerrar</button>
      </div>
    </div>
  );
}
