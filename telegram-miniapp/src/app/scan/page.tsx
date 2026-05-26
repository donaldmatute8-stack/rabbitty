'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Flashlight, ImageIcon, QrCode, ArrowLeft, Keyboard } from 'lucide-react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import Button from '@/components/ui/Button';

export default function ScanPage() {
  const router = useRouter();
  const [hasCamera, setHasCamera] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    import('@twa-dev/sdk').then((mod) => {
      const app = mod.default;
      app.ready();
      app.expand();
      try {
        app.setBackgroundColor('#111111');
        app.setHeaderColor('#111111');
      } catch (e) {
        console.error(e);
      }
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
      setShowManualInput(false);
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
    <div className="page-wrap bg-[#111111] text-white relative overflow-hidden">
      {/* Floating Header */}
      <div className="absolute top-0 left-0 right-0 z-50 px-4 flex items-center justify-between" style={{ top: 'calc(var(--safe-top) + 16px)' }}>
        <button 
          onClick={() => router.back()}
          className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <span className="text-sm font-semibold tracking-wider uppercase text-white/80">Escanear QR</span>
        <button 
          onClick={() => setShowManualInput(!showManualInput)}
          className={`w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-all ${
            showManualInput 
              ? 'bg-[#E91E63] border-transparent' 
              : 'bg-white/10 backdrop-blur-md border border-white/10 text-white'
          }`}
        >
          <Keyboard className="w-5 h-5" />
        </button>
      </div>

      {/* Camera View / Fallback */}
      <div className="relative flex-1 flex items-center justify-center">
        {hasCamera && !showManualInput ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Dark mask overlay outside the frame */}
            <div className="absolute inset-0 bg-black/40 z-0 pointer-events-none" />
            
            {/* QR Frame Overlay */}
            <div className="relative z-10 w-64 h-64">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full h-full relative"
              >
                {/* Glowing Corners */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#E91E63] rounded-tl-xl shadow-[-2px_-2px_8px_rgba(233,30,99,0.4)]" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#E91E63] rounded-tr-xl shadow-[2px_-2px_8px_rgba(233,30,99,0.4)]" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#E91E63] rounded-bl-xl shadow-[-2px_2px_8px_rgba(233,30,99,0.4)]" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#E91E63] rounded-br-xl shadow-[2px_2px_8px_rgba(233,30,99,0.4)]" />
                
                {/* Scanning line animation */}
                <motion.div
                  animate={{ top: ['0%', '100%', '0%'] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute left-1 right-1 h-[2px] bg-[#E91E63] shadow-[0_0_12px_#E91E63]"
                />
              </motion.div>
            </div>

            {/* Instruction Text */}
            <p className="absolute bottom-40 text-center text-sm text-white/60 z-10 w-full px-8 pointer-events-none">
              Alinea el código QR dentro del recuadro
            </p>

            {/* Result overlay */}
            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 100 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 100 }}
                  className="absolute bottom-32 left-4 right-4 bg-white rounded-3xl p-6 z-20 shadow-[0_12px_32px_rgba(0,0,0,0.25)] border border-neutral-100"
                >
                  <p className="text-[#111111] font-semibold text-lg mb-1.5 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-ping" />
                    ¡Código QR detectado!
                  </p>
                  <p className="text-[#8A8A8A] text-sm mb-5 font-light">{result}</p>
                  <Button variant="primary" fullWidth className="bg-[#111111] text-white hover:bg-neutral-900 shadow-md">
                    Confirmar recompensa
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          /* Manual Code Input / No Camera Fallback */
          <motion.div 
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center px-6 w-full max-w-sm z-10"
          >
            <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-6 relative">
              <div className="absolute inset-0 bg-white/5 rounded-full blur-md" />
              <QrCode className="w-10 h-10 text-white/70 relative z-10" strokeWidth={1.5} />
            </div>
            <p className="text-xl font-normal mb-2">Ingresar código</p>
            <p className="text-sm text-white/50 mb-6 font-light leading-relaxed">
              Introduce el código de 8 dígitos impreso en tu ticket o proporcionado por el comercio.
            </p>
            <div className="space-y-4 mb-4">
              <input
                type="text"
                placeholder="Escribe el código aquí..."
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                className="w-full bg-white/5 border border-white/10 focus:border-[#E91E63] focus:bg-white/10 rounded-2xl px-5 py-4 text-white text-lg tracking-wider placeholder-white/30 text-center uppercase focus:outline-none transition-all duration-300"
                maxLength={12}
              />
              <Button 
                variant="primary" 
                fullWidth 
                disabled={!manualCode}
                className={`py-4 rounded-2xl shadow-lg transition-all duration-300 ${
                  manualCode 
                    ? 'bg-[#E91E63] text-white hover:bg-[#C2185B]' 
                    : 'bg-white/5 text-white/30 cursor-not-allowed border border-white/5'
                }`}
              >
                Validar Consumo
              </Button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Camera Controls */}
      {hasCamera && !showManualInput && (
        <div className="absolute bottom-24 left-0 right-0 flex items-center justify-center gap-8 z-10">
          <button 
            onClick={stopScanning}
            className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center active:scale-90 transition-all hover:bg-white/10"
          >
            <X className="w-5 h-5 text-white" />
          </button>
          
          <button 
            onClick={startScanning}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
              scanning 
                ? 'bg-[#E91E63] shadow-[0_0_20px_rgba(233,30,99,0.5)] scale-105' 
                : 'bg-white hover:bg-neutral-100'
            }`}
          >
            <div className={`w-16 h-16 rounded-full border-4 transition-all duration-300 ${
              scanning ? 'border-white' : 'border-[#111111]'
            }`} />
          </button>
          
          <button className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center active:scale-90 transition-all hover:bg-white/10">
            <Flashlight className="w-5 h-5 text-white" />
          </button>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
