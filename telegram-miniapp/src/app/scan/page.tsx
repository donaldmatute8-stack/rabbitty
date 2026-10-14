'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Keyboard, QrCode } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';
import { QRCodeSVG } from 'qrcode.react';
import BottomNav from '@/components/BottomNav';
import Button from '@/components/ui/Button';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/features/auth/AuthProvider';

import { PlatformBridge } from '@/lib/platform';

export default function ScanPage() {
  const router = useRouter();
  const { address } = useWallet();
  const { user } = useAuth();
  
  const qrValue = user?.id || user?.telegramId || address || 'rabbitty_guest';
  const API_SERVER_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  const getAuthHeader = async () => {
    try {
      if (PlatformBridge.isTelegram()) {
        const mod = await import('@twa-dev/sdk');
        if (mod.default?.initData) return `tma ${mod.default.initData}`;
      }
    } catch {}
    const token = await PlatformBridge.getSessionToken();
    if (token) return `Bearer ${token}`;
    return "Bearer TMA_TOKEN";
  };
  const [hasCamera, setHasCamera] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [activeTab, setActiveTab] = useState<'scan' | 'my-code'>('scan');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isTransitioningRef = useRef(false);

  useEffect(() => {
    import('@twa-dev/sdk').then((mod) => {
      const app = mod.default;
      app.ready(); app.expand();
      try { app.setBackgroundColor('#111111'); app.setHeaderColor('#111111'); } catch (e) {}
    });
    if (typeof navigator !== 'undefined' && navigator.mediaDevices) setHasCamera(true);
  }, []);

  const stopScanning = async () => {
    const inst = scannerRef.current;
    if (!inst || isTransitioningRef.current) return;
    isTransitioningRef.current = true;
    try {
      if (inst.isScanning) {
        await inst.stop();
      }
    } catch {}
    try {
      inst.clear();
    } catch {}
    scannerRef.current = null;
    setScanning(false);
    isTransitioningRef.current = false;
  };

  const startScanning = async () => {
    if (isTransitioningRef.current || scannerRef.current?.isScanning) return;
    const el = document.getElementById("qr-reader");
    if (!el) return;

    try {
      isTransitioningRef.current = true;
      const html5QrCode = new Html5Qrcode("qr-reader");
      scannerRef.current = html5QrCode;
      
      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText: string) => {
          import('@twa-dev/sdk').then((mod) => {
            mod.default.HapticFeedback.notificationOccurred('success');
          }).catch(()=>{});

          // Extract intent ID and resolve it
          let intentId = decodedText;
          if (decodedText.includes('pay_pi_')) {
            intentId = 'pi_' + decodedText.split('pay_pi_')[1];
          } else if (decodedText.includes('pi_')) {
            intentId = 'pi_' + decodedText.split('pi_')[1];
          }

          setScanning(false);
          await stopScanning();

          // Resolve intent
          const authHeader = await getAuthHeader();
          const inputStr = encodeURIComponent(JSON.stringify({ "0": { intentId } }));
          fetch(`${API_SERVER_URL}/payments.getIntent?batch=1&input=${inputStr}`, {
            headers: { "Authorization": authHeader }
          })
          .then(res => res.json())
          .then(data => {
            if (data[0] && data[0].result && data[0].result.data) {
              setResult(data[0].result.data); // Store the full intent
            } else {
              alert("Intención de pago no encontrada o inválida.");
              setResult(null);
              startScanning();
            }
          })
          .catch(() => {
            alert("Error al contactar el servidor.");
            setResult(null);
            startScanning();
          });
        },
        () => {}
      );
      setScanning(true);
      setShowManualInput(false);
    } catch {
      setHasCamera(false);
    } finally {
      isTransitioningRef.current = false;
    }
  };

  useEffect(() => {
    if (activeTab === 'scan' && hasCamera && !showManualInput && !result) {
      startScanning();
    } else {
      stopScanning();
    }
    return () => {
      stopScanning();
    };
  }, [activeTab, hasCamera, showManualInput, result]);

  return (
    <div className="page-wrap bg-[#111111] text-white relative overflow-hidden min-h-dvh">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none z-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(233,30,99,0.06)_0%,transparent_65%)]" />

      {/* Header with natural top padding */}
      <div 
        className="absolute inset-x-0 z-50 px-4 flex flex-col items-center gap-4" 
        style={{ top: 'calc(var(--safe-top, 0px) + 16px)' }}
      >
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

      {/* Persistent qr-reader container in DOM to prevent lifecycle unmount crash */}
      <div 
        id="qr-reader" 
        className={`absolute inset-0 w-full h-full object-cover [&>video]:object-cover [&>video]:w-full [&>video]:h-full ${activeTab === 'scan' && hasCamera && !showManualInput ? 'block' : 'hidden'}`} 
      />

      <div 
        className="relative flex-1 w-full h-full pb-24 flex flex-col items-center justify-center z-10" 
        style={{ paddingTop: 'calc(var(--safe-top, 0px) + 110px)' }}
      >

        {/* My Code tab */}
        {activeTab === 'my-code' && (
          <div className="flex flex-col items-center justify-center w-full px-4 py-2 z-20">
            <div className="text-center mb-6">
              <span className="text-[11px] font-black uppercase tracking-[2px] text-[#E91E63] block mb-1">Mi Identificador Rabbitty</span>
              <p className="text-white/70 text-xs leading-relaxed m-0 max-w-[280px]">Muestra este código en caja para acumular Bunz o autorizar consumo.</p>
            </div>
            <div className="bg-white p-6 rounded-[32px] shadow-[0_16px_48px_rgba(233,30,99,0.3)] flex flex-col items-center">
              <QRCodeSVG
                value={String(qrValue || 'rabbitty_guest')}
                size={210}
                level="H"
                includeMargin={false}
                imageSettings={{
                  src: "/logo_conejo.png",
                  x: undefined,
                  y: undefined,
                  height: 38,
                  width: 32,
                  excavate: true,
                }}
              />
              <div className="mt-4 pt-3 border-t border-gray-100 w-full text-center">
                <span className="text-xs font-black tracking-[1.5px] text-[#111] uppercase block">
                  {user?.firstName ? user.firstName : 'Miembro Rabbitty'}
                </span>
                <span className="text-[10px] text-gray-400 font-mono tracking-wider block mt-0.5">
                  ID: {String(qrValue || '').slice(0, 16)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Camera scan tab */}
        {activeTab === 'scan' && hasCamera && !showManualInput && (
          <>
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
                  <p className="text-[#111] font-extrabold text-lg mb-[6px] flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="w-[10px] h-[10px] rounded-full bg-[#10B981] inline-block" />
                      Autorizar Pago
                    </span>
                    <span className="text-xl">${(result as any).amountMxn?.toFixed(2)} MXN</span>
                  </p>
                  
                  <div className="bg-gray-100 rounded-xl p-3 mb-4">
                    <p className="text-[#555] text-[13px]">
                      <strong>Monto Bunz requerido:</strong> {(result as any).bunzAmount?.toFixed(2)} Bunz
                    </p>
                    <p className="text-[#555] text-[13px]">
                      <strong>Establecimiento:</strong> {(result as any).tenantId}
                    </p>
                    <p className="text-[#555] text-[13px]">
                      <strong>Estado:</strong> {(result as any).status}
                    </p>
                  </div>

                  <Button 
                    variant="primary" 
                    fullWidth 
                    className="rounded-full border-0 font-extrabold bg-[#E91E63] text-white"
                    onClick={async () => {
                      const intentObj = result as any;
                      if (intentObj.status !== "PENDING_PAYMENT" && intentObj.status !== "CREATED") {
                        alert(`El pago no puede ser procesado (estado: ${intentObj.status})`);
                        return;
                      }

                      import('@twa-dev/sdk').then((mod) => {
                        mod.default.HapticFeedback.notificationOccurred('success');
                      }).catch(()=>{});

                      // Call approveIntent
                      try {
                        const authHeader = await getAuthHeader();
                        const res = await fetch(`${API_SERVER_URL}/payments.approveIntent?batch=1`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json", "Authorization": authHeader },
                          body: JSON.stringify({
                            "0": { intentId: intentObj.id }
                          })
                        });
                        
                        if (!res.ok) {
                          const errData = await res.json();
                          throw new Error(errData[0]?.error?.message || "Error al aprobar pago");
                        }
                        
                        alert("¡Pago aprobado y liquidado con éxito!");
                        setResult(null);
                        router.push('/');
                      } catch (err: any) {
                        alert(err.message);
                      }
                    }}
                  >
                    Confirmar Pago (${(result as any).amountMxn?.toFixed(2)})
                  </Button>
                  
                  <button 
                    onClick={() => { setResult(null); startScanning(); }}
                    className="w-full mt-3 py-2 text-[#888] font-bold text-sm bg-transparent border-0 cursor-pointer"
                  >
                    Cancelar
                  </button>
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
              <button 
                onClick={() => {
                  import('@twa-dev/sdk').then((mod) => {
                    mod.default.HapticFeedback.notificationOccurred('success');
                  }).catch(()=>{});
                  alert(`Código ${manualCode} verificado exitosamente`);
                  setManualCode('');
                  router.push('/');
                }}
                className="w-full bg-[#E91E63] text-white font-extrabold text-[15px] py-4 rounded-full border-0 cursor-pointer shadow-[0_6px_20px_rgba(233,30,99,0.4)]"
              >
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
