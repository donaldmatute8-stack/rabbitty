'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Keyboard } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';
import RabbittyCode from '@/components/ui/RabbittyCode';
import BottomNav from '@/components/BottomNav';
import Button from '@/components/ui/Button';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/features/auth/AuthProvider';

import { PlatformBridge } from '@/lib/platform';

interface PaymentIntentData {
  id?: string;
  amountMxn?: number;
  bunzAmount?: number;
  tenantId?: string;
  status?: string;
}

export default function ScanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'my-code' ? 'my-code' : 'scan';

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
  const [hasCamera, setHasCamera] = useState(() => typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices));
  const [result, setResult] = useState<PaymentIntentData | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [activeTab, setActiveTab] = useState<'scan' | 'my-code'>(initialTab);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isTransitioningRef = useRef(false);
  const startScanningRef = useRef<() => void>(() => {});

  useEffect(() => {
    import('@twa-dev/sdk').then((mod) => {
      const app = mod.default;
      app.ready(); app.expand();
      try { app.setBackgroundColor('#111111'); app.setHeaderColor('#111111'); } catch {}
    });
  }, []);

  const requestCameraAccess = async () => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        stream.getTracks().forEach(t => t.stop());
        setHasCamera(true);
      } catch (e) {
        console.error("Camera access failed:", e);
        setHasCamera(false);
      }
    }
  };

  const stopScanning = useCallback(async () => {
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
    isTransitioningRef.current = false;
  }, []);

  const startScanning = useCallback(async () => {
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

          // P2P payment link or POS intent link
          if (/^rabbitty:\/\/pay/i.test(decodedText.trim())) {
            try {
              const parsed = new URL(decodedText.trim());
              const to = parsed.searchParams.get('to');
              const intent = parsed.searchParams.get('intent');
              if (intent) {
                // If it's a POS payment intent from Rabbitty POS
                decodedText = intent;
              } else if (to) {
                await stopScanning();
                router.push(`/profile/wallet?to=${encodeURIComponent(to)}`);
                return;
              }
            } catch {}
          }

          // 0. Enlace de vinculación del panel de negocio (iPad) → este teléfono
          if (decodedText.includes('/magic-link') && decodedText.includes('token=') && decodedText.includes('sid=')) {
            try {
              const url = new URL(decodedText, window.location.origin);
              const token = url.searchParams.get('token');
              const sid = url.searchParams.get('sid');
              if (token && sid) {
                await stopScanning();
                router.push(`/magic-link?token=${encodeURIComponent(token)}&sid=${encodeURIComponent(sid)}`);
                return;
              }
            } catch {}
          }

          // 1. Check if it is a QR Login for PC/Admin
          if (decodedText.includes('qrlogin_')) {
            const qrToken = decodedText.split('qrlogin_')[1].split('&')[0].split('?')[0];
            await stopScanning();
            try {
              const headers = await PlatformBridge.getAuthHeaders();
              const res = await fetch('/api/auth/qr/scan', {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ qrToken })
              });
              const data = await res.json();
              if (data.success) {
                alert("¡Inicio de sesión exitoso en la PC! 🪄");
                router.push('/profile');
                return;
              } else {
                alert("Error de inicio de sesión QR: " + (data.error || 'Token inválido'));
                startScanningRef.current();
                return;
              }
            } catch {
              alert("Error de conexión al validar el QR.");
              startScanningRef.current();
              return;
            }
          }

          // 2. Extract intent ID and resolve it (POS Payment)
          let intentId = decodedText.trim();
          if (intentId.includes('pay_')) {
            const rawAfterPay = intentId.split('pay_')[1];
            intentId = rawAfterPay.split(/[&?#\s]/)[0];
          } else if (intentId.includes('pi_')) {
            const rawAfterPi = 'pi_' + intentId.split('pi_')[1];
            intentId = rawAfterPi.split(/[&?#\s]/)[0];
          }

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
              startScanningRef.current();
            }
          })
          .catch(() => {
            alert("Error al contactar el servidor.");
            setResult(null);
            startScanningRef.current();
          });
        },
        () => {}
      );
      setShowManualInput(false);
    } catch {
      setHasCamera(false);
    } finally {
      isTransitioningRef.current = false;
    }
  }, [API_SERVER_URL, router, stopScanning]);

  useEffect(() => {
    startScanningRef.current = startScanning;
  }, [startScanning]);

  useEffect(() => {
    if (activeTab === 'scan' && hasCamera && !showManualInput && !result) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      startScanning();
    } else {
      stopScanning();
    }
    return () => {
      stopScanning();
    };
  }, [activeTab, hasCamera, showManualInput, result, startScanning, stopScanning]);

  return (
    <div 
      className={`page-wrap ${activeTab === 'scan' ? 'bg-black' : 'bg-[#111111]'} text-white relative min-h-dvh flex flex-col justify-between transition-colors duration-200`} 
      style={{ paddingTop: 'calc(var(--safe-top, 0px) + 8px)' }}
    >
      {/* Background glow only on my-code tab */}
      {activeTab === 'my-code' && (
        <div className="absolute inset-0 pointer-events-none z-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(233,30,99,0.06)_0%,transparent_65%)]" />
      )}

      {/* Header bar */}
      <div className="relative z-50 px-4 w-full flex flex-col items-center gap-3">
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
        <div className="bg-black/40 backdrop-blur-2xl border border-white/10 p-1 rounded-full flex w-60">
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

      {/* Main Content Area */}
      <div className="relative flex-1 w-full flex flex-col items-center justify-center z-10 px-4 py-4">

        {/* My Code tab - Official Rabbitty Code Hologram */}
        {activeTab === 'my-code' && (
          <div className="flex flex-col items-center justify-center w-full max-w-85 z-20">
            <div className="text-center mb-6 px-2">
              <span className="text-[11px] font-black uppercase tracking-[2px] text-[#E91E63] block mb-1">Mi Identificador Rabbitty</span>
              <p className="text-white/60 text-xs leading-relaxed m-0">Muestra este código en caja para acumular Bunz o autorizar consumo.</p>
            </div>
            
            <div className="flex flex-col items-center justify-center pt-8">
              <RabbittyCode 
                data={String(qrValue || 'rabbitty_guest')} 
                size={195} 
                showCardFrame={true} 
              />
              <div className="mt-3 text-center">
                <span className="text-sm font-black tracking-[1.5px] text-white uppercase block">
                  {user?.firstName ? user.firstName : 'Miembro Rabbitty'}
                </span>
                <span className="text-[11px] text-gray-400 font-mono tracking-wider block mt-0.5">
                  ID: {String(qrValue || '').slice(0, 16)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Camera scan tab */}
        {activeTab === 'scan' && (
          <div className="w-full flex flex-col items-center justify-center relative">

            {/* QR Viewfinder Container: Camera Video is rendered strictly INSIDE this frame */}
            <div className="relative w-70 h-70 rounded-[28px] overflow-hidden bg-black/90 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] mb-6 flex items-center justify-center">
              
              {/* Persistent qr-reader container in DOM strictly contained inside the viewfinder */}
              <div 
                id="qr-reader" 
                className={`absolute inset-0 w-full h-full [&>video]:object-cover [&>video]:w-full [&>video]:h-full [&_#qr-shaded-region]:hidden ${hasCamera && !showManualInput ? 'block' : 'hidden'}`} 
              />

              {/* Neon Corners Overlay */}
              <div className="absolute inset-0 pointer-events-none z-20">
                {[['top','left'],['top','right'],['bottom','left'],['bottom','right']].map(([v,h]) => (
                  <div key={`${v}${h}`} style={{
                    position: 'absolute', [v]: 8, [h]: 8, width: 32, height: 32,
                    borderTop: v === 'top' ? '3.5px solid #E91E63' : 'none',
                    borderBottom: v === 'bottom' ? '3.5px solid #E91E63' : 'none',
                    borderLeft: h === 'left' ? '3.5px solid #E91E63' : 'none',
                    borderRight: h === 'right' ? '3.5px solid #E91E63' : 'none',
                    borderRadius: v==='top'&&h==='left'?'10px 0 0 0':v==='top'&&h==='right'?'0 10px 0 0':v==='bottom'&&h==='left'?'0 0 0 10px':'0 0 10px 0',
                    boxShadow: `${h==='left'?'-':''}2px ${v==='top'?'-':''}2px 14px rgba(233,30,99,0.7)`,
                  }} />
                ))}

                {/* Laser animation inside frame */}
                <motion.div
                  animate={{ top: ['4%', '94%', '4%'] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute left-3 right-3 h-0.5 bg-[#E91E63] shadow-[0_0_14px_#E91E63]"
                />
              </div>

              {!hasCamera && (
                <div className="z-30 text-center p-4 flex flex-col items-center gap-3">
                  <p className="text-xs text-white/70 m-0">Cámara no disponible o permiso denegado</p>
                  <button
                    onClick={requestCameraAccess}
                    className="px-4 py-2 rounded-full bg-[#E91E63] text-white text-xs font-bold border-none cursor-pointer active:scale-95 transition-transform shadow-lg shadow-[#E91E63]/30"
                  >
                    Activar cámara
                  </button>
                </div>
              )}
            </div>

            <p className="text-center text-[13px] text-white/60 z-10 px-8 pointer-events-none mb-6">
              Alinea el código QR dentro del recuadro
            </p>

            {/* Ingreso manual abajo de la cámara */}
            <div className="w-full max-w-[320px] px-4 z-20">
              <button
                type="button"
                onClick={() => setShowManualInput(!showManualInput)}
                className="w-full py-3 px-4 bg-white/10 hover:bg-white/15 backdrop-blur-xl border border-white/15 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold text-white transition-colors cursor-pointer"
              >
                <Keyboard size={16} />
                <span>{showManualInput ? 'Ocultar ingreso manual' : '¿No puedes escanear? Escribe el código'}</span>
              </button>

              <AnimatePresence>
                {showManualInput && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 flex flex-col gap-2 overflow-hidden"
                  >
                    <input
                      type="text"
                      placeholder="Código de 8 dígitos..."
                      value={manualCode}
                      onChange={e => setManualCode(e.target.value.toUpperCase())}
                      className="w-full bg-black/70 border border-white/20 rounded-xl px-4 py-3 text-white text-center font-mono font-bold text-base tracking-[2px] outline-none"
                    />
                    <button
                      onClick={() => {
                        if (!manualCode.trim()) return;
                        alert(`Código ${manualCode} verificado exitosamente`);
                        setManualCode('');
                        router.push('/');
                      }}
                      className="w-full bg-[#E91E63] text-white font-extrabold text-xs py-3 rounded-xl border-0 cursor-pointer shadow-lg shadow-[#E91E63]/30"
                    >
                      Verificar código
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 80 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 80 }}
                  className="absolute bottom-32 left-4 right-4 bg-white rounded-[28px] p-6 z-30 shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-[#F0F0F0]"
                >
                  <p className="text-[#111] font-extrabold text-lg mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] inline-block" />
                      Autorizar Pago
                    </span>
                    <span className="text-xl">${result.amountMxn?.toFixed(2)} MXN</span>
                  </p>
                  
                  <div className="bg-gray-100 rounded-xl p-3 mb-4">
                    <p className="text-[#555] text-[13px]">
                      <strong>Monto Bunz requerido:</strong> {result.bunzAmount?.toFixed(2)} Bunz
                    </p>
                    <p className="text-[#555] text-[13px]">
                      <strong>Establecimiento:</strong> {result.tenantId}
                    </p>
                    <p className="text-[#555] text-[13px]">
                      <strong>Estado:</strong> {result.status}
                    </p>
                  </div>

                  <Button 
                    variant="primary" 
                    fullWidth 
                    className="rounded-full border-0 font-extrabold bg-[#E91E63] text-white"
                    onClick={async () => {
                      const intentObj = result;
                      if (intentObj.status !== "PENDING_PAYMENT" && intentObj.status !== "CREATED") {
                        alert(`El pago no puede ser procesado (estado: ${intentObj.status})`);
                        return;
                      }

                      import('@twa-dev/sdk').then((mod) => {
                        mod.default.HapticFeedback.notificationOccurred('success');
                      }).catch(()=>{});

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
                      } catch (err: unknown) {
                        const msg = err instanceof Error ? err.message : "Error al procesar pago";
                        alert(msg);
                      }
                    }}
                  >
                    Confirmar Pago (${result.amountMxn?.toFixed(2)})
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
          </div>
        )}

      </div>
      <BottomNav />
    </div>
  );
}
