'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Images, Flashlight, FlashlightOff } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';
import RabbittyCode from '@/components/ui/RabbittyCode';
import QRDiscovery from '@/components/QRDiscovery';
import RabbittyCodeSimple from '@/components/ui/RabbittyCodeSimple';
import { RABBITTY_CODE_STYLE } from '@/lib/rabbittyCodeStyle';
import { NativeQrScanner } from '@/components/scanner/NativeQrScanner';
import RabbittyLoader from '@/components/RabbittyLoader';
import Button from '@/components/ui/Button';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTheme } from '@/contexts/ThemeContext';
import { resolveScannedPayload } from '@/lib/scannerResolver';

import { PlatformBridge } from '@/lib/platform';
import { InAppPaySheet } from '@/components/affiliate/InAppPaySheet';
import { useToast } from '@/contexts/ToastContext';
import { useUserAvatar } from '@/lib/avatar';

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
  const userAvatar = useUserAvatar(user);
  
  const [myScanCode, setMyScanCode] = useState<string>('');
  useEffect(() => {
    if (!user) return;
    fetch('/api/rabbitty-code/mine', { headers: undefined })
      .then((r) => r.json())
      .then((d) => { if (d?.success && d.code) setMyScanCode(String(d.code)); })
      .catch(() => {});
  }, [user]);
  const qrValue = user?.id || user?.telegramId || address || 'rabbitty_guest';
  // Authority: el appRouter del ADMIN (vivo en producción)
  const API_SERVER_URL = process.env.NEXT_PUBLIC_API_URL || "https://admin.rabbitty.me/api/trpc";

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
  const [isNativeApp, setIsNativeApp] = useState(false);
  // Escáner nativo: ML Kit en Android y plugin SPM propio en iOS.
  const [nativeScannerSupported, setNativeScannerSupported] = useState(false);
  const [nativeSession, setNativeSession] = useState(0);
  const [nativeUnavailable, setNativeUnavailable] = useState(false);
  // Diagnóstico visible: por qué se usa la cámara web o por qué falló.
  const [scannerNotice, setScannerNotice] = useState<string | null>(null);
  const nativeSessionRef = useRef(0);
  const nativeBusyRef = useRef(false);

  // Abrir/cerrar con refs evita que un reintento asíncrono remonte la sesión
  // mientras la cámara sigue activa. "Reiniciar" con la sesión viva es no-op:
  // el escáner sigue escaneando en lugar de apagarse y volver a encenderse.
  const openNativeScanner = useCallback(() => {
    if (nativeBusyRef.current) return;
    nativeBusyRef.current = true;
    const next = Math.max(1, nativeSessionRef.current + 1);
    nativeSessionRef.current = next;
    setNativeSession(next);
  }, []);
  const closeNativeScanner = useCallback(() => {
    nativeBusyRef.current = false;
    nativeSessionRef.current = 0;
    setNativeSession(0);
  }, []);
  // Payload aceptado: la cámara ya se detuvo. La sesión sigue montada (así
  // los modales de confirmación y el aviso de presencia la reutilizan al
  // cerrarse), pero un próximo inicio puede remontarla si hace falta.
  const handleNativeConsumed = useCallback(() => {
    nativeBusyRef.current = false;
  }, []);

  useEffect(() => {
    const native = PlatformBridge.isNative();
    setIsNativeApp(native);
    setNativeScannerSupported(native);
    if (native) setHasCamera(true);
  }, []);
  const [result, setResult] = useState<PaymentIntentData | null>(null);
  const [webTorchOn, setWebTorchOn] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  // Tamaño del QR adaptado a la altura: en pantallas bajas se reduce
  // para que la hoja inferior nunca quede fuera de vista.
  const [qrSize, setQrSize] = useState(234);
  useEffect(() => {
    const compute = () => {
      const h = typeof window !== 'undefined' ? window.innerHeight || 800 : 800;
      setQrSize(Math.max(160, Math.min(234, Math.round(h - 530))));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  const [manualCode, setManualCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [activeTab, setActiveTab] = useState<'scan' | 'my-code'>(initialTab);
  const [qrConfirm, setQrConfirm] = useState<{ qrToken: string; origin: string } | null>(null);
  const [presenceSheet, setPresenceSheet] = useState<{ businessId: string; businessName: string; already: boolean; logoUrl?: string | null } | null>(null);
  // Fase D: pago in-app — escanes que apuntan a /pay/[orderId] (QR digital de mostrador / cuenta enviada por el POS)
  const [inAppPayOrderId, setInAppPayOrderId] = useState<string | null>(null);
  const [scanLoader, setScanLoader] = useState<string | null>(null);
  const [scanLoaderCode, setScanLoaderCode] = useState<string | null>(null);

  // Ticket digital ya acreditado → se muestra en pantalla (compartir/imprimir)
  // en vez de un error de "ya reclamado".
  const [claimedTicket, setClaimedTicket] = useState<{
    orderId: string; orderNumber: string; total: number;
    createdAt: string | null; bunzAwarded: number; restaurantName: string | null;
  } | null>(null);
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
      // Confirmación EXPLÍCITA: el usuario ve a QUÉ pantalla está autorizando
      setScanLoader(null);
      setScanLoaderCode(null);
      setQrConfirm({ qrToken: urlQrLogin, origin: 'www.rabbitty.me/impresos' });
      return;
    }

    // Vista de ticket ya pagado: /scan?ticket={orderId} — el enlace que va en
    // los reenvíos de WhatsApp (sin firma). Muestra el ticket en pantalla, no
    // abre la cámara.
    const urlTicketView = searchParams.get('ticket');
    if (urlTicketView) {
      (async () => {
        try {
          const r = await fetch(`/api/pos/ticket-view?orderId=${encodeURIComponent(urlTicketView)}`, { cache: 'no-store' });
          const d = await r.json().catch(() => null);
          if (d?.success && d?.ticket) {
            setClaimedTicket({
              orderId: d.ticket.orderId,
              orderNumber: d.ticket.orderNumber,
              total: Number(d.ticket.total ?? 0),
              createdAt: d.ticket.createdAt,
              bunzAwarded: Number(d.ticket.bunzAwarded ?? 0),
              restaurantName: d.ticket.restaurantName,
            });
          } else {
            alert(d?.error || 'No se pudo abrir el ticket.');
          }
        } catch {
          alert('Error de conexión al abrir el ticket.');
        }
      })();
    }

    // Auto-reclamo si el usuario abrió el link directo del ticket /scan?claimToken=...
    const urlClaimToken = searchParams.get('claimToken') || searchParams.get('claim');
    if (urlClaimToken) {
      (async () => {
        try {
          const headers = await PlatformBridge.getAuthHeaders();
          if (!headers?.Authorization) {
            alert('Inicia sesión en Rabbitty y vuelve a escanear el ticket para reclamar tus Bunz.');
            return;
          }
          const claimRes = await fetch('/api/pos/claim-ticket', {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ claimToken: urlClaimToken }),
          });
          const claimData = await claimRes.json();
          if (claimData.success) {
            alert(`🐰 ¡Felicidades! Se han acreditado +${claimData.bunzAwarded} Bunz a tu cuenta por el ticket #${claimData.orderNumber}.`);
            router.push('/profile/wallet');
          } else if (claimData?.alreadyClaimed && claimData?.ticket) {
            // Ticket ya acreditado → mostrarlo en pantalla para compartir/imprimir
            setClaimedTicket(claimData.ticket);
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
      // 🐰 Check-in de mostrador (QR Neón sin mesa) — registro REAL en server
      (async () => {
        try {
          const headers = await PlatformBridge.getAuthHeaders();
          if (headers?.Authorization) {
            // Resolver branchId → businessId con el resolver unificado
            const { resolveScannedPayload } = await import('@/lib/scannerResolver');
            const resolution = await resolveScannedPayload(`https://rabbitty.me/scan?branchId=${encodeURIComponent(urlBranchId)}`);
            if (resolution.type === 'business' && resolution.business) {
              const checkRes = await fetch('/api/business/checkin', {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ businessId: resolution.business.id }),
              });
              const checkData = await checkRes.json();
              try {
                localStorage.setItem('rabbitty_last_branch_id', urlBranchId);
                localStorage.setItem('rabbitty_last_business_name', resolution.business.name || urlBusiness || '');
              } catch {}
              // Presencia: el cajero te ve en su POS — sin redirigir
              let dLogo: string | null = null;
              try {
                const bRes = await fetch(`/api/business/${resolution.business.id}`, { headers });
                dLogo = (await bRes.json())?.business?.logoUrl || null;
              } catch { /* sin logo */ }
              setPresenceSheet({
                businessId: resolution.business.id,
                businessName: resolution.business.name || urlBusiness || 'el negocio',
                already: checkData?.checkIn === 'already',
                logoUrl: dLogo,
              });
              return;
            }
          }
        } catch { /* cae al flujo conservador */ }
        // Sin sesión o branch no resuelta → comportamiento conservador anterior
        try {
          localStorage.setItem('rabbitty_last_branch_id', urlBranchId);
          localStorage.setItem('rabbitty_last_business_name', urlBusiness || '');
        } catch {}
        alert(`🐰 ¡Estás en ${urlBusiness || 'este negocio'}! Inicia sesión para acumular Bunz con tus compras.`);
        router.push('/profile/wallet');
      })();
    }
  }, [isDark, searchParams, router]);

  const requestCameraAccess = async () => {
    if (PlatformBridge.isNative()) {
      // El plugin nativo pide el permiso de cámara al iniciar.
      setHasCamera(true);
      return;
    }
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


  const bindQrSession = async (qrToken: string, onDone?: () => void) => {
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch('/api/auth/qr/scan', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrToken }),
      });
      const data = await res.json();
      if (data.success) {
        PlatformBridge.hapticFeedback('success');
        alert('¡Acceso autorizado en tu pantalla! 🪄');
        setQrConfirm(null);
        router.push('/profile');
      } else {
        alert('Error de autorización QR: ' + (data.error || 'Token inválido o expirado'));
        setQrConfirm(null);
      }
    } catch {
      alert('Error de conexión al autorizar el acceso QR.');
      setQrConfirm(null);
    }
    onDone?.();
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

  const handleDispatchPayload = useCallback(async (rawPayload: string | number): Promise<boolean> => {
    PlatformBridge.hapticFeedback('success');
    // En nativo NO reemplazamos la pantalla: el overlay del escáner sigue montado
    // y, si el payload no es reconocible, la sesión continúa sin apagar la cámara.
    if (!PlatformBridge.isNative()) {
      setScanLoader('Leyendo tu código…');
      if (typeof rawPayload === 'string') setScanLoaderCode(rawPayload);
    }

    const res = await resolveScannedPayload(rawPayload);
    if (!res.success) {
      setScanLoader(null);
      setScanLoaderCode(null);
      if (res.error) alert(res.error);
      startScanningRef.current();
      return false;
    }

    // 1. Magic Link (terminal iPad / caja)
    if (res.type === 'magic_link' && res.magicLink) {
      await stopScanning();
      router.push(`/magic-link?token=${encodeURIComponent(res.magicLink.token)}&sid=${encodeURIComponent(res.magicLink.sid)}`);
      return true;
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
          setScanLoader(null);
          router.push('/profile/wallet');
          return true;
        } else {
          setScanLoader(null);
          if (claimData?.alreadyClaimed && claimData?.ticket) {
            // Ticket ya acreditado (p. ej. pago Rabbitty Pay con cashback
            // automático) → mostrar el ticket digital para compartir/imprimir.
            setClaimedTicket(claimData.ticket);
            return true;
          }
          alert(claimData.error || 'No se pudo reclamar este ticket.');
          startScanningRef.current();
          return false;
        }
      } catch {
        alert('Error al conectar con el servidor para reclamar el ticket.');
        startScanningRef.current();
        return false;
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
          return true;
        } else {
          alert(tableData.error || 'No se pudo vincular a la mesa.');
          startScanningRef.current();
          return false;
        }
      } catch {
        alert('Error al conectar con el servidor para vincular a la mesa.');
        startScanningRef.current();
        return false;
      }
    }

    // 4. Negocio afiliado / check-in
    if (res.type === 'business' && res.business) {
      await stopScanning();
      // Check-in REAL en el server (1 por negocio por día, ledger + contador de visitas)
      // El cajero te ve en su POS ("clientes en el local") y te vincula al cobro —
      // no redirigimos: la presencia es el resultado.
      if (res.business.checkIn) {
        try {
          const headers = await PlatformBridge.getAuthHeaders();
          if (headers?.Authorization) {
            const bizId = res.business.id;
            const bizName = res.business.name || 'el negocio';
            const res2 = await fetch('/api/business/checkin', {
              method: 'POST',
              headers: { ...headers, 'Content-Type': 'application/json' },
              body: JSON.stringify({ businessId: bizId }),
            });
            const d2 = await res2.json().catch(() => ({}));
            PlatformBridge.hapticFeedback('success');
            let logoUrl: string | null = null;
            try {
              const bRes = await fetch(`/api/business/${bizId}`, { headers });
              const bData = await bRes.json();
              logoUrl = bData?.business?.logoUrl || bData?.business?.gallery?.[0] || null;
            } catch { /* sin logo */ }
            setScanLoader(null);
            setScanLoaderCode(null);
            setPresenceSheet({
              businessId: bizId,
              businessName: bizName,
              already: d2?.checkIn === 'already',
              logoUrl,
            });
            return true;
          }
        } catch { /* cae a navegación */ }
        // Sin sesión o si falló el check-in: limpiar loader y navegar al perfil
        setScanLoader(null);
        setScanLoaderCode(null);
        router.push(`/affiliate/${res.business.id}`);
        return true;
      }
      router.push(`/affiliate/${res.business.id}`);
      return true;
    }

    // 5. Usuario (@handle / id)
    if (res.type === 'user' && res.user) {
      await stopScanning();
      router.push(`/profile/wallet?to=${encodeURIComponent(res.user.handle || res.user.id)}`);
      return true;
    }

    // 6. QR Login (/impresos o PC)
        // 6. QR Login (/impresos o PC) — CONFIRMACIÓN EXPLÍCITA antes de vincular
    if (res.type === 'qrlogin' && res.qrLogin) {
      await stopScanning();
      // ── CRÍTICO: limpiar el loader ANTES de mostrar el modal — el loader tiene
      //    prioridad de render y taparía el modal de confirmación si sigue activo ──
      setScanLoader(null);
      setScanLoaderCode(null);
      setQrConfirm({ qrToken: res.qrLogin.qrToken, origin: 'www.rabbitty.me' });
      return true;
    }

    // 6.5. Fase D: link de pago del comensal (admin /pay/[orderId]) → pagar IN-APP
    // sin salir de la app (QR digital de mostrador, cuenta enviada por el POS).
    if (/^https?:\/\/[^/]+\/pay\//i.test(res.url || '')) {
      await stopScanning();
      setScanLoader(null);
      setScanLoaderCode(null);
      setInAppPayOrderId((res.url || '').split('/pay/')[1].split(/[?&#]/)[0]);
      return true;
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
      return true;
    }

    // 8. POS Payment Intent
    // Solo si el payload ES una intención de pago. Antes cualquier texto crudo
    // entraba aquí y terminaba en "Intención de pago no encontrada", cerrando
    // el escáner por un código desconocido.
    const rawText = typeof rawPayload === 'string' ? rawPayload.trim() : String(rawPayload);
    const looksLikeIntent = Boolean(res.intent) || /(?:^|[^a-z0-9])(pay_|pi_)/i.test(rawText);
    let intentId = res.intent || (looksLikeIntent ? rawText : '');
    if (intentId.includes('pay_')) {
      intentId = intentId.split('pay_')[1].split(/[&?#\s]/)[0];
    } else if (intentId.includes('pi_')) {
      intentId = 'pi_' + intentId.split('pi_')[1].split(/[&?#\s]/)[0];
    }

    if (looksLikeIntent && intentId) {
      await stopScanning();
      try {
        const authHeader = await getAuthHeader();
        const inputStr = encodeURIComponent(JSON.stringify({ "0": { intentId } }));
        const response = await fetch(`${API_SERVER_URL}/payments.getIntent?batch=1&input=${inputStr}`, {
          headers: { "Authorization": authHeader }
        });
        const data = await response.json();
        if (data[0] && data[0].result && data[0].result.data) {
          setResult(data[0].result.data);
          return true;
        }
        alert("Intención de pago no encontrada o inválida.");
        setResult(null);
        startScanningRef.current();
        return false;
      } catch {
        alert("Error al contactar el servidor.");
        setResult(null);
        startScanningRef.current();
        return false;
      }
    }

    // Fallback no reconocido: la sesión de escaneo sigue activa (no se cierra).
    setScanLoader(null);
    setScanLoaderCode(null);
    startScanningRef.current();
    return false;
  }, [API_SERVER_URL, router, stopScanning]);

  /** Linterna en web/Telegram (WebView): se pide al track de la cámara. */
  const toggleWebTorch = async () => {
    try {
      const video = document.querySelector('#qr-reader video') as HTMLVideoElement | null;
      const stream = (video?.srcObject as MediaStream | null) ?? null;
      const track = stream?.getVideoTracks?.()[0];
      if (!track) {
        showToast('La linterna no está disponible aquí', 'info');
        return;
      }
      const caps = (track.getCapabilities?.() ?? {}) as { torch?: boolean };
      if (!caps.torch) {
        showToast('Este dispositivo no permite linterna desde la cámara web', 'info');
        return;
      }
      await track.applyConstraints({
        advanced: [{ torch: !webTorchOn } as unknown as MediaTrackConstraintSet],
      });
      setWebTorchOn((v) => !v);
      PlatformBridge.hapticFeedback('light');
    } catch {
      showToast('No se pudo cambiar la linterna', 'info');
    }
  };

  /** Foto de galería (web/Telegram): decodifica la imagen elegida. */
  const pickGalleryFile = async (file: File | null) => {
    if (!file) return;
    try {
      showToast('Leyendo la imagen…', 'info');
      await stopScanning();
      const tempId = 'qr-gallery-reader';
      if (!document.getElementById(tempId)) {
        const div = document.createElement('div');
        div.id = tempId;
        div.style.display = 'none';
        document.body.appendChild(div);
      }
      const reader = new Html5Qrcode(tempId);
      const decoded = await reader.scanFile(file, false);
      try { reader.clear(); } catch { /* noop */ }
      document.getElementById(tempId)?.remove();
      await handleDispatchPayload(decoded);
    } catch {
      showToast('No encontramos un QR en esa imagen', 'info');
      startScanningRef.current();
    }
  };

  const startScanning = useCallback(async () => {
    if (PlatformBridge.isNative() && !nativeUnavailable) {
      openNativeScanner();
      return;
    }
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
      setScannerNotice(null);
    } catch (err) {
      setHasCamera(false);
      setScannerNotice(
        err instanceof Error
          ? `No se pudo abrir la cámara: ${err.message}`
          : 'No se pudo abrir la cámara del navegador.',
      );
    } finally {
      isTransitioningRef.current = false;
    }
  }, [handleDispatchPayload, openNativeScanner]);

  // El escáner nativo recibe un callback estable (si cambia, se reinicia la cámara).
  const handleNativeScan = useCallback(
    (raw: string) => handleDispatchPayload(raw),
    [handleDispatchPayload],
  );

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
    let lastDecoded: number | null = null;
    let consecutiveAgree = 0;
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
            if (decoded !== null) {
              // ── Acuerdo multi-frame: 2 frames consecutivos con el mismo código ──
              if (lastDecoded === decoded) {
                consecutiveAgree += 1;
              } else {
                consecutiveAgree = 0;
              }
              lastDecoded = decoded;
              if (consecutiveAgree < 1) {
                isSubmittingOptical = false;
                return; // esperar confirmación del siguiente frame
              }
              consecutiveAgree = 0;
            }
          }

          if (decoded !== null) {
            setScanLoaderCode(`rc:${decoded}`);
            setScanLoader('Decodificando tu Rabbitty Code…');
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

  // ── Hoja de presencia: estás activo en el negocio (el cajero te ve en su POS) ──
  if (presenceSheet) {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-6 text-center">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center"
        >
          {presenceSheet.logoUrl ? (
            <img src={presenceSheet.logoUrl} alt={presenceSheet.businessName}
              className="w-20 h-20 rounded-2xl object-cover mb-4 border-2 border-pink-500/50"
              style={{ boxShadow: '0 0 40px rgba(233,30,99,0.4)' }} />
          ) : (
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mb-4"
              style={{ background: 'linear-gradient(135deg, #FF2E93 0%, #E91E63 100%)', boxShadow: '0 0 60px rgba(233,30,99,0.5)' }}>
              🐰
            </div>
          )}
          <h2 className="text-white text-xl font-black">
            {presenceSheet.already ? 'Ya estás activo aquí' : '¡Estás activo!'}
          </h2>
          <p className="text-white/70 text-sm mt-2 max-w-xs">
            {presenceSheet.already
              ? `Ya tenías check-in activo en ${presenceSheet.businessName}. Tus compras acumulan Bunz automáticamente.`
              : `Check-in registrado en ${presenceSheet.businessName}. El cajero ya puede verte en su POS y vincularte al cobro — tus Bunz llegan solos.`}
          </p>
          <div className="flex flex-col gap-2 mt-8 w-full max-w-xs">
            <button
              onClick={() => router.push(`/affiliate/${presenceSheet.businessId}`)}
              className="w-full py-3.5 rounded-2xl bg-white/10 text-white text-sm font-bold active:scale-95 transition-transform"
            >
              Ver el negocio
            </button>
            <button
              onClick={() => setPresenceSheet(null)}
              className="w-full py-3 rounded-2xl text-white/50 text-xs font-bold"
            >
              Cerrar
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Loader: verificación animada Rabbitty tras escaneo ──
  if (scanLoader) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-black">
        <RabbittyLoader message={scanLoader} codeData={scanLoaderCode ?? undefined} />
      </div>
    );
  }

  // ── Modal: ¿Autorizar el acceso? (qrlogin gate) ──
  if (qrConfirm) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-black px-6 relative overflow-hidden">
        <div className="absolute top-[-15%] w-64 h-64 rounded-full bg-[#E91E63]/20 blur-[80px] pointer-events-none" />
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative z-10 w-full max-w-sm rounded-[2rem] border border-white/10 bg-[#12121B] p-7 text-center"
        >
          <div className="w-16 h-16 mx-auto rounded-2xl bg-[#E91E63]/15 border border-[#E91E63]/30 flex items-center justify-center text-3xl">
            🔐
          </div>
          <h2 className="mt-4 text-lg font-black text-white">¿Autorizar el acceso?</h2>
          <p className="mt-2 text-xs text-neutral-400 leading-relaxed">
            Se dará acceso a <strong className="text-white">{qrConfirm.origin}</strong> en la pantalla donde se mostró el código.<br />
            <span className="text-neutral-500">Sesión: {qrConfirm.qrToken.slice(0, 8)}… · un solo uso · expira pronto</span>
          </p>
          <button
            onClick={async () => { await bindQrSession(qrConfirm.qrToken); }}
            className="mt-6 w-full py-3.5 rounded-2xl bg-[#E91E63] text-white font-black text-sm active:scale-95 transition-transform cursor-pointer"
          >
            Autorizar acceso
          </button>
          <button
            onClick={() => setQrConfirm(null)}
            className="mt-2 w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-neutral-400 font-bold text-xs cursor-pointer"
          >
            Cancelar
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div 
      className="page-wrap relative min-h-dvh flex flex-col justify-between transition-colors duration-200" 
      style={{ 
        paddingTop: activeTab === 'my-code' ? 'calc(var(--safe-top, 0px) + 8px)' : 'calc(var(--safe-top, 0px) + 8px)',
        // Mi Código: la hoja llega hasta el fondo real (sin el hueco de la nav)
        paddingBottom: activeTab === 'my-code' ? 0 : undefined,
        background: activeTab === 'scan' ? (isDark ? '#000000' : '#F1F5F9') : 'transparent',
        color: 'var(--text-primary)'
      }}
    >
      {isNativeApp && nativeScannerSupported && !nativeUnavailable && nativeSession > 0 && activeTab === 'scan' && !showManualInput && !result && !scanLoader && (
        <NativeQrScanner
          key={nativeSession}
          onScan={handleNativeScan}
          onConsumed={handleNativeConsumed}
          onClose={() => {
            closeNativeScanner();
            setActiveTab('my-code');
          }}
          onFallback={() => {
            closeNativeScanner();
            setNativeUnavailable(true);
            setShowManualInput(false);
            setScannerNotice('Escáner nativo no disponible en esta instalación. Usando cámara web.');
            window.setTimeout(() => startScanningRef.current(), 80);
          }}
        />
      )}

      {/* Fondo nuevo de Mi Código */}
      {activeTab === 'my-code' && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/neon-skyline.webp"
            alt=""
            className="pointer-events-none fixed inset-0 h-dvh w-full object-cover"
          />
          <div
            className="pointer-events-none fixed inset-0"
            style={{
              background:
                'linear-gradient(135deg, rgba(233,30,99,0.42) 0%, rgba(139,92,246,0.30) 48%, rgba(255,46,147,0.22) 100%)',
              mixBlendMode: 'color',
            }}
          />
          <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/55" />
        </>
      )}
      {/* Background glow removed — my-code tab handles its own background */}

      {/* Main Content Area */}
      <div className={`relative flex-1 w-full flex flex-col items-center ${activeTab === 'my-code' ? 'p-0 justify-between' : 'justify-center z-10 px-4 py-4'}`}>

        {/* My Code tab - Official Rabbitty Code Hologram / Telegram style */}
        {activeTab === 'my-code' && (
          <div className="flex flex-col items-center justify-between w-full h-full flex-1 z-20">
            {RABBITTY_CODE_STYLE === 'simple' ? (
              <RabbittyCodeSimple
                value={`https://app.rabbitty.me/u/${encodeURIComponent(
                  user?.username || String(qrValue || ''),
                )}`}
                handle={user?.username || null}
                name={user?.firstName ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}` : null}
                avatarUrl={userAvatar}
                size={qrSize}
                theme="theme1"
                onClose={() => {
                  router.replace("/");
                }}
                onShare={async () => {
                  const handle = user?.username ? `@${user.username}` : String(qrValue || '');
                  try {
                    if (typeof navigator !== 'undefined' && navigator.share) {
                      await navigator.share({ title: 'Mi Rabbitty Code', text: `Mi Rabbitty Code: ${handle}` });
                    } else {
                      await navigator.clipboard.writeText(handle);
                      showToast('Código copiado', 'success');
                    }
                  } catch {
                    /* cancelado */
                  }
                }}
                onScan={() => {
                  PlatformBridge.hapticFeedback('light');
                  setActiveTab('scan');
                }}
              />
            ) : (
              <div className="flex w-full flex-col items-center justify-center pt-2">
                <QRDiscovery
                  value={myScanCode ? `rabbitty://pay?to=${encodeURIComponent(user?.username ? `@${user.username}` : String(qrValue || ''))}` : String(qrValue || 'rabbitty_guest')}
                  variant="rabbitter"
                  size={210}
                  revealMode="discovery"
                  surfaceKey="my-code"
                />
                <div className="mt-5 text-center">
                  <span className="text-sm font-black tracking-[1.5px] text-(--text-primary) uppercase block">
                    {user?.firstName ? user.firstName : 'Miembro Rabbitty'}
                  </span>
                  <span className="text-[11px] text-(--text-muted) font-mono tracking-wider block mt-0.5">
                    ID: {String(qrValue || '').slice(0, 16)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Camera scan tab */}
        {activeTab === 'scan' && (
          <div className="w-full flex flex-col items-center justify-center relative">

            {/* Cámara a pantalla completa, sin recuadro oscuro */}
            <div className="fixed inset-0 z-0 overflow-hidden bg-black">
              <div
                id="qr-reader"
                className={`absolute inset-0 h-full w-full [&>video]:h-full [&>video]:w-full [&>video]:object-cover [&_#qr-shaded-region]:hidden ${hasCamera && !showManualInput ? 'block' : 'hidden'}`}
              />

              {/* Marco central con fade suave alrededor (la cámara se sigue viendo) */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div
                  className="relative"
                  style={{
                    width: 300,
                    height: 300,
                    borderRadius: 22,
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.38)',
                  }}
                >
                  {[['top', 'left'], ['top', 'right'], ['bottom', 'left'], ['bottom', 'right']].map(([v, h]) => (
                    <div
                      key={`${v}${h}`}
                      style={{
                        position: 'absolute',
                        [v]: 0,
                        [h]: 0,
                        width: 38,
                        height: 38,
                        borderTop: v === 'top' ? '4px solid #E91E63' : 'none',
                        borderBottom: v === 'bottom' ? '4px solid #E91E63' : 'none',
                        borderLeft: h === 'left' ? '4px solid #E91E63' : 'none',
                        borderRight: h === 'right' ? '4px solid #E91E63' : 'none',
                        borderRadius:
                          v === 'top' && h === 'left' ? '14px 0 0 0'
                          : v === 'top' && h === 'right' ? '0 14px 0 0'
                          : v === 'bottom' && h === 'left' ? '0 0 0 14px'
                          : '0 0 14px 0',
                        filter: 'drop-shadow(0 0 10px rgba(233,30,99,0.65))',
                      }}
                    />
                  ))}
                  <motion.div
                    animate={{ top: ['6%', '92%', '6%'] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute left-3 right-3 h-0.5 rounded-full bg-[#E91E63]/80 shadow-[0_0_14px_#E91E63]"
                  />
                </div>
              </div>

              {/* Volver a Mi Código */}
              <button
                type="button"
                onClick={() => {
                  PlatformBridge.hapticFeedback('light');
                  setActiveTab('my-code');
                }}
                aria-label="Volver a Mi Código"
                className="absolute left-4 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-md active:scale-95"
                style={{ top: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
              >
                <ArrowLeft size={20} />
              </button>

              {/* Controles inferiores: foto + linterna */}
              <div
                className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-center gap-11"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
              >
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void pickGalleryFile(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  aria-label="Elegir una foto"
                  className="flex h-[68px] w-[68px] items-center justify-center rounded-full border border-white/25 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.22),rgba(255,255,255,0.05))] text-white shadow-[0_4px_18px_rgba(0,0,0,0.35)] backdrop-blur-md active:scale-95"
                >
                  <Images size={26} />
                </button>
                <button
                  type="button"
                  onClick={() => void toggleWebTorch()}
                  aria-label="Linterna"
                  className={`flex h-[68px] w-[68px] items-center justify-center rounded-full border shadow-[0_4px_18px_rgba(0,0,0,0.35)] backdrop-blur-md active:scale-95 ${
                    webTorchOn
                      ? 'border-amber-300/50 bg-[radial-gradient(circle_at_50%_35%,rgba(251,191,36,0.42),rgba(251,191,36,0.12))] text-amber-200'
                      : 'border-white/25 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.22),rgba(255,255,255,0.05))] text-white'
                  }`}
                >
                  {webTorchOn ? <FlashlightOff size={26} /> : <Flashlight size={26} />}
                </button>
              </div>

              {scannerNotice && (
                <div
                  className="absolute inset-x-0 z-30 flex justify-center px-6"
                  style={{ top: 'calc(env(safe-area-inset-top, 0px) + 68px)' }}
                >
                  <p className="m-0 rounded-xl border border-amber-400/35 bg-black/65 px-3 py-2 text-center text-[11px] font-bold leading-snug text-amber-200 backdrop-blur-md">
                    {scannerNotice}
                  </p>
                </div>
              )}

              {!hasCamera && (
                <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black/75 px-6">
                  <p className="m-0 text-center text-xs text-white/80">
                    Cámara no disponible o permiso denegado
                  </p>
                  <button
                    onClick={async () => {
                      setScannerNotice(null);
                      await requestCameraAccess();
                      startScanningRef.current();
                    }}
                    className="rounded-full bg-[#E91E63] px-4 py-2 text-xs font-bold text-white shadow-lg shadow-[#E91E63]/30 active:scale-95"
                  >
                    Activar cámara
                  </button>
                </div>
              )}
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

                      // ── Gate local: Face ID / PIN antes de debitar Bunz (igual que transfers) ──
                      try {
                        const [{ authorizeSensitiveAction }, { promptForPin }] = await Promise.all([
                          import('@/lib/securityVault'),
                          import('@/components/security/PinPromptModal'),
                        ]);
                        const gate = await authorizeSensitiveAction(promptForPin, 'Autoriza el pago con Bunz');
                        if (!gate.ok) {
                          if (gate.reason === 'locked') alert('Demasiados intentos de PIN. Espera un momento.');
                          return;
                        }
                      } catch { /* vault no disponible → no bloquear el pago */ }

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
      {/* Fase D: pago in-app cuando el escaneo apunta a /pay/[orderId] */}
      {inAppPayOrderId && (
        <InAppPaySheet
          isOpen={!!inAppPayOrderId}
          onClose={() => {
            setInAppPayOrderId(null);
            startScanningRef.current();
          }}
          orderId={inAppPayOrderId}
          total={0}
          businessName="Tu cuenta en el local"
        />
      )}
      {/* Ticket digital ya acreditado: en vez de error "ya reclamado",
          mostramos el ticket en pantalla para decidir imprimirlo o compartirlo. */}
      {claimedTicket && (
        <div className="fixed inset-0 z-999 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md">
          <div className="absolute inset-0" onClick={() => { setClaimedTicket(null); startScanningRef.current(); }} />
          <motion.div
            initial={{ y: '100%', opacity: 0.8 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative w-full max-w-md bg-[#14141E] border border-white/10 rounded-t-4xl sm:rounded-4xl p-6 text-white z-10"
          >
            <div className="text-center space-y-1 pb-4 border-b border-white/10">
              <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">✨ Ticket ya acreditado</p>
              <h3 className="text-lg font-black tracking-tight">{claimedTicket.restaurantName || 'Rabbitty'}</h3>
              <p className="text-[11px] text-white/40">Este ticket ya se pagó y acreditó — compártelo o guárdalo desde aquí.</p>
            </div>

            <div className="py-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Folio</span>
                <span className="font-mono font-black">#{claimedTicket.orderNumber}</span>
              </div>
              {claimedTicket.createdAt && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Fecha</span>
                  <span className="font-bold">{new Date(claimedTicket.createdAt).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Total</span>
                <span className="font-mono font-black text-cyan-400">${claimedTicket.total.toFixed(2)} MXN</span>
              </div>
              {claimedTicket.bunzAwarded > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Bunz acreditados</span>
                  <span className="font-black text-pink-400">+{claimedTicket.bunzAwarded} 🐰</span>
                </div>
              )}
            </div>

            <div className="space-y-2 pb-2">
              <button
                type="button"
                onClick={async () => {
                  const text = `🧾 Ticket digital — ${claimedTicket.restaurantName || 'Rabbitty'}\n🔖 Folio: #${claimedTicket.orderNumber}\n💳 Total: $${claimedTicket.total.toFixed(2)} MXN${claimedTicket.bunzAwarded > 0 ? `\n🐰 +${claimedTicket.bunzAwarded} Bunz acreditados` : ''}\n\nRabbitteado en Rabbitty ✨`;
                  try {
                    if (typeof navigator !== 'undefined' && navigator.share) {
                      await navigator.share({ title: 'Ticket digital Rabbitty', text });
                    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      await navigator.clipboard.writeText(text);
                      showToast('Ticket copiado al portapapeles', 'success');
                    }
                  } catch { /* el usuario cerró el share nativo */ }
                }}
                className="w-full bg-linear-to-r from-[#FF2E93] to-[#E91E63] text-white font-black text-sm py-3.5 rounded-2xl flex items-center justify-center active:scale-[0.98] transition-transform"
              >
                📤 Compartir ticket
              </button>
              <button
                type="button"
                onClick={() => { setClaimedTicket(null); router.push('/profile/wallet'); }}
                className="w-full bg-white/5 border border-white/10 text-white/80 font-bold text-xs py-3 rounded-2xl hover:bg-white/10 active:scale-[0.98] transition-transform"
              >
                Ver mi cartera y movimientos
              </button>
              <button
                type="button"
                onClick={() => { setClaimedTicket(null); startScanningRef.current(); }}
                className="w-full text-[11px] font-bold text-gray-500 hover:text-gray-300 py-1"
              >
                Seguir escaneando
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
