'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  Printer, Sparkles, Smartphone, ArrowRight, CheckCircle2, ShieldCheck, 
  Search, ChevronDown, Check, Building2,
  SlidersHorizontal, Image as ImageIcon,
  Lock, QrCode, X, KeyRound, RefreshCw, LogOut
} from 'lucide-react';
import { SimpleQRCode, NeonQRCode } from '@/components/SimpleQRCode';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

interface BusinessItem {
  id: string;
  name: string;
  category: string;
  rewardPercentage: number;
  address: string;
  refCode: string;
  logoUrl?: string | null;
  welcomeBunz?: number;
}

// Plantillas de contenido curadas y protegidas por nicho de mercado
export interface NicheTemplate {
  key: string;
  label: string;
  icon: string;
  categoryHint: string;
  // A3 Cartel
  posterTag: string;
  posterHeadlinePrefix: string;
  posterHeadlineHighlight: string;
  posterDescription: string;
  // A5 Habladores Mesa
  tableWaitingCallout: string;
  tableHeadline: string;
  tableStep1: string;
  tableStep3: string;
  tableFooterHint: string;
  // A6 Señal Caja
  cashierTag: string;
  cashierCallout: string;
  // A4 Guía de Operación
  guideStaffTitle: string;
  guideScriptGreeting: string;
  guideScriptExplain: string;
}

const NICHE_TEMPLATES: Record<string, NicheTemplate> = {
  coffee: {
    key: 'coffee',
    label: 'Cafetería / Café de Especialidad',
    icon: '☕',
    categoryHint: 'Café & Bebidas',
    posterTag: 'Punto de Café Oficial',
    posterHeadlinePrefix: 'TU CAFÉ HOY.',
    posterHeadlineHighlight: 'TUS BENEFICIOS SIEMPRE.',
    posterDescription: 'Escanea el código, activa tu app de Rabbitty y recibe de inmediato tu bienvenida para disfrutar aquí con nosotros.',
    tableWaitingCallout: 'Mientras esperas tu café',
    tableHeadline: '¿YA TIENES TU BONO?',
    tableStep1: 'Pagas tu café habitual y recibes Bunz digitales directo en tu wallet.',
    tableStep3: 'Úsalos como saldo real en este café y comercios de la red local.',
    tableFooterHint: 'Pregunta a nuestro barista por la recomendación del día.',
    cashierTag: 'Al pagar tu café',
    cashierCallout: 'Escanea antes de pagar y recibe tus Bunz de bienvenida.',
    guideStaffTitle: 'Guion para el Barista / Cajero',
    guideScriptGreeting: '“¿Ya tienes Rabbitty? Lo estrenamos hoy aquí. Escanea este código en el mostrador para registrarte y llevarte tu saldo de bienvenida al instante”.',
    guideScriptExplain: '“Es una app de fidelidad digital. Cada visita acumulas Bunz que puedes canjear directamente aquí como dinero en tus próximos consumos”.'
  },
  seafood: {
    key: 'seafood',
    label: 'Mariscos / Restaurante de Mar',
    icon: '🦞',
    categoryHint: 'Marisquería & Pescados',
    posterTag: 'Sabor de Mar Oficial',
    posterHeadlinePrefix: 'EL MEJOR SABOR DEL MAR.',
    posterHeadlineHighlight: 'RECOMPENSAS EN CADA VISITA.',
    posterDescription: 'El fresco sabor del océano ahora te recompensa. Escanea el código con tu celular y desbloquea saldo de bienvenida hoy mismo.',
    tableWaitingCallout: 'Mientras preparan tu mesa',
    tableHeadline: '¿LISTO PARA DISFRUTAR?',
    tableStep1: 'Disfruta tus platillos favoritos y acumula Bunz digitales en tu cuenta.',
    tableStep3: 'Canjea tu saldo en ceviches, mariscos y tus bebidas preferidas.',
    tableFooterHint: 'Pregunta a tu mesero por el platillo estrella de la casa.',
    cashierTag: 'Al pedir tu cuenta',
    cashierCallout: 'Escanea antes de liquidar tu mesa y recibe tu bono de bienvenida.',
    guideStaffTitle: 'Guion para Mesero / Capitán de Meseros',
    guideScriptGreeting: '“Buenas tardes. En lo que preparamos sus platillos, los invito a escanear este código para activar su cuenta y recibir su saldo de bienvenida de hoy”.',
    guideScriptExplain: '“Con Rabbitty acumulan un porcentaje de su consumo en Bunz para descontar directo en su próxima visita o en negocios aliados”.'
  },
  restaurant: {
    key: 'restaurant',
    label: 'Restaurante / Comida Gourmet',
    icon: '🍽️',
    categoryHint: 'Restaurante & Gastronomía',
    posterTag: 'Experiencia Gastronómica',
    posterHeadlinePrefix: 'BUEN PROVECHO HOY.',
    posterHeadlineHighlight: 'PREMIAMOS TU LEALTAD.',
    posterDescription: 'Cada comida sabe mejor cuando te recompensa. Escanea el código de mesa o mostrador y recibe Bunz directos a tu app.',
    tableWaitingCallout: 'Mientras llega tu platillo',
    tableHeadline: 'PREMIAMOS CADA VISITA',
    tableStep1: 'Ordena a tu gusto y acumula Bunz automáticos en cada consumo.',
    tableStep3: 'Descuenta tu saldo en tus próximas comidas y cenas con amigos.',
    tableFooterHint: 'Válido todos los días en consumo en comedor y terraza.',
    cashierTag: 'Al solicitar tu cuenta',
    cashierCallout: 'Escanea antes de pagar y comienza a acumular en cada visita.',
    guideStaffTitle: 'Guion para Mesero / Hostess',
    guideScriptGreeting: '“Bienvenidos. Les dejamos el menú y este código para que obtengan su bono de bienvenida antes de ordenar sus alimentos”.',
    guideScriptExplain: '“Es nuestro nuevo programa de recompensas digitales: acumulas saldo en cada cuenta para usar en tu próxima visita”.'
  },
  fashion: {
    key: 'fashion',
    label: 'Ropa / Boutique de Moda',
    icon: '✨',
    categoryHint: 'Moda & Accesorios',
    posterTag: 'Boutique Oficial',
    posterHeadlinePrefix: 'TU ESTILO TIENE PREMIO.',
    posterHeadlineHighlight: 'ACUMULA BUNZ EN TUS COMPRAS.',
    posterDescription: 'Estrena tus prendas favoritas y recibe recompensas reales en dinero digital. Escanea el código antes de pasar a caja.',
    tableWaitingCallout: 'Al probarte tus prendas',
    tableHeadline: 'LLEVA TU ESTILO CON BONO',
    tableStep1: 'Elige tu look de hoy y acumula Bunz en cada compra que realices.',
    tableStep3: 'Canjea tu saldo en tus próximas prendas y accesorios de temporada.',
    tableFooterHint: 'Aceptamos Bunz como saldo directo en toda la colección.',
    cashierTag: 'En mostrador de caja',
    cashierCallout: 'Escanea el código antes de cobrarte y recibe tu bienvenida.',
    guideStaffTitle: 'Guion para Asesor de Ventas / Caja',
    guideScriptGreeting: '“¡Hola! Antes de pagar tus prendas, escanea este código en caja para darte tu bono de bienvenida en tu primera compra con nosotros”.',
    guideScriptExplain: '“Con Rabbitty acumulas un porcentaje de tu compra en saldo digital para tus siguientes compras de temporada”.'
  },
  barber: {
    key: 'barber',
    label: 'Barbería / Salón de Belleza',
    icon: '💈',
    categoryHint: 'Cuidado Personal & Estilo',
    posterTag: 'Punto de Cuidado Personal',
    posterHeadlinePrefix: 'CORTE FRESCO HOY.',
    posterHeadlineHighlight: 'BENEFICIOS EN CADA SERVICIO.',
    posterDescription: 'Mantener tu imagen impecable ahora tiene premio. Escanea el código mientras te atienden y recibe tu bono al instante.',
    tableWaitingCallout: 'En la sala de espera o sillón',
    tableHeadline: 'TU CORTE CON RECOMPENSA',
    tableStep1: 'Disfruta tu corte o arreglo y acumula Bunz de forma automática.',
    tableStep3: 'Aplica tu saldo acumulado en cortes, afeitados o productos de cuidado.',
    tableFooterHint: 'Pregunta a tu barbero por los productos oficiales de la barbería.',
    cashierTag: 'Al pagar tu servicio',
    cashierCallout: 'Escanea antes de pagar y recibe tu saldo de bienvenida.',
    guideStaffTitle: 'Guion para Barbero / Estilista',
    guideScriptGreeting: '“Amigo, mientras te preparo el servicio, escanea este QR para darte de alta y regalarte saldo de bienvenida en tu cuenta de Rabbitty”.',
    guideScriptExplain: '“En cada corte vas acumulando Bunz para tener descuentos automáticos o servicios gratis en tus siguientes visitas”.'
  },
  bakery: {
    key: 'bakery',
    label: 'Panadería / Pastelería / Postres',
    icon: '🥐',
    categoryHint: 'Panadería & Repostería',
    posterTag: 'Horneado con Pasión',
    posterHeadlinePrefix: 'DULCES MOMENTOS.',
    posterHeadlineHighlight: 'BUNZ EN CADA ANTOJO.',
    posterDescription: 'El pan recién horneado y tus postres consentidos ahora te devuelven recompensas. Escanea y llévate tu bono de bienvenida.',
    tableWaitingCallout: 'Endulza tu día y ahorra',
    tableHeadline: '¿YA TIENES TU BONO?',
    tableStep1: 'Elige tu pan dulce o pastel y acumula Bunz digitales en tu cuenta.',
    tableStep3: 'Canjea tu saldo en tus próximos antojos y pedidos de cumpleaños.',
    tableFooterHint: 'Pan artesanal horneado todos los días desde temprano.',
    cashierTag: 'Al pagar tus postres',
    cashierCallout: 'Escanea en mostrador antes de pagar y recibe tu bono dulce.',
    guideStaffTitle: 'Guion para Encargado de Mostrador',
    guideScriptGreeting: '“¡Hola! Escanea este código en caja antes de registrar tu pan y te regalamos saldo de bienvenida para esta o tu próxima compra”.',
    guideScriptExplain: '“Cada vez que vengas por tu pan o pastel acumulas Bunz que se convierten en dinero real para pagar aquí”.'
  }
};

