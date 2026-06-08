'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface QRScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
}

export default function QRScanner({ onScan, onClose }: QRScannerProps) {
  const [error, setError] = useState<string>('');
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
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
