'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Keyboard, QrCode } from 'lucide-react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import Button from '@/components/ui/Button';
import { QRCodeSVG } from 'qrcode.react';
import { useWallet } from '@/contexts/WalletContext';

export default function ScanPage() {
  const router = useRouter();
  const { address } = useWallet();
  const [hasCamera, setHasCamera] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [activeTab, setActiveTab] = useState<'scan' | 'my-code'>('scan');
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    import('@twa-dev/sdk').then((mod) => {
      const app = mod.default;
      app.ready(); app.expand();
      try { app.setBackgroundColor('#111111'); app.setHeaderColor('#111111'); } catch (e) {}
    });
    if (typeof navigator !== 'undefined' && navigator.mediaDevices) setHasCamera(true);
  }, []);

  const startScanning = async () => {
    if (!videoRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      videoRef.current.srcObject = stream;
      setScanning(true); setShowManualInput(false);
    } catch { setHasCamera(false); }
  };

  const stopScanning = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setScanning(false); setResult(null);
  };

  useEffect(() => {
    if (activeTab === 'scan' && hasCamera && !showManualInput) startScanning();
    else stopScanning();
  }, [activeTab, hasCamera, showManualInput]);

  return (
    <div className="page-wrap bg-[#111111] text-white relative overflow-hidden">
      {/* Subtle grid overlay */}
      <div className="absolute inset-0 pointer-events-none z-0" style={{ backgroundImage: 'radial-gradient(ellipse at 50% 40%, rgba(233,30,99,0.06) 0%, transparent 65%)' }} />

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-50 px-4 flex flex-col items-center gap-4" style={{ top: 'calc(var(--safe-top) + 16px)' }}>
        <div className="flex items-center justify-between w-full">
          <button onClick={() => router.back()}
            className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center active:scale-95 transition-transform">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <span className="text-[12px] font-black tracking-[2px] uppercase text-white/75">Escanear QR</span>
          <button onClick={() => setShowManualInput(!showManualInput)}
            className={`w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-all border ${showManualInput ? 'bg-[#E91E63] border-transparent' : 'bg-white/10 border-white/10'}`}>
            <Keyboard className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-1 rounded-full flex w-[240px]">
          {(['scan','my-code'] as const).map((t, i) => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`flex-1 py-2 text-[11px] font-black rounded-full transition-colors ${activeTab === t ? 'bg-white text-black' : 'text-white/50'}`}>
              {i === 0 ? 'Cámara' : 'Mi Código'}
            </button>
          ))}
        </div>
      </div>

      <div className="relative flex-1 w-full h-full pt-[140px] pb-24 flex flex-col items-center justify-center z-10">
        {activeTab === 'my-code' ? (
          <div className="flex flex-col items-center p-8 bg-white/5 rounded-[40px] border border-white/10 mx-6 backdrop-blur-md w-full max-w-[340px] gap-5">
            <div className="w-16 h-16 bg-[#E91E63]/15 rounded-[20px] flex items-center justify-center border border-[#E91E63]/25">
              <QrCode className="w-8 h-8 text-[#E91E63]" />
            </div>
            <div className="text-center">
              <h2 className="text-[20px] font-black text-white mb-2">Tu Código Rabbitter</h2>
              <p className="text-white/50 text-[12px] leading-relaxed">Muestra este código en caja para acumular Bunz por tu consumo.</p>
            </div>
            <div className="bg-white p-5 rounded-[28px] shadow-[0_0_40px_rgba(255,255,255,0.08)]">
              {address ? (
                <QRCodeSVG value={address} size={180} level="H" className="rounded-xl" />
              ) : (
                <div className="w-[180px] h-[180px] bg-gray-100 flex items-center justify-center rounded-xl border-2 border-dashed border-gray-200">
                  <span className="text-gray-400 text-xs font-bold">Cargando...</span>
                </div>
              )}
            </div>
            {address && (
              <div className="bg-white/8 px-4 py-2 rounded-full border border-white/5">
                <p className="text-white/60 text-[10px] font-mono tracking-wider">
                  {address.substring(0, 10)}...{address.substring(address.length - 10)}
                </p>
              </div>
            )}
          </div>
        ) : hasCamera && !showManualInput ? (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/45 z-0 pointer-events-none" />

            {/* QR Frame */}
            <div className="relative z-10 w-60 h-60">
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full h-full relative">
                {[['top','left'],['top','right'],['bottom','left'],['bottom','right']].map(([v,h]) => (
                  <div key={`${v}${h}`} style={{
                    position:'absolute', [v]:0, [h]:0, width:32, height:32,
                    borderTop: v==='top' ? '3.5px solid #E91E63' : 'none',
                    borderBottom: v==='bottom' ? '3.5px solid #E91E63' : 'none',
                    borderLeft: h==='left' ? '3.5px solid #E91E63' : 'none',
                    borderRight: h==='right' ? '3.5px solid #E91E63' : 'none',
                    borderRadius: v==='top'&&h==='left'?'12px 0 0 0':v==='top'&&h==='right'?'0 12px 0 0':v==='bottom'&&h==='left'?'0 0 0 12px':'0 0 12px 0',
                    boxShadow: `${h==='left'?'-':''}2px ${v==='top'?'-':''}2px 12px rgba(233,30,99,0.5)`,
                  }} />
                ))}
                <motion.div
                  animate={{ top: ['2%', '96%', '2%'] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute left-1 right-1 h-[2px] bg-[#E91E63] shadow-[0_0_14px_#E91E63]"
                  style={{ position: 'absolute' }}
                />
              </motion.div>
            </div>
            <p className="absolute bottom-40 text-center text-[13px] text-white/50 z-10 w-full px-8 pointer-events-none">Alinea el código QR dentro del recuadro</p>

            <AnimatePresence>
              {result && (
                <motion.div initial={{ opacity: 0, y: 80 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 80 }}
                  className="absolute bottom-32 left-4 right-4 bg-white rounded-[28px] p-6 z-20 shadow-2xl border border-neutral-100">
                  <p className="text-[#111] font-black text-[18px] mb-1.5 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />¡Código detectado!
                  </p>
                  <p className="text-[#888] text-[13px] mb-5">{result}</p>
                  <Button variant="primary" fullWidth className="bg-[#111] text-white shadow-md rounded-full">Confirmar recompensa</Button>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="text-center px-6 w-full max-w-sm z-10">
            <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-6">
              <QrCode className="w-10 h-10 text-white/60" strokeWidth={1.5} />
            </div>
            <p className="text-[20px] font-black mb-2">Ingresar código</p>
            <p className="text-[13px] text-white/45 mb-6 leading-relaxed">Introduce el código de 8 dígitos del ticket o proporcionado por el comercio.</p>
            <div className="space-y-3">
              <input type="text" placeholder="Escribe el código aquí..."
                value={manualCode} onChange={e => setManualCode(e.target.value.toUpperCase())}
                className="w-full bg-white/8 border border-white/10 rounded-[20px] px-5 py-4 text-white text-center font-black text-lg tracking-[4px] placeholder:text-white/25 placeholder:text-base placeholder:tracking-normal outline-none focus:border-[#E91E63]/60 transition-colors"
              />
              <button className="w-full bg-[#E91E63] text-white font-black py-4 rounded-full active:scale-95 transition-transform text-[15px] shadow-[0_6px_20px_rgba(233,30,99,0.4)]">
                Verificar código
              </button>
            </div>
          </motion.div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