function detectNicheKey(categoryOrName?: string | null): string {
  if (!categoryOrName) return 'coffee';
  const text = categoryOrName.toLowerCase();

  // 1. Cafetería / Café de Especialidad (prioridad ante nombres con "Café", "Coffee", etc.)
  if (
    text.includes('café') ||
    text.includes('cafe') ||
    text.includes('coffee') ||
    text.includes('cafeter') ||
    text.includes('barista') ||
    text.includes('espresso') ||
    text.includes('cappuccino') ||
    text.includes('latte') ||
    text.includes('tostador')
  ) {
    return 'coffee';
  }

  // 2. Panadería / Pastelería / Repostería
  if (
    text.includes('pan') ||
    text.includes('panader') ||
    text.includes('pastel') ||
    text.includes('postre') ||
    text.includes('bakery') ||
    text.includes('dulc') ||
    text.includes('reposter') ||
    text.includes('croissant') ||
    text.includes('dona') ||
    text.includes('galleta')
  ) {
    return 'bakery';
  }

  // 3. Barbería / Salón de Belleza / Cuidado Personal
  if (
    text.includes('barber') ||
    text.includes('corte') ||
    text.includes('peluquer') ||
    text.includes('salon') ||
    text.includes('salón') ||
    text.includes('belleza') ||
    text.includes('spa') ||
    text.includes('estetica') ||
    text.includes('estética') ||
    text.includes('uñas') ||
    text.includes('nails')
  ) {
    return 'barber';
  }

  // 4. Mariscos / Pescados / Ceviches
  if (
    text.includes('marisco') ||
    text.includes('pescad') ||
    text.includes('cevich') ||
    text.includes('aguachile') ||
    text.includes('ostion') ||
    text.includes('camaron') ||
    text.includes('camarón') ||
    text.includes('mar')
  ) {
    return 'seafood';
  }

  // 5. Ropa / Boutique / Moda
  if (
    text.includes('ropa') ||
    text.includes('boutique') ||
    text.includes('moda') ||
    text.includes('vestid') ||
    text.includes('fashion') ||
    text.includes('calzad') ||
    text.includes('zapater') ||
    text.includes('sneaker') ||
    text.includes('accesorios')
  ) {
    return 'fashion';
  }

  // 6. Restaurante / Gastronomía General
  if (
    text.includes('rest') ||
    text.includes('comida') ||
    text.includes('gourmet') ||
    text.includes('taco') ||
    text.includes('taquer') ||
    text.includes('burger') ||
    text.includes('hamburguesa') ||
    text.includes('pizza') ||
    text.includes('pizzer') ||
    text.includes('sushi') ||
    text.includes('cocina') ||
    text.includes('bar') ||
    text.includes('cantina') ||
    text.includes('bistro') ||
    text.includes('alimento')
  ) {
    return 'restaurant';
  }

  return 'coffee';
}

const ADMIN_SECRET = 'rabbitty_admin_authorized_gtm_2026';
const AUTH_STORAGE_KEY = 'rabbitty_impresos_auth_v1';

