'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Keyboard, QrCode } from 'lucide-react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import Button from '@/components/ui/Button';
import { QRCodeSVG } from 'qrcode.react';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/features/auth/AuthProvider';

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
    <div className="page-wrap" style={{ background: '#111111', color: '#fff', position: 'relative', overflow: 'hidden' }}>
      {/* Background glow */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, background: 'radial-gradient(ellipse at 50% 40%, rgba(233,30,99,0.06) 0%, transparent 65%)' }} />

      {/* Header */}
      <div style={{ position: 'absolute', left: 0, right: 0, zIndex: 50, padding: '0 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, top: 'calc(var(--safe-top, 16px) + 16px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <button
            onClick={() => router.back()}
            style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <ArrowLeft size={20} color="#fff" />
          </button>
          <span style={{ fontSize: 12, fontWeight: 900, letterSpacing: 2, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase' }}>Escanear QR</span>
          <button
            onClick={() => setShowManualInput(!showManualInput)}
            style={{ width: 40, height: 40, borderRadius: '50%', background: showManualInput ? '#E91E63' : 'rgba(255,255,255,0.1)', border: showManualInput ? 'none' : '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <Keyboard size={18} color="#fff" />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', padding: 4, borderRadius: 999, display: 'flex', width: 240 }}>
          {(['scan', 'my-code'] as const).map((t, i) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              style={{
                flex: 1, padding: '8px 0', fontSize: 11, fontWeight: 900, borderRadius: 999, border: 'none', cursor: 'pointer',
                background: activeTab === t ? '#fff' : 'transparent',
                color: activeTab === t ? '#111' : 'rgba(255,255,255,0.5)',
                transition: 'background 0.2s, color 0.2s',
              }}
            >
              {i === 0 ? 'Cámara' : 'Mi Código'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ position: 'relative', flex: 1, width: '100%', height: '100%', paddingTop: 140, paddingBottom: 96, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>

        {/* My Code tab */}
        {activeTab === 'my-code' && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
            padding: 32, background: 'rgba(255,255,255,0.05)', borderRadius: 40,
            border: '1px solid rgba(255,255,255,0.1)', margin: '0 24px',
            backdropFilter: 'blur(12px)', width: 'calc(100% - 48px)', maxWidth: 340,
          }}>
            <div style={{ width: 64, height: 64, background: 'rgba(233,30,99,0.15)', borderRadius: 20, border: '1px solid rgba(233,30,99,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <QrCode size={32} color="#E91E63" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: '0 0 8px' }}>Tu Código Rabbitter</h2>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 1.6, margin: 0 }}>Muestra este código en caja para acumular Bunz por tu consumo.</p>
            </div>
            <div style={{ background: '#fff', padding: 20, borderRadius: 28, boxShadow: '0 0 40px rgba(255,255,255,0.08)' }}>
              {qrValue ? (
                <QRCodeSVG value={qrValue} size={180} level="H" style={{ borderRadius: 12, display: 'block' }} />
              ) : (
                <div style={{ width: 180, height: 180, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, border: '2px dashed #E5E7EB' }}>
                  <span style={{ color: '#9CA3AF', fontSize: 12, fontWeight: 700 }}>Cargando...</span>
                </div>
              )}
            </div>
            {qrValue && (
              <div style={{ background: 'rgba(255,255,255,0.08)', padding: '8px 16px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.05)' }}>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontFamily: 'monospace', letterSpacing: 1, margin: 0 }}>
                  {qrValue.substring(0, 10)}...{qrValue.substring(qrValue.length - 10)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Camera scan tab */}
        {activeTab === 'scan' && hasCamera && !showManualInput && (
          <>
            <video ref={videoRef} autoPlay playsInline muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 0 }} />

            {/* QR Frame */}
            <div style={{ position: 'relative', zIndex: 10, width: 240, height: 240 }}>
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ width: '100%', height: '100%', position: 'relative' }}>
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
                  style={{ position: 'absolute', left: 4, right: 4, height: 2, background: '#E91E63', boxShadow: '0 0 14px #E91E63' }}
                />
              </motion.div>
            </div>

            <p style={{ position: 'absolute', bottom: 160, textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.5)', zIndex: 10, width: '100%', padding: '0 32px', pointerEvents: 'none' }}>
              Alinea el código QR dentro del recuadro
            </p>

            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 80 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 80 }}
                  style={{ position: 'absolute', bottom: 128, left: 16, right: 16, background: '#fff', borderRadius: 28, padding: 24, zIndex: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', border: '1px solid #F0F0F0' }}
                >
                  <p style={{ color: '#111', fontWeight: 900, fontSize: 18, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                    ¡Código detectado!
                  </p>
                  <p style={{ color: '#888', fontSize: 13, marginBottom: 20 }}>{result}</p>
                  <Button variant="primary" fullWidth style={{ background: '#111', color: '#fff', borderRadius: 999, border: 'none', fontWeight: 900 }}>
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
            style={{ textAlign: 'center', padding: '0 24px', width: '100%', maxWidth: 360, zIndex: 10 }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <QrCode size={40} color="rgba(255,255,255,0.6)" strokeWidth={1.5} />
            </div>
            <p style={{ fontSize: 20, fontWeight: 900, color: '#fff', marginBottom: 8 }}>Ingresar código</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 24, lineHeight: 1.6 }}>
              Introduce el código de 8 dígitos del ticket o proporcionado por el comercio.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="text"
                placeholder="Escribe el código aquí..."
                value={manualCode}
                onChange={e => setManualCode(e.target.value.toUpperCase())}
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 20, padding: '16px 20px', color: '#fff', textAlign: 'center',
                  fontWeight: 900, fontSize: 18, letterSpacing: 4, outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <button style={{
                width: '100%', background: '#E91E63', color: '#fff',
                fontWeight: 900, fontSize: 15, padding: '16px 0', borderRadius: 999,
                border: 'none', cursor: 'pointer',
                boxShadow: '0 6px 20px rgba(233,30,99,0.4)',
              }}>
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
