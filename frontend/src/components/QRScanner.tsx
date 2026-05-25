"use client";

import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
}

export default function QRScanner({ isOpen, onClose, onScan }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasCamera, setHasCamera] = useState(true);
  const [scanResult, setScanResult] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let stream: MediaStream | null = null;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setHasCamera(true);
      } catch {
        setHasCamera(false);
      }
    }

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 h-14">
        <span className="text-white text-[15px] font-normal">Scan QR</span>
        <button onClick={onClose} className="p-1 text-white active:opacity-60">
          <X size={24} strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex-1 relative">
        {hasCamera ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Corner brackets */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-56 h-56 relative">
                <div className="absolute top-0 left-0 w-8 h-8 border-l-[2.5px] border-t-[2.5px] border-[#e91e63]" />
                <div className="absolute top-0 right-0 w-8 h-8 border-r-[2.5px] border-t-[2.5px] border-[#e91e63]" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-l-[2.5px] border-b-[2.5px] border-[#e91e63]" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-r-[2.5px] border-b-[2.5px] border-[#e91e63]" />
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-white gap-3 px-6">
            <div className="text-sm opacity-70">Camera not available</div>
            <input
              type="text"
              placeholder="Paste QR data..."
              className="w-full bg-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/50 outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onScan(e.currentTarget.value);
                  onClose();
                }
              }}
            />
          </div>
        )}
      </div>

      {scanResult && (
        <div className="p-4 bg-[#111111]">
          <div className="text-white text-sm">Scanned: {scanResult}</div>
          <button
            onClick={() => {
              onScan(scanResult);
              onClose();
            }}
            className="mt-3 w-full py-3 bg-[#e91e63] text-white rounded-xl text-sm font-normal active:opacity-80"
          >
            Confirm
          </button>
        </div>
      )}
    </div>
  );
}
