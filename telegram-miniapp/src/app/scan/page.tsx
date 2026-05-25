'use client';

import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Flashlight, ImageIcon } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import Button from '@/components/ui/Button';

export default function ScanPage() {
  const [hasCamera, setHasCamera] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    import('@twa-dev/sdk').then((mod) => {
      const app = mod.default;
      app.ready();
      app.expand();
    });

    // Check if camera is available
    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      setHasCamera(true);
    }
  }, []);

  const startScanning = async () => {
    if (!videoRef.current) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      videoRef.current.srcObject = stream;
      setScanning(true);
    } catch (err) {
      console.error('Camera error:', err);
      setHasCamera(false);
    }
  };

  const stopScanning = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track: MediaStreamTrack) => track.stop());
      videoRef.current.srcObject = null;
    }
    setScanning(false);
    setResult(null);
  };

  return (
    <div className="page-wrap bg-[#111] relative overflow-hidden">
      <div style={{ height: 'var(--safe-top)' }} />

      {/* Camera View */}
      <div className="relative flex-1 flex items-center justify-center">
        {hasCamera ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
            
            {/* QR Frame Overlay */}
            <div className="relative z-10 w-64 h-64">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full h-full relative"
              >
                {/* Corners */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#E91E63] rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#E91E63] rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#E91E63] rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#E91E63] rounded-br-lg" />
                
                {/* Scanning line animation */}
                <motion.div
                  animate={{ top: ['0%', '100%', '0%'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="absolute left-0 right-0 h-0.5 bg-[#E91E63] shadow-[0_0_10px_#E91E63]"
                />
              </motion.div>
            </div>

            {/* Result overlay */}
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-32 left-4 right-4 bg-white rounded-2xl p-6 z-20"
              >
                <p className="text-[#111111] font-medium text-lg mb-2">¡Código detectado!</p>
                <p className="text-[#8A8A8A] text-sm mb-4">{result}</p>
                <Button variant="primary" fullWidth>
                  Confirmar recompensa
                </Button>
              </motion.div>
            )}
          </>
        ) : (
          <div className="text-center text-white px-8">
            <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
              <ImageIcon className="w-10 h-10 text-white/60" />
            </div>
            <p className="text-lg font-medium mb-2">Cámara no disponible</p>
            <p className="text-sm text-white/60 mb-6">
              No pudimos acceder a tu cámara. Puedes ingresar el código manualmente.
            </p>
            <input
              type="text"
              placeholder="Ingresa código manualmente"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 text-center"
            />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-24 left-0 right-0 flex items-center justify-center gap-6 z-10">
        <button 
          onClick={stopScanning}
          className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center active:scale-95 transition-transform"
        >
          <X className="w-6 h-6 text-white" />
        </button>
        
        <button 
          onClick={startScanning}
          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
            scanning 
              ? 'bg-[#E91E63] shadow-lg shadow-[#E91E63]/30' 
              : 'bg-white'
          }`}
        >
          <div className={`w-16 h-16 rounded-full border-4 ${
            scanning ? 'border-white' : 'border-[#111111]'
          }`} />
        </button>
        
        <button className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center active:scale-95 transition-transform">
          <Flashlight className="w-6 h-6 text-white" />
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