function ImpresosContent() {
  const searchParams = useSearchParams();

  // Permite que CUALQUIER negocio genere su kit dinámicamente pasando ?name=...&bunz=...&ref=...&logo=...&niche=...
  const initialName = searchParams?.get('name') || '626 Café';
  const initialBunz = searchParams?.get('bunz') || '25';
  const initialRef = searchParams?.get('ref') || '626cafe';
  const initialLogo = searchParams?.get('logo') || '';
  const initialNicheParam = searchParams?.get('niche') || '';
  const initialUrl = searchParams?.get('url') || `https://rabbitty.me/download?ref=${initialRef}`;

  // Auth: Permitido para Admin y para Afiliados con token o refCode
  const [isAuthorized, setIsAuthorized] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const keyParam = searchParams?.get('admin_key') || searchParams?.get('auth');
    const refParam = searchParams?.get('ref');

    // 1. Clave secreta de Admin
    if (keyParam === ADMIN_SECRET) {
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, 'admin');
        window.history.replaceState({}, '', window.location.pathname + (refParam ? `?ref=${refParam}` : ''));
      } catch {}
      return true;
    }

    // 2. Revisar localStorage previo (admin / affiliate por QR / temp con expiry)
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored?.startsWith('temp:')) {
        const exp = Number(stored.split(':')[2] || 0);
        if (exp > Date.now()) return true;
        localStorage.removeItem(AUTH_STORAGE_KEY);
        return false;
      }
      return Boolean(stored);
    } catch {
      return false;
    }
  });

  const [authCodeInput, setAuthCodeInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [showQrModal, setShowQrModal] = useState(false);
  const [authMode, setAuthMode] = useState<'admin' | 'affiliate' | 'temp'>(() => {
    if (typeof window === 'undefined') return 'admin';
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY) || '';
      if (stored.startsWith('temp_')) {
        const exp = Number(stored.split(':')[2] || 0);
        if (exp > Date.now()) return 'temp';
      }
      return stored.startsWith('affiliate_') ? 'affiliate' : 'admin';
    } catch {
      return 'admin';
    }
  });
  const [tempAccessInfo, setTempAccessInfo] = useState<{ label: string; expiresAt: string } | null>(null);
  const [tempScopeBusinessId, setTempScopeBusinessId] = useState<string | null>(null);
  const [tempGenerated, setTempGenerated] = useState<{ code: string; url: string; expiresAt: string; scopeName?: string } | null>(null);
  const [tempLabel, setTempLabel] = useState('Impresor');
  const [showTempForm, setShowTempForm] = useState(false);
  const [tempScopePick, setTempScopePick] = useState<string>('ALL');
  const [authUserName, setAuthUserName] = useState<string>('');


  const [qrSessionId, setQrSessionId] = useState<string | null>(null);
  const [qrGateCode, setQrGateCode] = useState<string>('');
  const [qrSessionData, setQrSessionData] = useState<string>('');
  const [qrLoading, setQrLoading] = useState<boolean>(false);
  const [qrStatusMsg, setQrStatusMsg] = useState<string>('');

  // ── Acceso temporal via ?access=CODE (redeem server-side, 24h) ──
  useEffect(() => {
    const accessParam = searchParams?.get('access');
    if (!accessParam || !/^[A-Z0-9]{8}$/i.test(accessParam)) return;
    fetch('/api/auth/qr-impresos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'REDEEM_TEMP_CODE', code: accessParam.toUpperCase() }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.success) {
          localStorage.setItem(AUTH_STORAGE_KEY, `temp:${accessParam.toUpperCase()}:${new Date(d.expiresAt).getTime()}`);
          setAuthMode('temp');
          setTempAccessInfo({ label: d.label || 'Invitado', expiresAt: d.expiresAt });
          setTempScopeBusinessId(d.scopeBusinessId ?? null);
          setIsAuthorized(true);
          window.history.replaceState({}, '', window.location.pathname);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [businessName, setBusinessName] = useState(initialName);
  const [welcomeBunz, setWelcomeBunz] = useState(initialBunz);
  // ── Políticas de piezas (regla rectora: permanentes venden hábito/acceso; promocionales venden incentivo) ──
  type PiecePolicy = 'hero' | 'reward' | 'evergreen';
  const PIECE_DEFAULT_POLICY: Record<string, PiecePolicy> = {
    poster: 'evergreen', // A3 vidriera: EVERGREEN default; REWARD opcional
    table: 'hero',       // A5 frontal: HERO
    cashier: 'evergreen', // A6 caja: EVERGREEN default; REWARD opcional
    guide: 'hero',       // A4 comercial: HERO
  };
  const [pieceModeOverrides, setPieceModeOverrides] = useState<Record<string, PiecePolicy>>({});
  const [permanentMode, setPermanentMode] = useState(false);
  const [welcomeBonusActive, setWelcomeBonusActive] = useState(true);
  const [rewardPct, setRewardPct] = useState<number>(0);
  const [bunzDirty, setBunzDirty] = useState(false);
  const bunzNum = Math.max(0, Number(welcomeBunz) || 0);
  const effectivePolicy = (piece: string): PiecePolicy =>
    permanentMode ? 'evergreen' : (pieceModeOverrides[piece] ?? PIECE_DEFAULT_POLICY[piece] ?? 'evergreen');
  // hero: renderiza el monto SOLO si la promoción está activa y configurada (>0)
  const showBunz = (piece: string) => effectivePolicy(piece) === 'hero' && welcomeBonusActive && bunzNum >= 5;
  // reward: solo si la pieza es REWARD y hay % real (>0) — nunca 0% ni undefined
  const showPct = (piece: string) => {
    if (effectivePolicy(piece) !== 'reward') return false;
    const pct = Math.round(rewardPct);
    return pct > 0;
  };
  const [appUrl, setAppUrl] = useState(initialUrl);
  const [activeRef, setActiveRef] = useState(initialRef);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [urlManuallyEdited, setUrlManuallyEdited] = useState(false);
  const clampWelcomeBunz = (raw: string | number): number => {
    const n = Math.round(Number(String(raw).replace(/\D/g, '')) || 0);
    return Math.min(200, Math.max(5, n));
  };
  const buildDownloadUrl = (ref: string, bunz: number) =>
    `https://rabbitty.me/download?ref=${encodeURIComponent(ref)}&bunz=${bunz}`;
  const [businessLogo, setBusinessLogo] = useState(initialLogo);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>(() => {
    return detectNicheKey(initialNicheParam || initialName);
  });
  const [activeTab, setActiveTab] = useState<'all' | 'poster' | 'table' | 'cashier' | 'guide'>('all');

  // Selector inteligente de negocios de la BD
  const [businesses, setBusinesses] = useState<BusinessItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loadingBusinesses, setLoadingBusinesses] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentTemplate = NICHE_TEMPLATES[selectedTemplateKey] || NICHE_TEMPLATES.coffee;

  const generateNeonQrSession = async () => {
    setQrLoading(true);
    setQrStatusMsg('');
    try {
      const res = await fetch('/api/auth/qr-impresos', { method: 'POST' });
      const data = await res.json();
      if (data?.success && data.sessionId && data.qrData) {
        setQrSessionId(data.sessionId);
        setQrSessionData(data.qrData);
        setQrGateCode(data.gateCode || '');
      } else {
        setQrStatusMsg(data?.error || 'No se pudo generar el QR Neón');
      }
    } catch {
      setQrStatusMsg('Error de red al generar sesión QR Neón');
    } finally {
      setQrLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/qr-impresos', { method: 'POST' });
        const data = await res.json();
        if (cancelled) return;
        if (data?.success && data.sessionId && data.qrData) {
          setQrSessionId(data.sessionId);
          setQrSessionData(data.qrData);
          setQrStatusMsg('');
        } else {
          setQrStatusMsg(data?.error || 'No se pudo generar el QR Neón');
        }
      } catch {
        if (!cancelled) {
          setQrStatusMsg('Error de red al generar sesión QR Neón');
        }
      } finally {
        if (!cancelled) {
          setQrLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthorized]);

  useEffect(() => {
    if (isAuthorized || !qrSessionId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/auth/qr-impresos?sessionId=${encodeURIComponent(qrSessionId)}`);
        const data = await res.json();
        if (!data?.success) return;

        if (data.expired) {
          void generateNeonQrSession();
          return;
        }

        if (data.authenticated) {
          if (data.authorized && (data.mode === 'admin' || data.mode === 'affiliate')) {
            const resolvedMode = data.mode as 'admin' | 'affiliate';
            setAuthMode(resolvedMode);
            setAuthUserName(data.user?.name || (resolvedMode === 'admin' ? 'Admin Rabbitty' : 'Afiliado'));

            if (resolvedMode === 'affiliate' && data.business) {
              const b = data.business as BusinessItem;
              setBusinessName(b.name);
              const bunzVal = clampWelcomeBunz(b.welcomeBunz ?? 25);
              setWelcomeBunz(String(bunzVal));
              setActiveRef(b.refCode);
              setSelectedBusinessId(b.id);
              setUrlManuallyEdited(false);
              setAppUrl(buildDownloadUrl(b.refCode, bunzVal));
              setBusinessLogo(b.logoUrl || '/icon_ra.png');
              setRewardPct(b.rewardPercentage || 0);
              setSelectedTemplateKey(detectNicheKey(`${b.category} ${b.name}`));
              try {
                localStorage.setItem(AUTH_STORAGE_KEY, `affiliate_${b.refCode}`);
              } catch {}
            } else {
              try {
                localStorage.setItem(AUTH_STORAGE_KEY, 'admin');
              } catch {}
            }

            setIsAuthorized(true);
            setShowQrModal(false);
            setAuthError('');
          } else {
            // Es un Rabbitter (cliente regular): denegar acceso y regenerar QR
            setAuthError(
              data.message ||
                '🚫 Tu cuenta es de Rabbitter (Cliente). Este generador es exclusivo para Comercios Afiliados y Administradores.'
            );
            setQrStatusMsg(
              data.message ||
                '🚫 Acceso exclusivo para Afiliados y Administradores (Rabbitters no autorizados).'
            );
            void generateNeonQrSession();
          }
        }
      } catch {
        // continuar sondeando
      }
    }, 2200);

    return () => clearInterval(interval);
  }, [isAuthorized, qrSessionId]);

  useEffect(() => {
    fetch('/api/affiliates')
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && Array.isArray(data.businesses)) {
          setBusinesses(data.businesses);
          if (typeof data.welcomeBonusActive === 'boolean') setWelcomeBonusActive(data.welcomeBonusActive);
          // Si no vino logo en URL o vino vacío, y estamos con el negocio inicial, auto-asignar el logo registrado y detectar nicho
          const match = data.businesses.find((b: BusinessItem) => 
            b.name.toLowerCase() === initialName.toLowerCase() || 
            b.refCode?.toLowerCase() === initialRef.toLowerCase()
          );
          if (match) {
            if (!initialLogo && match.logoUrl) {
              setBusinessLogo(match.logoUrl);
            }
            if (!initialNicheParam) {
              setSelectedTemplateKey(detectNicheKey(`${match.category || ''} ${match.name}`));
            }
          }
        }
      })
      .catch((err) => console.error('Error cargando afiliados:', err))
      .finally(() => setLoadingBusinesses(false));
  }, [initialLogo, initialName, initialRef, initialNicheParam]);

  // 🔒 Temp con scope: fijar SU negocio cuando la lista carga
  useEffect(() => {
    if (authMode !== 'temp' || businesses.length === 0) return;

    if (tempScopeBusinessId) {
      const mine = businesses.find((b) => b.id === tempScopeBusinessId);
      if (mine && selectedBusinessId !== mine.id) {
        const t = setTimeout(() => {
          setBusinessName(mine.name);
          setActiveRef(mine.refCode);
          setSelectedBusinessId(mine.id);
          setUrlManuallyEdited(false);
          const bunzVal = clampWelcomeBunz(mine.welcomeBunz ?? 25);
          setWelcomeBunz(String(bunzVal));
          setAppUrl(buildDownloadUrl(mine.refCode, bunzVal));
          setBusinessLogo(mine.logoUrl || '/icon_ra.png');
          setSelectedTemplateKey(detectNicheKey(`${mine.category || ''} ${mine.name}`));
        }, 0);
        return () => clearTimeout(t);
      }
    } else if (!selectedBusinessId) {
      // Temp global (sin scope de un solo negocio): inicializar con el que haga match o el primer afiliado
      const target = businesses.find((b) => 
        b.name.toLowerCase() === initialName.toLowerCase() || 
        b.refCode?.toLowerCase() === initialRef.toLowerCase()
      ) || businesses[0];
      if (target) {
        const t = setTimeout(() => {
          setBusinessName(target.name);
          setActiveRef(target.refCode);
          setSelectedBusinessId(target.id);
          setUrlManuallyEdited(false);
          const bunzVal = clampWelcomeBunz(target.welcomeBunz ?? 25);
          setWelcomeBunz(String(bunzVal));
          setAppUrl(buildDownloadUrl(target.refCode, bunzVal));
          setBusinessLogo(target.logoUrl || '/icon_ra.png');
          setSelectedTemplateKey(detectNicheKey(`${target.category || ''} ${target.name}`));
        }, 0);
        return () => clearTimeout(t);
      }
    }
  }, [authMode, tempScopeBusinessId, businesses, selectedBusinessId, initialName, initialRef]);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectBusiness = (b: BusinessItem) => {
    setBusinessName(b.name);
    const bunzVal = clampWelcomeBunz(b.welcomeBunz ?? 25);
    setWelcomeBunz(String(bunzVal));
    setActiveRef(b.refCode);
    setSelectedBusinessId(b.id);
    setUrlManuallyEdited(false);
    setAppUrl(buildDownloadUrl(b.refCode, bunzVal));
    setBusinessLogo(b.logoUrl || '/icon_ra.png');
    setRewardPct(b.rewardPercentage || 0);
    const detected = detectNicheKey(`${b.category} ${b.name}`);
    setSelectedTemplateKey(detected);
    setIsDropdownOpen(false);
    setSearchQuery('');
  };

  // ── Sincronización Bono de Bienvenida ↔ URL del QR (y persistencia por tenant) ──
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (urlManuallyEdited) return;
    const bunz = clampWelcomeBunz(welcomeBunz);
    const t = setTimeout(() => {
      setAppUrl((prev) => {
        // Solo regenerar si la URL actual es la autogenerada (el usuario no la editó a mano)
        if (prev.startsWith('https://rabbitty.me/download?ref=')) {
          return buildDownloadUrl(activeRef, bunz);
        }
        return prev;
      });
    }, 0);
    return () => clearTimeout(t);
  }, [welcomeBunz, activeRef, urlManuallyEdited]);

  useEffect(() => {
    if (!selectedBusinessId) return;
    if (authMode === 'temp') return; // acceso temporal: solo vista/impresión
    const bunz = clampWelcomeBunz(welcomeBunz);
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      fetch('/api/auth/qr-impresos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SET_WELCOME_BUNZ', sessionId: qrSessionId || '', businessId: selectedBusinessId, bunz }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (!d?.success) console.warn('[impresos] bono no persistido:', d?.error);
        })
        .catch(() => {});
    }, 900);
    return () => { if (persistTimer.current) clearTimeout(persistTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [welcomeBunz, selectedBusinessId]);

  // 🔒 Lock del selector: afiliados y accesos temporales con scope solo ven SU negocio
  const selectorLocked = authMode === 'affiliate' || (authMode === 'temp' && Boolean(tempScopeBusinessId));
  const filteredBusinesses = businesses.filter((b) =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handlePrint = () => {
    // ── Versionado: snapshot inmutable de la config al momento de enviar a imprenta ──
    try {
      const key = `rabbitty_impresos_versions_${selectedBusinessId || 'default'}`;
      const prev = JSON.parse(localStorage.getItem(key) || '[]');
      prev.unshift({
        date: new Date().toISOString(),
        bunz: welcomeBunz,
        pct: rewardPct,
        template: currentTemplate.label,
        policy: permanentMode ? 'evergreen' : 'mixto',
      });
      localStorage.setItem(key, JSON.stringify(prev.slice(0, 20)));
    } catch {}
    window.print();
  };

  // Helper para renderizar insignia o logo del afiliado con fallback elegante al logo de Ra
  const renderAffiliateBadge = (size: 'sm' | 'md' | 'lg' = 'md', dark = true) => {
    const sizeClasses = {
      sm: 'h-8 px-3 text-xs gap-2',
      md: 'h-11 px-3.5 text-sm gap-2.5',
      lg: 'h-14 px-4 text-base gap-3'
    };

    const logoSizes = {
      sm: 'w-6 h-6 max-h-6',
      md: 'w-8 h-8 max-h-8',
      lg: 'w-10 h-10 max-h-10'
    };

    const effectiveLogo = businessLogo || '/icon_ra.png';

    return (
      <div 
        className={`flex items-center rounded-2xl border transition-all ${
          dark 
            ? 'bg-zinc-900/95 border-zinc-700/80 text-white shadow-lg shadow-black/40' 
            : 'bg-white border-zinc-200 text-black shadow-sm'
        } ${sizeClasses[size]}`}
      >
        {/* Contenedor del logo con fondo contrastante para logos transparentes u oscuros */}
        <div className={`rounded-xl flex items-center justify-center p-0.5 shrink-0 overflow-hidden ${dark ? 'bg-white/10' : 'bg-zinc-100'} ${logoSizes[size]}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={effectiveLogo} 
            alt={businessName} 
            className="w-full h-full object-contain rounded-lg"
            onError={(e) => {
              // Si falla la imagen externa, hacer fallback inmediato al Ra de Rabbitty
              if (e.currentTarget.src !== window.location.origin + '/icon_ra.png') {
                e.currentTarget.src = '/icon_ra.png';
              }
            }}
          />
        </div>
        <span className="font-black whitespace-nowrap tracking-tight">{businessName}</span>
      </div>
    );
  };

  const handleUnlock = async (e: React.FormEvent) => {
      e.preventDefault();
      const clean = authCodeInput.trim();

      // Código temporal (24h) — validado server-side
      if (/^[A-Z0-9]{8}$/i.test(clean)) {
        try {
          const res = await fetch('/api/auth/qr-impresos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'REDEEM_TEMP_CODE', code: clean.toUpperCase() }),
          });
          const d = await res.json();
          if (d?.success) {
            localStorage.setItem(AUTH_STORAGE_KEY, `temp:${clean.toUpperCase()}:${new Date(d.expiresAt).getTime()}`);
            setAuthMode('temp');
            setTempAccessInfo({ label: d.label || 'Invitado', expiresAt: d.expiresAt });
            setTempScopeBusinessId(d.scopeBusinessId ?? null);
            setIsAuthorized(true);
            setAuthError('');
            return;
          }
          setAuthError(d?.error || 'Código inválido o expirado');
          return;
        } catch {
          setAuthError('Error de red al validar el código');
          return;
        }
      }

      // Clave de Admin (variable de entorno — sin bypass hardcodeado)
      if (ADMIN_SECRET && clean === ADMIN_SECRET) {
        try {
          localStorage.setItem(AUTH_STORAGE_KEY, 'admin');
        } catch {}
        setIsAuthorized(true);
        setAuthError('');
        return;
      }

      // Afiliados: SOLO vía escaneo QR con prueba de propiedad (sin atajos)
      setAuthError('Clave incorrecta. Usa tu clave de Admin, un código de acceso temporal, o escanea el QR con la App Rabbitty.');
    };

    if (!isAuthorized) {
      return (
        <div className="min-h-screen bg-[#09090B] text-zinc-100 flex flex-col items-center justify-center p-6 relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 w-full max-w-2xl bg-zinc-900/90 border border-zinc-800 rounded-3xl p-8 backdrop-blur-xl shadow-2xl grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            {/* COLUMNA IZQUIERDA: ESCANEO QR NEÓN CON APP RABBITTY */}
            <div className="flex flex-col items-center text-center border-b md:border-b-0 md:border-r border-zinc-800 pb-6 md:pb-0 md:pr-6">
              <span className="text-[10px] font-black uppercase tracking-widest text-pink-400 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 inline-flex items-center gap-1.5 mb-3">
                <Sparkles className="w-3 h-3" /> QR Neón · Afiliados
              </span>
              <h2 className="text-lg font-black text-white">Escanea con tu App Rabbitty</h2>
              <p className="text-[11px] text-zinc-400 mt-1 mb-4 leading-relaxed">
                Abre tu App de <strong className="text-white">Rabbitty</strong> (Escáner o Cámara). Acceso exclusivo para <strong className="text-pink-400">Negocios Afiliados</strong>.
              </p>

              <div className="relative flex items-center justify-center my-1">
                {qrSessionData && !qrLoading ? (
                  <div className="flex flex-col items-center gap-3">
                    <NeonQRCode value={qrSessionData} size={170} />
                    <div className="bg-white rounded-2xl p-2 shadow-[0_0_30px_rgba(236,72,153,0.25)]">
                      {/* Escaneable con la cámara del iPhone: Universal Link → abre la App nativa → autoriza */}
                      <SimpleQRCode value={qrSessionData} size={150} />
                    </div>
                    {qrGateCode && (
                      <p className="text-xs text-zinc-400 text-center leading-snug">
                        Escanea el <b className="text-white">QR cuadrado</b> con la cámara del iPhone → se abre la App y autoriza.<br />
                        ¿Ya dentro de la App? <b className="text-white">Escáner → código manual</b>:{' '}
                        <b className="text-pink-400 font-mono tracking-[2px]">{qrGateCode}</b>
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="w-56 h-56 rounded-4xl bg-[#110520] border-2 border-pink-500/40 flex flex-col items-center justify-center gap-3 p-4">
                    <RefreshCw className="w-7 h-7 text-pink-400 animate-spin" />
                    <span className="text-xs font-bold text-zinc-300">Generando QR Neón...</span>
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center gap-2 text-[11px] text-emerald-400 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Esperando escaneo en vivo...</span>
                <button
                  type="button"
                  onClick={() => void generateNeonQrSession()}
                  className="text-zinc-400 hover:text-white ml-1 cursor-pointer"
                  title="Regenerar código QR Neón"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {qrStatusMsg && (
                <p className="text-[11px] text-rose-400 font-semibold mt-2 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">
                  {qrStatusMsg}
                </p>
              )}
            </div>

            {/* COLUMNA DERECHA: ACCESO POR CLAVE O REFCODE */}
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-pink-500/10 border border-pink-500/20 text-pink-400 shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl font-black tracking-tight text-white">
                    Kit de Materiales Impresos
                  </h1>
                  <p className="text-[11px] text-zinc-400">
                    Habladores de mesa, carteles A3 y señalética POS
                  </p>
                </div>
              </div>

              <form onSubmit={handleUnlock} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">
                    Clave Admin o Código de Acceso (24h)
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="password"
                      placeholder="Código temporal (8 caracteres) o Clave Admin"
                      value={authCodeInput}
                      onChange={(e) => setAuthCodeInput(e.target.value)}
                      className="w-full bg-black/60 border border-zinc-800 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition-all"
                    />
                  </div>
                  {authError && (
                    <p className="text-xs text-rose-400 mt-2 font-medium">{authError}</p>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full bg-linear-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-black text-sm py-3 rounded-xl shadow-lg shadow-pink-500/20 active:scale-[0.98] transition-all cursor-pointer"
                >
                  Acceder con Clave
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-500">
                <Link href="/" className="hover:text-zinc-300 transition-colors">
                  ← Volver al inicio
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setShowQrModal(true);
                    if (!qrSessionData) void generateNeonQrSession();
                  }}
                  className="flex items-center gap-1.5 text-pink-400 hover:text-pink-300 font-bold transition-colors cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5" /> Ampliar QR Neón
                </button>
              </div>
            </div>
          </div>

          {/* Modal de QR Neón Ampliado */}
          {showQrModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-sm w-full text-center relative shadow-2xl">
                <button
                  type="button"
                  onClick={() => setShowQrModal(false)}
                  className="absolute top-4 right-4 text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="w-12 h-12 rounded-2xl bg-pink-500/10 border border-pink-500/20 text-pink-400 flex items-center justify-center mx-auto mb-3">
                  <QrCode className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black text-white">Acceso QR Neón Rabbitty</h3>
                <p className="text-xs text-zinc-400 mt-1 mb-4">
                  Escanea con el lector de tu App Rabbitty. Válido únicamente para <strong className="text-white">Afiliados</strong>.
                </p>
                <div className="inline-block mb-4 pt-6">
                  {qrSessionData && !qrLoading ? (
                    <NeonQRCode value={qrSessionData} size={210} />
                  ) : (
                    <div className="w-60 h-60 rounded-4xl bg-[#110520] border-2 border-pink-500/40 flex flex-col items-center justify-center gap-3 p-4">
                      <RefreshCw className="w-7 h-7 text-pink-400 animate-spin" />
                      <span className="text-xs font-bold text-zinc-300">Sincronizando QR Neón...</span>
                    </div>
                  )}
                </div>
                {qrStatusMsg && (
                  <p className="text-xs text-rose-400 mb-3 font-medium">{qrStatusMsg}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void generateNeonQrSession()}
                    className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Actualizar Código QR
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 selection:bg-pink-500 selection:text-white">
      {/* BARRA SUPERIOR DE CONTROL (No imprimible) */}
      <header className="print:hidden sticky top-0 z-40 backdrop-blur-xl bg-black/85 border-b border-zinc-800 px-6 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* LADO IZQUIERDO: Marca + Kit en Fila 1; Pills compactas en Fila 2 */}
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2">
              <Link href="/" className="flex items-center gap-2 group shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo_conejo.png" alt="Rabbitty" className="w-7 h-7 object-contain transition-transform group-hover:scale-110" />
                <span className="font-black text-lg tracking-tight text-white">RABBITTY</span>
              </Link>
              <span className="text-zinc-600 font-mono text-xs">/</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20 flex items-center gap-1.5 shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-pink-400" /> Kit Impresos Piloto Oficial
              </span>
            </div>

            {/* Fila 2: Pills secundarias más pequeñas */}
            <div className="flex items-center gap-1.5 pl-0.5">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-300 shrink-0">
                {authMode === 'admin' ? `✅ Acceso autorizado${authUserName ? ` · ${authUserName}` : ''}` : authMode === 'temp' ? `⏳ Acceso temporal · ${tempAccessInfo?.label ?? 'Invitado'}` : `🏪 Afiliado · ${businessName}`}
              </span>

              {/* Si es invitado temporal, mostrar el negocio activo y switcher si tiene acceso global */}
              {authMode === 'temp' && (
                !tempScopeBusinessId && businesses.length > 1 ? (
                  <div className="relative inline-flex items-center shrink-0">
                    <select
                      value={selectedBusinessId || ''}
                      onChange={(e) => {
                        const found = businesses.find((b) => b.id === e.target.value);
                        if (found) handleSelectBusiness(found);
                      }}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-300 border border-pink-500/25 hover:bg-pink-500/20 transition-all cursor-pointer appearance-none pr-5 focus:outline-none"
                      title="Cambiar negocio a imprimir"
                    >
                      {businesses.map((b) => (
                        <option key={b.id} value={b.id} className="bg-zinc-900 text-white">
                          🏪 {b.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-2.5 h-2.5 text-pink-400 absolute right-1.5 pointer-events-none" />
                  </div>
                ) : (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-300 shrink-0">
                    🏪 {businessName}
                  </span>
                )
              )}

              {(authMode === 'admin' || authMode === 'affiliate') && (
                <button
                  type="button"
                  onClick={() => setShowTempForm(true)}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/25 hover:bg-sky-500/20 transition-all cursor-pointer flex items-center gap-1 shrink-0"
                  title="Generar acceso temporal de 24 horas"
                >
                  <KeyRound className="w-2.5 h-2.5" />
                  <span>🔑 Acceso temporal (24h)</span>
                </button>
              )}
            </div>
          </div>

          {/* LADO DERECHO: Tabs + Imprimir + Salir alineados a la derecha */}
          <div className="flex items-center gap-2.5 shrink-0 ml-auto">
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-1 text-xs font-medium">
              <button 
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${activeTab === 'all' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white'}`}
              >
                Todos
              </button>
              <button 
                type="button"
                onClick={() => setActiveTab('poster')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${activeTab === 'poster' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white'}`}
              >
                A3 Cartel
              </button>
              <button 
                type="button"
                onClick={() => setActiveTab('table')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${activeTab === 'table' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white'}`}
              >
                A5 Mesas
              </button>
              <button 
                type="button"
                onClick={() => setActiveTab('cashier')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${activeTab === 'cashier' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white'}`}
              >
                A6 Caja
              </button>
              <button 
                type="button"
                onClick={() => setActiveTab('guide')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${activeTab === 'guide' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white'}`}
              >
                Hoja Afiliado
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 bg-linear-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-black text-xs sm:text-sm px-4 py-2 rounded-xl shadow-lg shadow-pink-500/25 transition-all active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / Exportar PDF</span>
            </button>

            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.removeItem(AUTH_STORAGE_KEY);
                } catch {}
                setIsAuthorized(false);
              }}
              className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white font-bold text-xs px-3 py-2 rounded-xl transition-colors cursor-pointer"
              title="Cerrar sesión / Probar escaneo QR Neón"
            >
              <LogOut className="w-3.5 h-3.5 text-pink-400" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* MODAL DE ACCESO TEMPORAL (24H) */}
      {showTempForm && (authMode === 'admin' || authMode === 'affiliate') && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setShowTempForm(false)}
        >
          <div 
            className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 max-w-lg w-full relative shadow-2xl shadow-sky-950/40 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  <KeyRound className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-black text-white">Generar Acceso Temporal (24h)</h3>
                  <p className="text-[11px] text-zinc-400">
                    {authMode === 'affiliate' ? `Acceso limitado a ${businessName}` : 'Crea un pase temporal de 24 horas para impresores o marketing'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTempForm(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Nombre o Destinatario
                </label>
                <input
                  value={tempLabel}
                  onChange={(e) => setTempLabel(e.target.value)}
                  placeholder="Ej: Imprenta Rápida, Diseñador, Juan Pérez..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Alcance / Negocio visible
                </label>
                {authMode === 'admin' ? (
                  <select
                    value={tempScopePick}
                    onChange={(e) => setTempScopePick(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500 cursor-pointer"
                  >
                    <option value="ALL">👁️ Ver todos los negocios (Full Access)</option>
                    {businesses.map((b) => (
                      <option key={b.id} value={b.id}>🏪 Solo {b.name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-300 flex items-center justify-between">
                    <span>🏪 {businessName}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">(fijo)</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={async () => {
                  if (!tempLabel.trim()) { window.alert('Pon para quién es el acceso'); return; }
                  try {
                    const res = await fetch('/api/auth/qr-impresos', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        action: 'GENERATE_TEMP_CODE',
                        sessionId: qrSessionId || '',
                        label: tempLabel.trim(),
                        ...(authMode === 'admin' && tempScopePick !== 'ALL' ? { businessId: tempScopePick } : {}),
                      }),
                    });
                    const d = await res.json();
                    if (d?.success) {
                      setTempGenerated({ code: d.code, url: d.url, expiresAt: d.expiresAt, scopeName: d.scopeName });
                      navigator.clipboard.writeText(d.url).catch(() => {});
                    } else {
                      window.alert(d?.error || 'No se pudo generar el acceso');
                    }
                  } catch {
                    window.alert('Error de red al generar el acceso');
                  }
                }}
                className="w-full py-2.5 rounded-xl bg-linear-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-black cursor-pointer shadow-lg shadow-sky-500/20 transition-all active:scale-[0.99] flex items-center justify-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>⚡ Generar Código de 24 Horas</span>
              </button>

              {tempGenerated && (
                <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/30 space-y-2 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">Código de Acceso Activo</span>
                    <span className="text-[10px] text-zinc-400">Válido 24 horas</span>
                  </div>
                  <div className="flex items-center justify-between bg-black/60 rounded-xl px-3 py-2 border border-sky-500/20">
                    <span className="text-base font-mono font-black text-emerald-400 tracking-[3px]">{tempGenerated.code}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(tempGenerated.url || tempGenerated.code).catch(() => {});
                        window.alert('¡Enlace y código copiados al portapapeles!');
                      }}
                      className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 transition-colors cursor-pointer"
                    >
                      Copiar Enlace
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-400 break-all">
                    {tempGenerated.url} · {tempGenerated.scopeName ? `Alcance: ${tempGenerated.scopeName}` : 'Todos los negocios'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PANEL DE PERSONALIZACIÓN Y SELECCIÓN DE TEMPLATE (Solo visible para Admin y Afiliados; oculto para Invitados) */}
      {authMode !== 'temp' && (
        <section className="print:hidden border-b border-zinc-900 bg-zinc-950/70 py-6 px-6">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-5 shadow-2xl backdrop-blur-md">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
              <div>
                <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-pink-500" />
                  Generador de Materiales Físicos en Punto de Venta
                </h1>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Elige tu negocio afiliado, la plantilla de copy curada para tu nicho de mercado y posiciona tu logotipo estratégico.
                </p>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 pb-4 border-b border-zinc-800/60">
                <button
                  type="button"
                  onClick={() => setPermanentMode((v) => !v)}
                  className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
                    permanentMode
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-white/5 text-zinc-400 border-zinc-700 hover:bg-white/10'
                  }`}
                  title="Fuerza TODAS las piezas en versión evergreen (sin cifras) — señalética de larga duración"
                >
                  {permanentMode ? '🌿 Modo permanente activo' : '🌿 Modo permanente (sin cifras)'}
                </button>

                {/* A3/A6: elegir REWARD (con %) o EVERGREEN */}
                <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                  <span className="font-bold uppercase tracking-wider">A3 Vidriera:</span>
                  <select
                    value={pieceModeOverrides.poster ?? 'evergreen'}
                    onChange={(e) => setPieceModeOverrides((p) => ({ ...p, poster: e.target.value as PiecePolicy }))}
                    className="bg-black border border-zinc-800 rounded-lg px-2 py-1 text-[10px] text-white cursor-pointer focus:outline-none"
                  >
                    <option value="evergreen">🌿 Sin cifras (durable)</option>
                    <option value="reward">📊 Con %{Math.round(rewardPct)} (garantizado)</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                  <span className="font-bold uppercase tracking-wider">A6 Caja:</span>
                  <select
                    value={pieceModeOverrides.cashier ?? 'evergreen'}
                    onChange={(e) => setPieceModeOverrides((p) => ({ ...p, cashier: e.target.value as PiecePolicy }))}
                    className="bg-black border border-zinc-800 rounded-lg px-2 py-1 text-[10px] text-white cursor-pointer focus:outline-none"
                  >
                    <option value="evergreen">🌿 Sin cifras (durable)</option>
                    <option value="reward">📊 Con %{Math.round(rewardPct)} (garantizado)</option>
                  </select>
                </div>

                {bunzDirty && (
                  <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-full">
                    ⚠️ Cambiar el bono obsoleta: A5 frontal + A4 — reimprímelas o activa Modo permanente
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-zinc-400 bg-zinc-800/60 px-2.5 py-1 rounded-md border border-zinc-700/50">
                  Piloto Rabbitty 2026
                </span>
              </div>
            </div>

            {/* Smart Business Selector */}
            <div className="mb-4 pt-2 border-t border-zinc-800 relative" ref={dropdownRef}>
              <label className="text-[11px] font-bold text-pink-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> {selectorLocked ? 'Tu Negocio Afiliado' : '1. Seleccionar Negocio Afiliado de la Red'}
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { if (!selectorLocked) setIsDropdownOpen(!isDropdownOpen); }}
                  disabled={selectorLocked}
                  className={`w-full bg-black border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-left flex items-center justify-between text-white transition-colors ${selectorLocked ? 'opacity-70 cursor-not-allowed' : 'hover:border-pink-500/50 cursor-pointer'}`}
                >
                  <div className="flex items-center gap-3">
                    {businessLogo ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={businessLogo} alt={businessName} className="w-6 h-6 rounded-md object-contain bg-zinc-900 border border-zinc-800" />
                    ) : (
                      <span className="w-2.5 h-2.5 rounded-full bg-pink-500" />
                    )}
                    <span className="font-bold text-white">{businessName}</span>
                    <span className="text-xs text-zinc-500 font-mono">({currentTemplate.label})</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-400 text-xs">
                    <span>{loadingBusinesses ? 'Cargando red...' : `${businesses.length} afiliados`}</span>
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                {isDropdownOpen && !selectorLocked && (
                  <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-[#121216] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-2xl">
                    <div className="p-3 border-b border-zinc-800 flex items-center gap-2 bg-zinc-950/60">
                      <Search className="w-4 h-4 text-zinc-500" />
                      <input
                        type="text"
                        placeholder="Buscar por nombre, categoría o dirección..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                        className="bg-transparent border-none text-white text-xs w-full focus:outline-none placeholder:text-zinc-600"
                      />
                    </div>
                    <div className="max-h-60 overflow-y-auto divide-y divide-zinc-800/50">
                      {filteredBusinesses.length === 0 ? (
                        <div className="p-4 text-center text-xs text-zinc-500">
                          No se encontraron negocios con ese término.
                        </div>
                      ) : (
                        filteredBusinesses.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => handleSelectBusiness(b)}
                            className="w-full px-4 py-3 text-left hover:bg-pink-500/10 flex items-center justify-between transition-colors group cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              {b.logoUrl ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={b.logoUrl} alt={b.name} className="w-7 h-7 rounded-md object-contain bg-zinc-900 border border-zinc-800 shrink-0" />
                              ) : (
                                <div className="w-7 h-7 rounded-md bg-zinc-800 text-[10px] font-bold text-zinc-400 flex items-center justify-center shrink-0">
                                  {b.name.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <div className="text-sm font-bold text-white group-hover:text-pink-400 flex items-center gap-2">
                                  {b.name}
                                  {b.name === businessName && <Check className="w-3.5 h-3.5 text-pink-500" />}
                                </div>
                                <div className="text-[11px] text-zinc-400 flex items-center gap-2 mt-0.5">
                                  <span className="text-zinc-500">{b.category}</span>
                                  {b.address && <span>· {b.address}</span>}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-mono font-bold text-pink-400">+{b.rewardPercentage}% Bunz</span>
                              <span className="block text-[9px] font-mono text-zinc-500">ref: {b.refCode}</span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Selector de Plantilla por Nicho de Mercado (Control de Marca e Identidad) */}
            <div className="mb-4 pt-3 border-t border-zinc-800">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-bold text-pink-400 uppercase tracking-wider flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5" /> 2. Plantilla de Copy por Nicho de Mercado (Preserva Nuestra Identidad)
                </label>
                <span className="text-[10px] text-zinc-400 italic">
                  Frases curadas y de alta conversión
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {Object.values(NICHE_TEMPLATES).map((template) => {
                  const isSelected = template.key === selectedTemplateKey;
                  return (
                    <button
                      key={template.key}
                      type="button"
                      onClick={() => setSelectedTemplateKey(template.key)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected 
                          ? 'bg-pink-500/15 border-pink-500 text-white shadow-md shadow-pink-500/10 ring-1 ring-pink-500' 
                          : 'bg-black/60 border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <div className="text-lg mb-1">{template.icon}</div>
                      <div>
                        <span className={`block text-xs font-bold leading-tight ${isSelected ? 'text-pink-300' : 'text-zinc-300'}`}>
                          {template.label.split('/')[0].trim()}
                        </span>
                        <span className="text-[10px] text-zinc-500 line-clamp-1 mt-0.5">
                          {template.categoryHint}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Campos de Ajuste Rápido y URL de Logo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-zinc-800/60">
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Nombre en Carteles
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-pink-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Bono de Bienvenida ($ MXN)
                </label>
                <input
                  type="text"
                  value={welcomeBunz}
                  onChange={(e) => { setBunzDirty(true); setWelcomeBunz(e.target.value); }}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-pink-500 font-medium"
                />
              </div>

              <div>
                <label className="flex items-center justify-between text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  <span>Logo del Afiliado (URL)</span>
                  {businessLogo && <span className="text-[10px] text-pink-400 font-mono">Cargado</span>}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={businessLogo}
                    onChange={(e) => setBusinessLogo(e.target.value)}
                    placeholder="https://.../logo.png"
                    className="w-full bg-black border border-zinc-800 rounded-xl pl-8 pr-3 py-2 text-xs text-zinc-300 font-mono focus:outline-none focus:border-pink-500"
                  />
                  <ImageIcon className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  URL Destino del QR (Referido)
                </label>
                <input
                  type="text"
                  value={appUrl}
                  onChange={(e) => { setUrlManuallyEdited(true); setAppUrl(e.target.value); }}
                  placeholder="https://rabbitty.me/download?ref=..."
                  className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs text-pink-400 font-mono focus:outline-none focus:border-pink-500"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* ÁREA DE CONTENIDO IMPRESO / RENDERIZADO */}
      <main className="max-w-7xl mx-auto p-6 md:p-12 space-y-16 print:p-0 print:space-y-0 print:m-0">

        {/* PIEZA 1: CARTEL PRINCIPAL A3 */}
        {(activeTab === 'all' || activeTab === 'poster') && (
          <section className="print:break-after-page flex flex-col items-center">
            <div className="print:hidden w-full flex items-center justify-between pb-3 mb-4 border-b border-zinc-800 text-xs text-zinc-400 font-mono">
              <span className="font-bold text-white uppercase tracking-wider">Pieza 1 · Cartel Principal para Entrada / Cristalera (Formato A3)</span>
              <span>Medidas: 297mm × 420mm · Plantilla: {currentTemplate.label}</span>
            </div>

            {/* Canvas Cartel A3 (Fondo negro minimalista Rabbitty + Co-branding estratégico) */}
            <div className="w-95 sm:w-120 md:w-150 min-h-212.5 bg-black text-white border border-zinc-800 rounded-3xl p-10 md:p-12 flex flex-col justify-between shadow-2xl relative overflow-hidden print:w-full print:min-h-screen print:rounded-none print:border-none print:p-14">
              
              {/* Marca de agua sutil de Rabbitty */}
              <div className="absolute -right-20 -bottom-20 w-96 h-96 opacity-10 pointer-events-none">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo_conejo.png" alt="" className="w-full h-full object-contain filter invert" />
              </div>

              {/* Cabecera Cartel con Posición Estratégica del Logo del Afiliado */}
              <div>
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-6 gap-4">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo_conejo.png" alt="Rabbitty" className="w-12 h-12 object-contain" />
                    <div>
                      <h2 className="font-black text-2xl tracking-tighter text-white">RABBITTY</h2>
                      <p className="text-[10px] uppercase tracking-widest text-pink-400 font-bold">The Real-World Loyalty Network</p>
                    </div>
                  </div>

                  {/* Co-Branding Estratégico en Cartel Principal */}
                  <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                      <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-bold">En alianza con</span>
                    </div>
                    {renderAffiliateBadge('lg', true)}
                  </div>
                </div>

                {/* Titular Impactante según Nicho */}
                <div className="mt-10 space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="inline-flex items-center gap-2 text-xs font-mono font-bold tracking-widest text-pink-400 uppercase px-3 py-1.5 bg-pink-500/10 rounded-xl border border-pink-500/25 shadow-xs">
                      {businessLogo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={businessLogo}
                          alt={businessName}
                          className="w-5 h-5 object-contain rounded-md bg-white/10 p-0.5"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                      <span>{currentTemplate.posterTag} · {businessName}</span>
                    </div>
                  </div>
                  <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-[1.08] text-white">
                    {currentTemplate.posterHeadlinePrefix} <br />
                    <span className="text-transparent bg-clip-text bg-linear-to-r from-pink-400 via-rose-500 to-pink-500">
                      {currentTemplate.posterHeadlineHighlight}
                    </span>
                  </h1>
                  <p className="text-sm md:text-base text-zinc-400 font-normal leading-relaxed max-w-md pt-2">
                    {currentTemplate.posterDescription}
                  </p>
                </div>
              </div>

              {/* Centro: Oferta + QR Gigante */}
              <div className="my-8 bg-zinc-950/80 border border-zinc-800 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
                <div className="flex-1 space-y-3 text-center md:text-left">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 font-bold">
                    {showPct('poster') ? 'Beneficio Permanente' : 'Únete a la Red'}
                  </span>
                  {showPct('poster') ? (
                    <>
                      <div className="flex items-baseline justify-center md:justify-start gap-1">
                        <span className="text-5xl md:text-6xl font-black tracking-tighter text-white">+{Math.round(rewardPct)}%</span>
                        <span className="text-xl md:text-2xl font-black text-pink-500 tracking-tight">BUNZ</span>
                      </div>
                      <p className="text-xs text-zinc-300 font-medium">
                        En cada consumo en <strong className="text-white">{businessName}</strong>. Acumula y canjea cuando quieras.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-baseline justify-center md:justify-start gap-1">
                        <span className="text-4xl md:text-5xl font-black tracking-tighter text-white">GANA BUNZ</span>
                      </div>
                      <p className="text-xs text-zinc-300 font-medium">
                        En cada visita a <strong className="text-white">{businessName}</strong>. Únete a la red y descubre tu red de beneficios.
                      </p>
                    </>
                  )}
                  <div className="pt-2 flex items-center justify-center md:justify-start gap-2 text-[11px] text-zinc-400">
                    <CheckCircle2 className="w-3.5 h-3.5 text-pink-500" /> Sin trámites engorrosos · Registro en 30s
                  </div>
                </div>

                {/* QR Container */}
                <div className="flex flex-col items-center">
                  <SimpleQRCode value={appUrl} size={190} />
                  <span className="text-[11px] font-mono text-zinc-400 mt-2 font-bold tracking-wider">ESCANEA CON TU CÁMARA</span>
                </div>
              </div>

              {/* Pie Cartel A3 con Co-Firma */}
              <div className="pt-6 border-t border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left text-xs text-zinc-400">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-4 h-4 text-pink-500" />
                  <span>Disponible para iOS & Android · Rabbitty Network</span>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] text-zinc-400 font-mono">
                    Punto oficial verificado en {businessName}
                  </p>
                </div>
              </div>

            </div>
          </section>
        )}

        {/* PIEZA 2: DISPLAYS DE MESA (A5) */}
        {(activeTab === 'all' || activeTab === 'table') && (
          <section className="print:break-after-page flex flex-col items-center">
            <div className="print:hidden w-full flex items-center justify-between pb-3 mb-4 border-b border-zinc-800 text-xs text-zinc-400 font-mono">
              <span className="font-bold text-white uppercase tracking-wider">Pieza 2 · Habladores de Mesa / Carpas Acrílicas (Formato A5 / A6)</span>
              <span>Medidas: 148mm × 210mm · Plantilla: {currentTemplate.label}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 print:grid-cols-2 print:gap-4 w-full max-w-4xl">
              
              {/* Cara Frontal Mesa (Fondo Blanco, Alta Legibilidad) */}
              <div className="bg-white text-black rounded-3xl p-8 border border-zinc-200 shadow-xl flex flex-col justify-between min-h-115 relative overflow-hidden print:border-black">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo_conejo_blk.png" alt="Rabbitty" className="w-7 h-7 object-contain" />
                    <span className="font-black tracking-tight text-black text-lg">RABBITTY</span>
                  </div>

                  {/* Logo / Insignia Afiliado Estratégica */}
                  {renderAffiliateBadge('md', false)}
                </div>

                <div className="my-6 text-center">
                  <span className="text-[10px] font-mono font-black text-pink-600 uppercase tracking-widest">
                    {currentTemplate.tableWaitingCallout}
                  </span>
                  <h3 className="text-2xl md:text-3xl font-black tracking-tight text-black mt-1 leading-tight">
                    {currentTemplate.tableHeadline} <br />
                    {showBunz('table') ? (
                      <>DE <span className="text-pink-600">${welcomeBunz} BUNZ</span> DE BIENVENIDA</>
                    ) : (
                      <>GANA <span className="text-pink-600">BUNZ</span> EN CADA VISITA</>
                    )}
                  </h3>
                  <p className="text-xs text-zinc-600 mt-2 font-medium">
                    1. Escanea el código con tu celular.<br />
                    2. Instala y regístrate en 30 segundos.<br />
                    3. Descubre tu saldo disponible al instante.
                  </p>
                </div>

                <div className="flex flex-col items-center justify-center">
                  <SimpleQRCode value={appUrl} size={150} color="#000000" bgColor="#FFFFFF" />
                  <span className="text-[10px] font-mono font-bold text-zinc-500 mt-2">
                    CÁMARA DEL CELULAR · IOS & ANDROID
                  </span>
                </div>

                <div className="pt-4 border-t border-zinc-200 text-center text-[9px] text-zinc-500 font-mono flex items-center justify-between">
                  <span>1 BUNZ = $1 MXN</span>
                  <span className="font-bold text-zinc-800">{businessName}</span>
                </div>
              </div>

              {/* Cara Posterior Mesa (Fondo Negro, Gamificada / Explicativa) */}
              <div className="bg-black text-white rounded-3xl p-8 border border-zinc-800 shadow-xl flex flex-col justify-between min-h-115 relative overflow-hidden print:border-black">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo_conejo.png" alt="Rabbitty" className="w-7 h-7 object-contain" />
                    <span className="font-black tracking-tight text-white text-lg">RABBITTY</span>
                  </div>
                  {renderAffiliateBadge('md', true)}
                </div>

                <div className="my-4 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-pink-500 text-white font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Acumula en cada visita</h4>
                      <p className="text-[11px] text-zinc-400">{currentTemplate.tableStep1}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-zinc-800 text-zinc-300 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Sin tarjetas de plástico</h4>
                      <p className="text-[11px] text-zinc-400">Todo vive en tu app de Rabbitty, siempre accesible y seguro.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-zinc-800 text-zinc-300 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Canjea en tus compras</h4>
                      <p className="text-[11px] text-zinc-400">{currentTemplate.tableStep3}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center pt-2">
                  <SimpleQRCode value={appUrl} size={110} />
                  <span className="text-[9px] font-mono text-zinc-400 mt-2 font-bold">
                    ESCANEAME PARA REGISTRARTE
                  </span>
                </div>

                <div className="pt-3 border-t border-zinc-800 text-center text-[9px] text-zinc-400 font-mono">
                  {currentTemplate.tableFooterHint}
                </div>
              </div>

            </div>
          </section>
        )}

        {/* PIEZA 3: SEÑAL DE CAJA (A6) */}
        {(activeTab === 'all' || activeTab === 'cashier') && (
          <section className="print:break-after-page flex flex-col items-center">
            <div className="print:hidden w-full flex items-center justify-between pb-3 mb-4 border-b border-zinc-800 text-xs text-zinc-400 font-mono">
              <span className="font-bold text-white uppercase tracking-wider">Pieza 3 · Señal de Mostrador / Caja Registradora (Formato A6)</span>
              <span>Medidas: 105mm × 148mm (Junto al lector de tarjetas / POS)</span>
            </div>

            <div className="w-full max-w-sm bg-linear-to-b from-zinc-950 to-black text-white border-2 border-pink-500 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center justify-between min-h-95">
              <div className="w-full flex items-center justify-between pb-2 border-b border-zinc-800/80">
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo_conejo.png" alt="Rabbitty" className="w-6 h-6 object-contain" />
                  <span className="font-black text-xs tracking-tight">RABBITTY POINT</span>
                </div>
                {renderAffiliateBadge('md', true)}
              </div>

              <div className="my-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-pink-400 font-bold bg-pink-500/10 px-2.5 py-0.5 rounded-full border border-pink-500/20">
                  {currentTemplate.cashierTag}
                </span>
                <h3 className="text-xl font-black tracking-tight mt-1">
                  ¿YA TIENES TU CUENTA?
                </h3>
                <p className="text-xs text-zinc-400 mt-1 max-w-xs">
                  {showBunz('guide')
                    ? `${currentTemplate.cashierCallout} (${welcomeBunz} Bunz de bienvenida para nuevos Rabbitters).`
                    : `${currentTemplate.cashierCallout} — presenta tu Mi Código y acumula Bunz en cada visita.`}
                </p>
              </div>

              <SimpleQRCode value={appUrl} size={140} />

              <div className="w-full pt-3 border-t border-zinc-800 flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                <span className="truncate max-w-32">{businessName}</span>
                <span className="text-pink-400 font-bold">1 Bunz = $1 MXN</span>
              </div>
            </div>
          </section>
        )}

        {/* PIEZA 4: HOJA COMERCIAL Y GUION PARA EL NEGOCIO (A4) */}
        {(activeTab === 'all' || activeTab === 'guide') && (
          <section className="print:break-after-page flex flex-col items-center">
            <div className="print:hidden w-full flex items-center justify-between pb-3 mb-4 border-b border-zinc-800 text-xs text-zinc-400 font-mono">
              <span className="font-bold text-white uppercase tracking-wider">Pieza 4 · Hoja de Operación & Argumentario para el Dueño / Personal (Formato A4)</span>
              <span>Medidas: 210mm × 297mm (Documento interno del negocio)</span>
            </div>

            <div className="w-full max-w-3xl bg-white text-zinc-900 rounded-3xl p-10 md:p-12 border border-zinc-200 shadow-xl print:p-8 print:border-none">
              
              {/* Header Hoja con Co-Branding de Afiliado */}
              <div className="flex items-center justify-between pb-6 border-b border-zinc-200 gap-4">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo_conejo_blk.png" alt="Rabbitty" className="w-10 h-10 object-contain" />
                  <div>
                    <h2 className="text-xl font-black text-black tracking-tight">RABBITTY FOR BUSINESS</h2>
                    <p className="text-xs text-zinc-500 font-mono">Guía de Lanzamiento Piloto · {businessName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {renderAffiliateBadge('md', false)}
                  <span className="text-xs font-bold text-pink-600 bg-pink-50 px-3 py-1 rounded-full border border-pink-200 shrink-0">
                    Octubre 2026
                  </span>
                </div>
              </div>

              {/* Guion Adaptado al Nicho para el Personal */}
              <div className="mt-8">
                <h3 className="text-sm font-black uppercase tracking-wider text-pink-600 flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-4 h-4" /> {currentTemplate.guideStaffTitle}
                </h3>
                <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 space-y-3 text-sm">
                  <p className="text-zinc-800 font-medium">
                    <strong className="text-black">Al cobrar o entregar el servicio / producto:</strong> <br />
                    <em>{currentTemplate.guideScriptGreeting}</em>
                  </p>
                  <p className="text-zinc-800 font-medium">
                    <strong className="text-black">Si el cliente pregunta cómo funciona:</strong> <br />
                    <em>{currentTemplate.guideScriptExplain}</em>
                  </p>
                </div>
              </div>

              {/* Parámetros Acordados del Piloto */}
              <div className="mt-8">
                <h3 className="text-sm font-black uppercase tracking-wider text-zinc-900 flex items-center gap-2 mb-3">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" /> Parámetros del Piloto Controlado
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/50">
                    <span className="text-[10px] font-mono text-zinc-500 font-bold uppercase block">Bono Bienvenida</span>
                    <span className="text-xl font-black text-black">{welcomeBonusActive && bunzNum >= 5 ? `$${welcomeBunz} Bunz` : '—'}</span>
                    <span className="text-[11px] text-zinc-500 block mt-0.5">{welcomeBonusActive && bunzNum >= 5 ? `(= $${welcomeBunz} MXN)` : 'Promoción inactiva'}</span>
                  </div>
                  <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/50">
                    <span className="text-[10px] font-mono text-zinc-500 font-bold uppercase block">Nicho Seleccionado</span>
                    <span className="text-base font-black text-black">{currentTemplate.label.split('/')[0]}</span>
                    <span className="text-[11px] text-zinc-500 block mt-0.5">Identidad protegida</span>
                  </div>
                  <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/50">
                    <span className="text-[10px] font-mono text-zinc-500 font-bold uppercase block">Integridad Financiera</span>
                    <span className="text-base font-black text-emerald-700">Ledger Inmutable</span>
                    <span className="text-[11px] text-zinc-500 block mt-0.5">Anti-doble canje criptográfico</span>
                  </div>
                </div>
              </div>

              {/* Qué Métricas Recibirá el Dueño */}
              <div className="mt-8">
                <h3 className="text-sm font-black uppercase tracking-wider text-zinc-900 mb-3">
                  Métricas de Retorno que Rabbitty Entregará a {businessName}
                </h3>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-700">
                  <li className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 border border-zinc-100">
                    <ArrowRight className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                    <span>Total de escaneos únicos captados en mesa y caja.</span>
                  </li>
                  <li className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 border border-zinc-100">
                    <ArrowRight className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                    <span>Clientes nuevos registrados y activados en el local.</span>
                  </li>
                  <li className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 border border-zinc-100">
                    <ArrowRight className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                    <span>Bunz emitidos vs Bunz efectivamente canjeados.</span>
                  </li>
                  <li className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 border border-zinc-100">
                    <ArrowRight className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                    <span>Tasa de retorno de clientes durante las siguientes semanas.</span>
                  </li>
                </ul>
              </div>

              {/* Firma y Contacto */}
              <div className="mt-8 pt-6 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
                <span>Rabbitty Network · Soporte en Vivo: contacto@rabbitty.me</span>
                <span className="font-mono text-[11px]">Identidad de Marca Oficial Rabbitty © 2026</span>
              </div>

            </div>
          </section>
        )}

      </main>

      {/* ESTILOS DE IMPRESIÓN DEDICADOS */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 0;
            size: auto;
          }
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}

export default function ImpresosPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#09090B] text-white flex items-center justify-center font-mono text-sm">Cargando kit de impresión...</div>}>
      <ImpresosContent />
    </Suspense>
  );
}
