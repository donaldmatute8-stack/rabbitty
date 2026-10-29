'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Keyboard } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';
import RabbittyCode from '@/components/ui/RabbittyCode';
import { QRCodeSVG } from 'qrcode.react';
import BottomNav from '@/components/BottomNav';
import Button from '@/components/ui/Button';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTheme } from '@/contexts/ThemeContext';
import { resolveScannedPayload } from '@/lib/scannerResolver';

import { PlatformBridge } from '@/lib/platform';
import { useToast } from '@/contexts/ToastContext';

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
  const { isDark } = useTheme();
  const { showToast } = useToast();
  
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
      try { 
        const bg = isDark ? '#111111' : '#F8F9FA';
        app.setBackgroundColor(bg); 
        app.setHeaderColor(bg); 
      } catch {}
    });

    // Auto-login PC/Portal si el usuario abrió el link directo /scan?qrlogin_...
    const rawSearch = typeof window !== 'undefined' ? window.location.search : '';
    const urlQrLogin =
      searchParams.get('qrlogin') ||
      (rawSearch.includes('qrlogin_') ? rawSearch.split('qrlogin_')[1]?.split('&')[0]?.split('?')[0] : null);
    if (urlQrLogin) {
      (async () => {
        try {
          const headers = await PlatformBridge.getAuthHeaders();
          const res = await fetch('/api/auth/qr/scan', {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ qrToken: urlQrLogin }),
          });
          const data = await res.json();
          if (data.success) {
            alert('¡Acceso autorizado exitosamente en tu pantalla! 🪄');
            router.push('/profile');
          } else {
            alert('Error de autorización QR: ' + (data.error || 'Token inválido o expirado'));
          }
        } catch {
          alert('Error de conexión al autorizar el acceso QR.');
        }
      })();
      return;
    }

    // Auto-reclamo si el usuario abrió el link directo del ticket /scan?claimToken=...
    const urlClaimToken = searchParams.get('claimToken') || searchParams.get('claim');
    if (urlClaimToken) {
      (async () => {
        try {
          const headers = await PlatformBridge.getAuthHeaders();
          const claimRes = await fetch('/api/pos/claim-ticket', {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ claimToken: urlClaimToken }),
          });
          const claimData = await claimRes.json();
          if (claimData.success) {
            alert(`🐰 ¡Felicidades! Se han acreditado +${claimData.bunzAwarded} Bunz a tu cuenta por el ticket #${claimData.orderNumber}.`);
            router.push('/profile/wallet');
          } else {
            alert(claimData.error || 'No se pudo reclamar este ticket.');
          }
        } catch {
          alert('Error al conectar con el servidor para reclamar el ticket.');
        }
      })();
    }

    // Auto-vinculación a mesa si el usuario abrió el link directo /scan?tableId=... o /scan?table=...
    const urlTableId = searchParams.get('tableId') || searchParams.get('table');
    const urlBranchId = searchParams.get('branchId') || searchParams.get('branch');
    const urlBusiness = searchParams.get('business') || 'este comercio';

    if (urlTableId) {
      (async () => {
        try {
          const headers = await PlatformBridge.getAuthHeaders();
          const tableRes = await fetch('/api/pos/claim-table', {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ tableId: urlTableId, branchId: urlBranchId || undefined }),
          });
          const tableData = await tableRes.json();
          if (tableData.success) {
            alert(`🐰 ¡Conectado a la Mesa #${tableData.table.number}! Tu comanda está abierta en caja y acumularás Bunz.`);
            router.push(`/pos-menu/${urlTableId}`);
          } else {
            alert(tableData.error || 'No se pudo vincular a la mesa.');
          }
        } catch {
          alert('Error al conectar con el servidor para vincular a la mesa.');
        }
      })();
    } else if (urlBranchId && !urlClaimToken) {
      // 🐰 Check-in de mostrador (QR Neón sin mesa)
      try {
        localStorage.setItem('rabbitty_last_branch_id', urlBranchId);
        localStorage.setItem('rabbitty_last_business_name', urlBusiness);
      } catch {}
      alert(`🐰 ¡Estás en ${urlBusiness}! Check-in registrado. Tus compras acumulan Bunz automáticamente.`);
      router.push('/profile/wallet');
    }
  }, [isDark, searchParams, router]);

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

  const handleDispatchPayload = useCallback(async (rawPayload: string | number) => {
    PlatformBridge.hapticFeedback('success');

    const res = await resolveScannedPayload(rawPayload);
    if (!res.success) {
      if (res.error) alert(res.error);
      startScanningRef.current();
      return;
    }

    // 1. Magic Link (terminal iPad / caja)
    if (res.type === 'magic_link' && res.magicLink) {
      await stopScanning();
      router.push(`/magic-link?token=${encodeURIComponent(res.magicLink.token)}&sid=${encodeURIComponent(res.magicLink.sid)}`);
      return;
    }

    // 2. Ticket Claim (claimToken)
    if (res.type === 'claim' && res.claimToken) {
      await stopScanning();
      try {
        const headers = await PlatformBridge.getAuthHeaders();
        const claimRes = await fetch('/api/pos/claim-ticket', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ claimToken: res.claimToken }),
        });
        const claimData = await claimRes.json();
        if (claimData.success) {
          alert(`🐰 ¡Felicidades! Se han acreditado +${claimData.bunzAwarded} Bunz a tu cuenta por el ticket #${claimData.orderNumber}.`);
          router.push('/profile/wallet');
          return;
        } else {
          alert(claimData.error || 'No se pudo reclamar este ticket.');
          startScanningRef.current();
          return;
        }
      } catch {
        alert('Error al conectar con el servidor para reclamar el ticket.');
        startScanningRef.current();
        return;
      }
    }

    // 3. Table QR
    if (res.type === 'table' && res.table) {
      await stopScanning();
      try {
        const headers = await PlatformBridge.getAuthHeaders();
        const tableRes = await fetch('/api/pos/claim-table', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ tableId: res.table.tableId, branchId: res.table.branchId }),
        });
        const tableData = await tableRes.json();
        if (tableData.success) {
          alert(`🐰 ¡Conectado a la Mesa #${tableData.table.number}! Tu comanda está abierta en caja y acumularás Bunz.`);
          router.push(`/pos-menu/${res.table.tableId}`);
          return;
        } else {
          alert(tableData.error || 'No se pudo vincular a la mesa.');
          startScanningRef.current();
          return;
        }
      } catch {
        alert('Error al conectar con el servidor para vincular a la mesa.');
        startScanningRef.current();
        return;
      }
    }

    // 4. Negocio afiliado / check-in
    if (res.type === 'business' && res.business) {
      await stopScanning();
      router.push(`/affiliate/${res.business.id}`);
      return;
    }

    // 5. Usuario (@handle / id)
    if (res.type === 'user' && res.user) {
      await stopScanning();
      router.push(`/profile/wallet?to=${encodeURIComponent(res.user.handle || res.user.id)}`);
      return;
    }

    // 6. QR Login (/impresos o PC)
    if (res.type === 'qrlogin' && res.qrLogin) {
      await stopScanning();
      try {
        const headers = await PlatformBridge.getAuthHeaders();
        const bindRes = await fetch('/api/auth/qr/scan', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ qrToken: res.qrLogin.qrToken }),
        });
        const bindData = await bindRes.json();
        if (bindData?.success) {
          alert('¡Acceso autorizado en la pantalla! 🪄');
          return;
        }
      } catch {}
      startScanningRef.current();
      return;
    }

    // 7. URL externa
    if (res.type === 'url' && res.url) {
      await stopScanning();
      if (PlatformBridge.isNative()) {
        import('@capacitor/browser').then(({ Browser }) => Browser.open({ url: res.url! })).catch(() => { window.open(res.url, '_blank'); });
      } else if (PlatformBridge.isTelegram()) {
        import('@twa-dev/sdk').then((mod) => mod.default.openLink(res.url!)).catch(() => { window.open(res.url, '_blank'); });
      } else {
        window.open(res.url, '_blank');
      }
      return;
    }

    // 8. POS Payment Intent
    let intentId = res.intent || (typeof rawPayload === 'string' ? rawPayload.trim() : '');
    if (intentId.includes('pay_')) {
      intentId = intentId.split('pay_')[1].split(/[&?#\s]/)[0];
    } else if (intentId.includes('pi_')) {
      intentId = 'pi_' + intentId.split('pi_')[1].split(/[&?#\s]/)[0];
    }

    if (intentId) {
      await stopScanning();
      const authHeader = await getAuthHeader();
      const inputStr = encodeURIComponent(JSON.stringify({ "0": { intentId } }));
      fetch(`${API_SERVER_URL}/payments.getIntent?batch=1&input=${inputStr}`, {
        headers: { "Authorization": authHeader }
      })
      .then(r => r.json())
      .then(data => {
        if (data[0] && data[0].result && data[0].result.data) {
          setResult(data[0].result.data);
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
      return;
    }

    // Fallback no reconocido
    startScanningRef.current();
  }, [API_SERVER_URL, router, stopScanning]);

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
          await handleDispatchPayload(decodedText);
        },
        () => {}
      );
      setShowManualInput(false);
    } catch {
      setHasCamera(false);
    } finally {
      isTransitioningRef.current = false;
    }
  }, [handleDispatchPayload]);

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

  // Detector óptico en vivo para nuestro QR Neón propietario (RabbittyCode)
  useEffect(() => {
    if (activeTab !== 'scan' || !hasCamera || showManualInput || result) return;

    let consecutiveNeonFrames = 0;
    let isSubmittingOptical = false;
    let decodeFailCount = 0;
    let hintShown = false;
    const hiCanvasRef: { current: HTMLCanvasElement | null } = { current: null };
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const interval = setInterval(async () => {
      if (isSubmittingOptical || !ctx) return;
      const container = document.getElementById('qr-reader');
      const video = container?.querySelector('video');
      if (!video || video.readyState < 2 || video.videoWidth === 0) return;

      try {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const cropSize = Math.min(vw, vh) * 0.65;
        const sx = (vw - cropSize) / 2;
        const sy = (vh - cropSize) / 2;
        ctx.drawImage(video, sx, sy, cropSize, cropSize, 0, 0, 64, 64);
        const pixels = ctx.getImageData(0, 0, 64, 64).data;

        let darkObsidianCount = 0;
        let neonPinkPurpleCount = 0;
        const totalPixels = 64 * 64;

        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];

          // Fondo oscuro/medio-oscuro de RabbittyCode (tolerante a reflejos de pantalla/cristal)
          if (r <= 145 && g <= 125 && b <= 160) {
            darkObsidianCount++;
          }
          // Anillos, esquinas y barras de onda neón (rosa/magenta #F43F5E, morado #8B5CF6, núcleo brillante)
          if (
            (r >= 110 && b >= 75 && r - g >= 20) ||
            (b >= 110 && r >= 65 && b - g >= 20) ||
            (r >= 190 && b >= 160 && g >= 100 && r - g >= 15)
          ) {
            neonPinkPurpleCount++;
          }
        }

        const darkRatio = darkObsidianCount / totalPixels;
        const neonRatio = neonPinkPurpleCount / totalPixels;

        if (darkRatio >= 0.2 && neonRatio >= 0.012) {
          consecutiveNeonFrames++;
        } else {
          consecutiveNeonFrames = 0;
        }

        if (consecutiveNeonFrames >= 2) {
          consecutiveNeonFrames = 0;
          isSubmittingOptical = true;

          // ── Decodificar las 13 barras de onda (payload machine-readable) ──
          const HI = 240;
          const hiCanvas = hiCanvasRef.current ?? document.createElement('canvas');
          hiCanvasRef.current = hiCanvas;
          hiCanvas.width = HI;
          hiCanvas.height = HI;
          const hctx = hiCanvas.getContext('2d', { willReadFrequently: true });
          if (!hctx) { isSubmittingOptical = false; return; }
          hctx.drawImage(video, sx, sy, cropSize, cropSize, 0, 0, HI, HI);
          const hiData = hctx.getImageData(0, 0, HI, HI).data;

          // Medir las 13 barras por POSICIÓN ESPERADA (equidistantes — robusto a resolución/reflejos)
          const { measureBarsFromFrame, codeFromBars } = await import('@/lib/rabbittyCodeCodec');
          const heights = measureBarsFromFrame(hiData, HI);
          let decoded: number | null = null;
          if (heights) {
            decoded = codeFromBars(heights);
          }

          if (decoded !== null) {
            await handleDispatchPayload(decoded);
            return;
          }

          // No decodificado (ángulo/luz): cooldown, reintento y pista al 3er intento
          decodeFailCount += 1;
          if (decodeFailCount === 3 && !hintShown) {
            hintShown = true;
            showToast('Casi… acércate (~15-25 cm), de frente y con buena luz 🐰', 'info');
          }
          await new Promise((r) => setTimeout(r, 1000));
          isSubmittingOptical = false;
        }
      } catch {
        isSubmittingOptical = false;
      }
    }, 450);

    return () => clearInterval(interval);
  }, [activeTab, hasCamera, showManualInput, result, router, stopScanning, handleDispatchPayload, showToast]);

  return (
    <div 
      className="page-wrap relative min-h-dvh flex flex-col justify-between transition-colors duration-200" 
      style={{ 
        paddingTop: 'calc(var(--safe-top, 0px) + 8px)',
        background: activeTab === 'scan' ? (isDark ? '#000000' : '#F1F5F9') : 'var(--bg-primary)',
        color: 'var(--text-primary)'
      }}
    >
      {/* Background glow only on my-code tab */}
      {activeTab === 'my-code' && (
        <div className="absolute inset-0 pointer-events-none z-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(233,30,99,0.08)_0%,transparent_65%)]" />
      )}

      {/* Header bar */}
      <div className="relative z-50 px-4 w-full flex flex-col items-center gap-3">
        <div className="flex items-center justify-between w-full">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full bg-(--bg-elevated) backdrop-blur-md border border-(--border-subtle) text-(--text-primary) flex items-center justify-center cursor-pointer shadow-xs active:scale-95 transition-transform"
          >
            <ArrowLeft size={20} />
          </button>
          <span className="text-xs font-extrabold tracking-[2px] text-(--text-primary) uppercase">Escanear QR</span>
          <button
            onClick={() => setShowManualInput(!showManualInput)}
            className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-colors shadow-xs ${
              showManualInput ? 'bg-[#E91E63] text-white border-0' : 'bg-(--bg-elevated) border border-(--border-subtle) text-(--text-primary)'
            }`}
          >
            <Keyboard size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-(--bg-elevated) backdrop-blur-2xl border border-(--border-subtle) p-1 rounded-full flex w-60 shadow-xs">
          {(['scan', 'my-code'] as const).map((t, i) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`flex-1 py-2 text-[11px] font-extrabold rounded-full border-0 cursor-pointer transition-all duration-200 ${
                activeTab === t ? 'bg-[#E91E63] text-white shadow-md' : 'bg-transparent text-(--text-muted) hover:text-(--text-primary)'
              }`}
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
              <p className="text-(--text-muted) text-xs leading-relaxed m-0">Muestra este código en caja para acumular Bunz o autorizar consumo.</p>
            </div>
            
            <div className="flex flex-col items-center justify-center pt-8">
              <RabbittyCode 
                data={String(qrValue || 'rabbitty_guest')} 
                size={195} 
                showCardFrame={true} 
              />
              {/* QR estándar escaneable: cámaras de POS/caja (html5-qrcode) y iPhone */}
              <div className="mt-4 bg-white rounded-2xl p-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
                <QRCodeSVG
                  value={`rabbitty://pay?to=${encodeURIComponent(user?.username ? `@${user.username}` : String(qrValue || ''))}`}
                  size={132}
                  level="H"
                  includeMargin={false}
                />
              </div>
              <p className="text-[10px] text-(--text-muted) mt-2 text-center px-6 leading-snug">
                El neón lo lee la App Rabbitty · El cuadrado lo lee cualquier caja o cámara
              </p>
              <div className="mt-3 text-center">
                <span className="text-sm font-black tracking-[1.5px] text-(--text-primary) uppercase block">
                  {user?.firstName ? user.firstName : 'Miembro Rabbitty'}
                </span>
                <span className="text-[11px] text-(--text-muted) font-mono tracking-wider block mt-0.5">
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

            <p className="text-center text-[13px] text-(--text-muted) z-10 px-8 pointer-events-none mb-6">
              Alinea el código QR dentro del recuadro
            </p>

            {/* Ingreso manual abajo de la cámara */}
            <div className="w-full max-w-[320px] px-4 z-20">
              <button
                type="button"
                onClick={() => setShowManualInput(!showManualInput)}
                className="w-full py-3 px-4 bg-(--bg-elevated) hover:bg-(--bg-subtle) backdrop-blur-xl border border-(--border-subtle) rounded-2xl flex items-center justify-center gap-2 text-xs font-bold text-(--text-primary) transition-colors cursor-pointer shadow-xs"
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
                      className="w-full bg-(--bg-elevated) border border-(--border-subtle) rounded-xl px-4 py-3 text-(--text-primary) text-center font-mono font-bold text-base tracking-[2px] outline-none"
                    />
                    <button
                      onClick={async () => {
                        const trimmed = manualCode.trim();
                        if (!trimmed) return;
                        try {
                          const headers = await PlatformBridge.getAuthHeaders();
                          const res = await fetch('/api/auth/qr/scan', {
                            method: 'POST',
                            headers: { ...headers, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ qrToken: trimmed.toLowerCase() }),
                          });
                          const data = await res.json();
                          if (data?.success) {
                            alert('¡Inicio de sesión QR Neón exitoso! 🪄');
                            setManualCode('');
                            router.push('/profile');
                            return;
                          }
                        } catch {}
                        alert(`Código ${trimmed} verificado exitosamente`);
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
                  className="absolute bottom-32 left-4 right-4 bg-(--bg-elevated) rounded-[28px] p-6 z-30 shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-(--border-subtle)"
                >
                  <p className="text-(--text-primary) font-extrabold text-lg mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] inline-block" />
                      Autorizar Pago
                    </span>
                    <span className="text-xl">${result.amountMxn?.toFixed(2)} MXN</span>
                  </p>
                  
                  <div className="bg-(--bg-subtle) rounded-xl p-3 mb-4">
                    <p className="text-(--text-muted) text-[13px]">
                      <strong>Monto Bunz requerido:</strong> {result.bunzAmount?.toFixed(2)} Bunz
                    </p>
                    <p className="text-(--text-muted) text-[13px]">
                      <strong>Establecimiento:</strong> {result.tenantId}
                    </p>
                    <p className="text-(--text-muted) text-[13px]">
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
                    className="w-full mt-3 py-2 text-(--text-muted) font-bold text-sm bg-transparent border-0 cursor-pointer hover:text-(--text-primary)"
                  >
                    Cancelar
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

      </div>
      <BottomNav isDark={isDark} />
    </div>
  );
}
