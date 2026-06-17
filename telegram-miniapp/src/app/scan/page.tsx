'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Keyboard, QrCode } from 'lucide-react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import Button from '@/components/ui/Button';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/features/auth/AuthProvider';
import { RabbittyAnimatedBadge } from '@/components/RabbittyAnimatedBadge';

export default function ScanPage() {
  const router = useRouter();
  const { address } = useWallet();
  const { user } = useAuth();
  
  const qrValue = address || user?.id || user?.telegramId;
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
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none z-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(233,30,99,0.06)_0%,transparent_65%)]" />

      {/* Header */}
      <div className="absolute inset-x-0 z-50 px-4 flex flex-col items-center gap-4" style={{ top: 'calc(max(var(--safe-top, 0px), 50px) + 56px)' }}>
        <div className="flex items-center justify-between w-full">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center cursor-pointer"
          >
            <ArrowLeft size={20} color="#fff" />
          </button>
          <span className="text-xs font-extrabold tracking-[2px] text-white/75 uppercase">Escanear QR</span>
          <button
            onClick={() => setShowManualInput(!showManualInput)}
            className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer ${showManualInput ? 'bg-[#E91E63] border-0' : 'bg-white/10 border border-white/10'}`}
          >
            <Keyboard size={18} color="#fff" />
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-black/40 backdrop-blur-2xl border border-white/10 p-1 rounded-full flex w-[240px]">
          {(['scan', 'my-code'] as const).map((t, i) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`flex-1 py-2 text-[11px] font-extrabold rounded-full border-0 cursor-pointer transition-colors duration-200 ${activeTab === t ? 'bg-white text-[#111]' : 'bg-transparent text-white/50'}`}
            >
              {i === 0 ? 'Cámara' : 'Mi Código'}
            </button>
          ))}
        </div>
      </div>

      <div className="relative flex-1 w-full h-full pb-24 flex flex-col items-center justify-center z-10" style={{ paddingTop: 'calc(max(var(--safe-top, 0px), 50px) + 140px)' }}>

        {/* My Code tab */}
        {activeTab === 'my-code' && (
          <div className="flex flex-col items-center gap-5 p-8 bg-white/5 rounded-[40px] border border-white/10 mx-6 backdrop-blur-md w-[calc(100%-48px)] max-w-[340px]">
            <div className="w-16 h-16 bg-[rgba(233,30,99,0.15)] rounded-[20px] border border-[rgba(233,30,99,0.25)] flex items-center justify-center">
              <QrCode size={32} color="#E91E63" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-extrabold text-white m-0 mb-2">Tu Código Rabbitter</h2>
              <p className="text-white/50 text-xs leading-[1.6] m-0">Muestra este código en caja para acumular Bunz por tu consumo.</p>
            </div>
            <div className="flex items-center justify-center min-h-[300px] w-full">
              {qrValue ? (
                <RabbittyAnimatedBadge value={qrValue} size={220} />
              ) : (
                <div className="w-[180px] h-[180px] bg-white/[0.03] flex items-center justify-center rounded-xl border-2 border-dashed border-white/10">
                  <span className="text-white/40 text-xs font-bold">Cargando...</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Camera scan tab */}
        {activeTab === 'scan' && hasCamera && !showManualInput && (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/45 z-0" />

            {/* QR Frame */}
            <div className="relative z-10 w-[240px] h-[240px]">
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full h-full relative">
                {[['top','left'],['top','right'],['bottom','left'],['bottom','right']].map(([v,h]) => (
                  <div key={`${v}${h}`} style={{
                    position: 'absolute', [v]: 0, [h]: 0, width: 32, height: 32,
                    borderTop: v === 'top' ? '3.5px solid #E91E63' : 'none',
                    borderBottom: v === 'bottom' ? '3.5px solid #E91E63' : 'none',
                    borderLeft: h === 'left' ? '3.5px solid #E91E63' : 'none',
                    borderRight: h === 'right' ? '3.5px solid #E91E63' : 'none',
                    borderRadius: v==='top'&&h==='left'?'12px 0 0 0':v==='top'&&h==='right'?'0 12px 0 0':v==='bottom'&&h==='left'?'0 0 0 12px':'0 0 12px 0',
                    boxShadow: `${h==='left'?'-':''}2px ${v==='top'?'-':''}2px 12px rgba(233,30,99,0.5)`,
                  }} />
                ))}
                <motion.div
                  animate={{ top: ['2%', '96%', '2%'] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute left-1 right-1 h-0.5 bg-[#E91E63] shadow-[0_0_14px_#E91E63]"
                />
              </motion.div>
            </div>

            <p className="absolute bottom-[160px] text-center text-[13px] text-white/50 z-10 w-full px-8 pointer-events-none">
              Alinea el código QR dentro del recuadro
            </p>

            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 80 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 80 }}
                  className="absolute bottom-32 left-4 right-4 bg-white rounded-[28px] p-6 z-20 shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-[#F0F0F0]"
                >
                  <p className="text-[#111] font-extrabold text-lg mb-[6px] flex items-center gap-2">
                    <span className="w-[10px] h-[10px] rounded-full bg-[#10B981] inline-block" />
                    ¡Código detectado!
                  </p>
                  <p className="text-[#888] text-[13px] mb-5">{result}</p>
                  <Button variant="primary" fullWidth className="rounded-full border-0 font-extrabold">
                    Confirmar recompensa
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* Manual code tab */}
        {activeTab === 'scan' && (!hasCamera || showManualInput) && (
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
            className="text-center px-6 w-full max-w-[360px] z-10">
            <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-6">
              <QrCode size={40} color="rgba(255,255,255,0.6)" strokeWidth={1.5} />
            </div>
            <p className="text-xl font-extrabold text-white mb-2">Ingresar código</p>
            <p className="text-[13px] text-white/45 mb-6 leading-[1.6]">
              Introduce el código de 8 dígitos del ticket o proporcionado por el comercio.
            </p>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Escribe el código aquí..."
                value={manualCode}
                onChange={e => setManualCode(e.target.value.toUpperCase())}
                className="w-full bg-white/[0.08] border border-white/10 rounded-[20px] px-5 py-4 text-white text-center font-extrabold text-lg tracking-[4px] outline-none box-border"
              />
              <button className="w-full bg-[#E91E63] text-white font-extrabold text-[15px] py-4 rounded-full border-0 cursor-pointer shadow-[0_6px_20px_rgba(233,30,99,0.4)]">
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
