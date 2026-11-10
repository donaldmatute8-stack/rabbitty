'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  MapPin,
  Clock,
  Tag,
  Navigation,
  Globe,
  MessageCircle,
  Sparkles,
  Utensils,
  QrCode,
  Share2,
  Layers,
  Heart,
  ChevronRight,
} from 'lucide-react';
import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import Image from 'next/image';
import BottomNav from '@/components/BottomNav';
import { useToast } from '@/contexts/ToastContext';
import { PlatformBridge } from '@/lib/platform';
import MembershipMarketplace from '@/features/memberships/Marketplace';
import { parseGallery, resolveBusinessCover } from '@/lib/businessCover';
import { MoodCheckInSheet } from '@/components/mood/MoodCheckInSheet';
import { DigitalMenuCatalog, CatalogCategory } from '@/components/affiliate/DigitalMenuCatalog';
import { TableContextSheet } from '@/components/affiliate/TableContextSheet';
import { TableBillSheet } from '@/components/affiliate/TableBillSheet';
import { Receipt } from 'lucide-react';
import { OrderTrackSheet } from '@/components/affiliate/OrderTrackingCard';
import type { TrackedOrder } from '@/lib/useOrderTracking';
import { OrderCartSheet, CartItem } from '@/components/affiliate/OrderCartSheet';
import { CatalogItem, CatalogModifier } from '@/components/affiliate/ProductDetailModal';

interface AffiliateData {
  id: string;
  name: string;
  category: string;
  address: string;
  distance?: string;
  startTime?: string;
  endTime?: string;
  activeDays?: string;
  timezone?: string;
  rewardPercentage: number;
  description?: string;
  gallery?: string;
  coverImageUrl?: string;
  website?: string;
  webUrl?: string;
  supportWhatsApp?: string;
  phone?: string;
  lat?: number | string;
  lng?: number | string;
  givesBunz?: boolean;
  acceptsBunz?: boolean;
  owner?: { phoneNumber?: string };
}

// ── Horario real del negocio (activeDays ISO 1=Lun…7=Dom + startTime/endTime) ──
// La app antes decía "Abierto Hoy" con punto verde siempre, sin mirar la config.
function toMinutes(hhmm?: string): number {
  const [h, m] = (hhmm || '00:00').split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function resolveOpenState(
  activeDaysRaw?: string,
  startTime?: string,
  endTime?: string,
  timezone?: string,
): { openNow: boolean; days: number[]; opens: number; closes: number } {
  let days: number[] = [1, 2, 3, 4, 5, 6, 7];
  try {
    const parsed = JSON.parse(activeDaysRaw || '[]');
    if (Array.isArray(parsed) && parsed.length > 0) days = parsed.map(Number);
  } catch { /* default: todos los días */ }

  const tz = timezone || 'America/Mexico_City';
  let day = 1;
  let minutes = 0;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour12: false, weekday: 'short', hour: '2-digit', minute: '2-digit',
    }).formatToParts(new Date());
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
    day = map[get('weekday')] ?? 1;
    minutes = (Number(get('hour')) % 24) * 60 + Number(get('minute'));
  } catch { /* sin Intl: se evalúa con la hora local del device */ }

  const opens = toMinutes(startTime);
  const closes = toMinutes(endTime);
  const overnight = closes <= opens; // 22:00 → 02:00
  const activeToday = days.includes(day);
  const activeYesterday = days.includes(day === 1 ? 7 : day - 1);

  const openNow = overnight
    ? (activeToday && minutes >= opens) || (activeYesterday && minutes < closes)
    : activeToday && minutes >= opens && minutes < closes;

  return { openNow, days, opens, closes };
}

interface BusinessResponse {
  business: AffiliateData;
  restaurant?: { id: string; name: string; currency?: string } | null;
  primaryBranch?: { id: string; name: string } | null;
  categories: CatalogCategory[];
  tables: Array<{ id: string; number: number; capacity?: number; location?: string | null; qrCode?: string | null }>;
  capabilities: {
    menuEnabled: boolean;
    digitalOrderingEnabled: boolean;
    tableServiceEnabled: boolean;
    reservationsEnabled: boolean;
    appointmentBookingEnabled: boolean;
    loyaltyEnabled: boolean;
    moodEnabled: boolean;
  };
}

function AffiliateProfileContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string;
  const { showToast } = useToast();

  const [affiliate, setAffiliate] = useState<AffiliateData | null>(null);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [tables, setTables] = useState<Array<{ id: string; number: number; capacity?: number; location?: string | null; qrCode?: string | null }>>([]);
  const [capabilities, setCapabilities] = useState<BusinessResponse['capabilities']>({
    menuEnabled: true,
    digitalOrderingEnabled: true,
    tableServiceEnabled: false,
    reservationsEnabled: true,
    appointmentBookingEnabled: false,
    loyaltyEnabled: true,
    moodEnabled: true,
  });

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'menu' | 'info'>('menu');
  const [membershipPlans, setMembershipPlans] = useState<{ planId: string; planName: string; planDescription?: string | null; versionId: string; priceFiat: number; currency: string; billingInterval: string; alreadySubscribed: boolean }[]>([]);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  // H-PRESYNC · Voy: igual criterio que "Estoy aquí" — se hidrata del server
  // (PLAN_VISIT reciente en business_interactions, ventana antispam 12h).
  const [planVisitSent, setPlanVisitSent] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  // Initialize table number from searchParams safely without calling setState in render or synchronous effect
  const initialTableParam = searchParams.get('table');
  const initialTableNum = useMemo(() => {
    if (!initialTableParam) return null;
    const n = parseInt(initialTableParam, 10);
    return isNaN(n) ? null : n;
  }, [initialTableParam]);

  // Table QR context
  const [tableNumber, setTableNumber] = useState<number | null>(initialTableNum);
  const [tableId, setTableId] = useState<string | null>(null);
  const [showTableSheet, setShowTableSheet] = useState(false);
  // Fase C: hoja de cuenta del comensal (consumo en la mesa reclamada)
  const [showBillSheet, setShowBillSheet] = useState(false);

  // Cart & Ordering
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCartSheet, setShowCartSheet] = useState(false);
  /** Pedido en rampa: 5 s para arrepentirse antes de tocar el POS. */
  const [pendingPosOrder, setPendingPosOrder] = useState<{
    orderType: 'DINE_IN' | 'PICKUP' | 'DELIVERY';
    address?: string;
    payload: Record<string, unknown>;
    items: Array<{ name: string; quantity: number }>;
    total: number;
  } | null>(null);
  const [sentOrder, setSentOrder] = useState<{
    orderType: 'DINE_IN' | 'PICKUP' | 'DELIVERY';
    address?: string;
    items: Array<{ name: string; quantity: number }>;
    total: number;
  } | null>(null);
  const pendingPosOrderTimerRef = useRef<number | null>(null);

  // Modals
  const [showMapSelector, setShowMapSelector] = useState(false);
  const [showInAppBrowser, setShowInAppBrowser] = useState(false);
  const [showMessageSelector, setShowMessageSelector] = useState(false);
  const [showMoodCheckIn, setShowMoodCheckIn] = useState(false);
  const [checkingInPresence, setCheckingInPresence] = useState(false);
  // H-PRESYNC: el estado se hidrata del SERVER (sesión abierta / check-in de hoy en
  // ledger), nunca solo de useState local — si confirmaste en el modal de proximidad
  // u otro flujo, este botón lo refleja al entrar (y en vivo vía evento 'rabbitty:presence-confirmed').
  const [hasPresenceCheckedIn, setHasPresenceCheckedIn] = useState(false);

  // H-TRACK-LOCAL: si el Rabbitter tiene un pedido en curso EN ESTE negocio, el
  // botón "Estoy Aquí" cambia de estado (rojo · "Pedido en Curso") y abre el
  // seguimiento con el MISMO sheet del home.
  const [activeOrder, setActiveOrder] = useState<TrackedOrder | null>(null);
  const [trackOpenId, setTrackOpenId] = useState<string | null>(null);

  // Header scroll & Bottom Nav visibility synchronization
  const [isScrolled, setIsScrolled] = useState(false);
  const [isNavVisible, setIsNavVisible] = useState(true);
  const lastScrollY = useRef(0);
  const accumulatedDelta = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      setIsScrolled(currentScrollY > 150);

      const diff = currentScrollY - lastScrollY.current;

      // Al inicio de la pantalla siempre visible
      if (currentScrollY < 60) {
        setIsNavVisible(true);
        accumulatedDelta.current = 0;
        lastScrollY.current = currentScrollY;
        return;
      }

      // Detectar dirección de scroll
      if (diff > 8) {
        // Scroll hacia ABAJO -> Ocultar BottomNav y empujar el botón de escanear hacia el fondo
        accumulatedDelta.current += diff;
        if (accumulatedDelta.current > 25) {
          setIsNavVisible(false);
          accumulatedDelta.current = 0;
        }
      } else if (diff < -5) {
        // Scroll hacia ARRIBA -> Reaparecer BottomNav y subir el botón
        accumulatedDelta.current = 0;
        setIsNavVisible(true);
      }

      lastScrollY.current = Math.max(0, currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    if (!id) return;

    fetch(`/api/business/${id}`)
      .then(res => res.json())
      .then((data: { success: boolean } & BusinessResponse) => {
        if (data.success && data.business) {
          setAffiliate(data.business);
          setCategories(data.categories || []);
          setTables(data.tables || []);
          if (data.capabilities) setCapabilities(data.capabilities);

          // If initialTableNum exists, resolve its tableId
          if (data.tables && initialTableNum !== null) {
            const matched = data.tables.find(t => t.number === initialTableNum);
            if (matched) setTableId(matched.id);
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id, initialTableNum]);

  // H-TRACK-LOCAL: pedido en curso de ESTE negocio (mismo endpoint del home).
  // Polling 15s + al volver a foreground, igual que useOrderTracking.
  useEffect(() => {
    if (!affiliate?.id) return;
    let cancelled = false;
    const load = async () => {
      try {
        const headers = await PlatformBridge.getAuthHeaders();
        if (!headers?.Authorization && !headers?.['X-Init-Data']) return;
        const res = await fetch('/api/orders/active', { headers, cache: 'no-store' });
        const data = await res.json().catch(() => null);
        if (cancelled || !data?.success || !Array.isArray(data.orders)) return;
        const mine = (data.orders as TrackedOrder[]).find((o) => o.businessId === affiliate.id) ?? null;
        setActiveOrder(mine);
      } catch { /* best-effort */ }
    };
    void load();
    const iv = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 15_000);
    const onVisible = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(iv);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [affiliate?.id]);

  // H-PRESYNC: hidratar "Estoy aquí" del SERVER al entrar (el estado real vive en
  // presenceSessions/ledger, no en useState local) + sync en vivo cuando otro
  // flujo (modal de proximidad, etc.) confirma presencia para este negocio.
  useEffect(() => {
    if (!affiliate?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const headers = await PlatformBridge.getAuthHeaders();
        if (!headers?.Authorization && !headers?.['X-Init-Data']) return;
        const res = await fetch(`/api/location/presence?businessId=${affiliate.id}`, { headers });
        const data = await res.json().catch(() => null);
        if (!cancelled && data?.success) {
          setHasPresenceCheckedIn(Boolean(data.active));
          setPlanVisitSent(Boolean(data.planVisitRecent));
        }
      } catch { /* best-effort: sin conexión se conserva el estado local */ }
    })();
    const onPresenceConfirmed = (e: Event) => {
      const bizId = (e as CustomEvent<{ businessId?: string }>).detail?.businessId;
      if (bizId && bizId === affiliate.id) setHasPresenceCheckedIn(true);
    };
    window.addEventListener('rabbitty:presence-confirmed', onPresenceConfirmed);
    return () => {
      cancelled = true;
      window.removeEventListener('rabbitty:presence-confirmed', onPresenceConfirmed);
    };
  }, [affiliate?.id]);

  const handleAddToCart = (
    item: CatalogItem,
    quantity: number,
    modifiers: CatalogModifier[],
    notes: string
  ) => {
    PlatformBridge.hapticFeedback('light');
    const cartItemId = `${item.id}-${modifiers.map(m => m.id).sort().join('_')}-${notes.trim()}`;

    setCart(prev => {
      const existingIndex = prev.findIndex(ci => ci.id === cartItemId);
      if (existingIndex > -1) {
        const copy = [...prev];
        copy[existingIndex].quantity += quantity;
        return copy;
      }
      return [
        ...prev,
        {
          id: cartItemId,
          menuItemId: item.id,
          name: item.name,
          price: item.price,
          quantity,
          modifiers,
          notes: notes.trim() || undefined,
        },
      ];
    });

    showToast(`Agregaste ${quantity}x ${item.name} a tu pedido`, 'success');
  };

  const handleRemoveFromCart = (cartItemId: string) => {
    PlatformBridge.hapticFeedback('light');
    setCart(prev => prev.filter(item => item.id !== cartItemId));
  };

  const handleUpdateQuantity = (cartItemId: string, delta: number) => {
    PlatformBridge.hapticFeedback('light');
    setCart(prev =>
      prev
        .map(item => {
          if (item.id === cartItemId) {
            const newQ = item.quantity + delta;
            return newQ > 0 ? { ...item, quantity: newQ } : null;
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null)
    );
  };

  const dispatchPosOrder = async (order: {
    payload: Record<string, unknown>;
    orderType: 'DINE_IN' | 'PICKUP' | 'DELIVERY';
    address?: string;
    items: Array<{ name: string; quantity: number }>;
    total: number;
  }) => {
    try {
      // Fase C: headers de auth → la orden queda con customerId y se acumula
      // en el Tab abierto de la mesa que reclame (ya no una orden anónima nueva).
      const authHeaders = await PlatformBridge.getAuthHeaders().catch(() => null);
      const res = await fetch('/api/pos/checkout', {
        method: 'POST',
        headers: { ...(authHeaders || {}), 'Content-Type': 'application/json' },
        body: JSON.stringify(order.payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Error al enviar orden', 'error');
        return;
      }
      setCart([]);
      PlatformBridge.hapticFeedback('success');
      setSentOrder(order);
      window.setTimeout(() => setSentOrder(null), 2800);
      showToast('¡Orden enviada a cocina / personal con éxito!', 'success');
    } catch {
      showToast('Error al enviar orden', 'error');
    }
  };

  const cancelPendingPosOrder = () => {
    if (pendingPosOrderTimerRef.current) {
      clearTimeout(pendingPosOrderTimerRef.current);
      pendingPosOrderTimerRef.current = null;
    }
    setPendingPosOrder(null);
    setCart([]);
    PlatformBridge.hapticFeedback('light');
    showToast('Pedido cancelado', 'info');
  };

  const modifyPendingPosOrder = () => {
    if (pendingPosOrderTimerRef.current) {
      clearTimeout(pendingPosOrderTimerRef.current);
      pendingPosOrderTimerRef.current = null;
    }
    setPendingPosOrder(null);
    setShowCartSheet(true);
  };

  const handleSubmitOrder = async (
    orderType: 'DINE_IN' | 'PICKUP' | 'DELIVERY',
    address?: { text: string; data: Record<string, unknown> },
  ) => {
    PlatformBridge.hapticFeedback('heavy');

    const payload = {
      orderType,
      deliveryAddress: orderType === 'DELIVERY' ? address?.text ?? null : null,
      deliveryAddressData: orderType === 'DELIVERY' ? address?.data ?? null : null,
      // Sin mesa elegida el pedido puede salir "producto solo" — el POS la
      // vincula a mesa después si procede. branchId permite crear la orden
      // cuando no hay mesa (el id del perfil afiliado ES la branch).
      tableId: tableId || null,
      branchId: affiliate?.id || null,
      items: cart.map(item => ({
        id: item.menuItemId,
        price: item.price,
        quantity: item.quantity,
        notes: item.notes || null,
      })),
      paymentMethod: 'CASH',
    };

    // El pedido sale solo tras la barra de 5 s, con la tarjeta inferior para
    // cancelar o modificar (misma identidad que la tarjeta de pedido).
    const order = {
      orderType,
      address: address?.text,
      payload,
      items: cart.map((item) => ({ name: item.name, quantity: item.quantity })),
      total: cart.reduce((acc, item) => {
        const mods = (item.modifiers || []).reduce((m, mod) => m + (Number(mod.priceAdjust) || 0), 0);
        return acc + (item.price + mods) * item.quantity;
      }, 0),
    };
    setShowCartSheet(false);
    setPendingPosOrder(order);
    if (pendingPosOrderTimerRef.current) clearTimeout(pendingPosOrderTimerRef.current);
    pendingPosOrderTimerRef.current = window.setTimeout(() => {
      pendingPosOrderTimerRef.current = null;
      setPendingPosOrder(null);
      void dispatchPosOrder(order);
    }, 5000);
  };

  const totalCartCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  if (loading) {
    return (
      <div className="bg-[#0D0D15] min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-3 border-white/10 border-t-[#E91E63] animate-spin" />
      </div>
    );
  }

  if (!affiliate) {
    return (
      <div className="bg-[#0D0D15] min-h-screen flex items-center justify-center text-white/50 font-semibold">
        Negocio no encontrado.
      </div>
    );
  }

  const parsedGallery = parseGallery(affiliate.gallery);
  const coverImage = resolveBusinessCover({
    id: affiliate.id,
    gallery: affiliate.gallery,
    category: affiliate.category,
    coverImageUrl: affiliate.coverImageUrl,
  });

  const targetWebsite = affiliate.website || affiliate.webUrl || 'https://rabbitty.me';
  const formattedWebUrl = targetWebsite.startsWith('http')
    ? targetWebsite
    : `https://${targetWebsite}`;

  // Horario real (días + horas configurados en el admin), no un texto fijo.
  const openState = resolveOpenState(
    affiliate.activeDays,
    affiliate.startTime,
    affiliate.endTime,
    affiliate.timezone,
  );
  const openNow = openState.openNow;
  const activeDayLabels =
    openState.days.length === 7
      ? 'Todos los días'
      : openState.days
          .slice()
          .sort((a, b) => a - b)
          .map((d) => ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][d - 1] ?? '')
          .filter(Boolean)
          .join(' · ');

  return (
    <div className="bg-[#0D0D15] min-h-screen pb-36 relative text-white">
      {/* Floating Dynamic Header */}
      <div 
        className={`fixed top-0 left-0 right-0 z-50 pt-[calc(max(var(--safe-top,0px),env(safe-area-inset-top,0px))+8px)] pb-3 px-4 flex items-center justify-between transition-all duration-200 ${
          isScrolled 
            ? 'bg-[#0D0D15]/95 backdrop-blur-xl border-b border-white/10 shadow-lg pointer-events-auto' 
            : 'pointer-events-none'
        }`}
      >
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-full bg-[#14141A]/80 text-white flex items-center justify-center border border-white/15 backdrop-blur-xl shadow-xl pointer-events-auto active:scale-90 transition-transform shrink-0"
          aria-label="Volver atrás"
        >
          <ChevronLeft size={20} />
        </button>

        {/* Central Floating Pill (Header Top) */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/15 bg-[#14141A]/85 backdrop-blur-xl shadow-xl pointer-events-auto max-w-[62%] sm:max-w-none">
          <h1 className="text-xs sm:text-sm font-black tracking-tight text-white truncate m-0 max-w-[28vw] sm:max-w-[200px]">
            {affiliate.name}
          </h1>
          {affiliate.category && (
            <>
              <span className="w-1 h-1 rounded-full bg-white/30 shrink-0" />
              <span className="text-[9px] sm:text-[10px] font-black text-[#E91E63] uppercase tracking-wider truncate max-w-[18vw] sm:max-w-[120px]">
                {affiliate.category}
              </span>
            </>
          )}
          {affiliate.startTime && affiliate.endTime && (
            <>
              <span className="w-1 h-1 rounded-full bg-white/30 shrink-0" />
              <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-gray-300 shrink-0">
                <Clock size={10} className="text-gray-400" />
                <span>{affiliate.startTime}–{affiliate.endTime}</span>
              </span>
            </>
          )}
          <span className={`shrink-0 text-[8px] sm:text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
            openNow
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              : 'bg-red-500/15 text-red-400 border border-red-500/30'
          }`}>
            {openNow ? 'Abierto' : 'Cerrado'}
          </span>
        </div>

        {/* Top Right Quick Actions (Share + Favorite) */}
        <div className="flex items-center gap-2 pointer-events-auto shrink-0">
          <button
            onClick={() => {
              PlatformBridge.hapticFeedback('light');
              setIsFavorite(!isFavorite);
              showToast(isFavorite ? 'Eliminado de favoritos' : '¡Guardado en tus favoritos!', 'success');
            }}
            className="w-10 h-10 rounded-full bg-[#14141A]/80 text-white flex items-center justify-center border border-white/15 backdrop-blur-xl shadow-xl active:scale-90 transition-transform"
            aria-label="Favorito"
          >
            <Heart size={16} className={isFavorite ? 'fill-[#E91E63] text-[#E91E63]' : 'text-white/80'} />
          </button>
          <button
            onClick={async () => {
              PlatformBridge.hapticFeedback('light');
              if (navigator.share) {
                try {
                  await navigator.share({
                    title: affiliate.name,
                    text: `Descubre ${affiliate.name} en Rabbitty y acumula Bunz en cada consumo`,
                    url: window.location.href,
                  });
                } catch {
                  /* user cancel */
                }
              } else {
                navigator.clipboard.writeText(window.location.href);
                showToast('Enlace de la sucursal copiado', 'info');
              }
            }}
            className="w-10 h-10 rounded-full bg-[#14141A]/80 text-white flex items-center justify-center border border-white/15 backdrop-blur-xl shadow-xl active:scale-90 transition-transform"
            aria-label="Compartir"
          >
            <Share2 size={16} />
          </button>
        </div>
      </div>

      {/* Hero Cover Image */}
      <div className="relative w-full h-80 bg-black">
        <Image
          src={coverImage}
          alt={affiliate.name}
          fill
          unoptimized
          priority
          className="object-cover opacity-85"
        />
        <div className="absolute inset-0 bg-linear-to-t from-[#0D0D15] via-transparent to-black/50" />

        {/* Floating Top Badges (Bunz Reward + Check-in + Mesa) */}
        <div className="absolute bottom-10 left-5 right-5 z-20 flex items-center justify-between gap-2 pointer-events-auto">
          {/* Left Badges: Check-in & Table */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Botón Estoy Aquí / Check-in — o "Pedido en Curso" si hay un
                pedido activo en ESTE negocio (H-TRACK-LOCAL): al tocarlo abre
                el mismo seguimiento del home. */}
            {activeOrder ? (
              <motion.button
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', delay: 0.1 }}
                type="button"
                onClick={() => {
                  PlatformBridge.hapticFeedback('medium');
                  setTrackOpenId(activeOrder.orderId);
                }}
                className="h-9 px-3.5 rounded-full flex items-center gap-2 text-xs font-black shadow-lg border backdrop-blur-xl transition-all active:scale-95 cursor-pointer bg-red-500/95 text-white border-red-300/50 shadow-[0_4px_16px_rgba(239,68,68,0.45)]"
                aria-label="Pedido en curso. Abrir seguimiento"
                title="Pedido en curso"
              >
                <span className="inline-block w-2 h-2 rounded-full bg-white animate-pulse" />
                <span>Pedido en Curso</span>
              </motion.button>
            ) : (
              <motion.button
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', delay: 0.1 }}
                type="button"
                disabled={checkingInPresence || hasPresenceCheckedIn}
                onClick={async () => {
                  if (checkingInPresence || hasPresenceCheckedIn) return;
                  setCheckingInPresence(true);
                  PlatformBridge.hapticFeedback('medium');
                  try {
                    const headers = await PlatformBridge.getAuthHeaders();
                    const res = await fetch('/api/location/confirm-presence', {
                      method: 'POST',
                      headers: { ...headers, 'Content-Type': 'application/json' },
                      body: JSON.stringify({ businessId: affiliate.id }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (res.ok && data?.success !== false) {
                      setHasPresenceCheckedIn(true);
                      PlatformBridge.hapticFeedback('success');
                      showToast(`📍 ¡Check-in en ${affiliate.name} confirmado! El comercio te ve en caja.`, 'success');
                    } else {
                      PlatformBridge.hapticFeedback('error');
                      showToast(data?.error || 'No se pudo registrar el check-in', 'error');
                    }
                  } catch {
                    PlatformBridge.hapticFeedback('error');
                    showToast('Error de conexión al registrar check-in', 'error');
                  } finally {
                    setCheckingInPresence(false);
                  }
                }}
                className={`h-9 px-3.5 rounded-full flex items-center gap-2 text-xs font-black shadow-lg border backdrop-blur-xl transition-all active:scale-95 cursor-pointer ${
                  hasPresenceCheckedIn
                    ? 'bg-emerald-500/90 text-white border-emerald-400/40 shadow-[0_4px_16px_rgba(16,185,129,0.35)]'
                    : 'bg-black/65 hover:bg-black/85 text-white border-white/20 hover:border-pink-500/60 shadow-[0_4px_16px_rgba(0,0,0,0.5)]'
                }`}
              >
                <span className={`inline-block w-2 h-2 rounded-full ${hasPresenceCheckedIn ? 'bg-white' : 'bg-[#E91E63] animate-ping'}`} />
                <span>{hasPresenceCheckedIn ? '✓ Estoy Aquí' : checkingInPresence ? 'Activando...' : 'Estoy Aquí'}</span>
              </motion.button>
            )}

            {/* Table indicator badge if seated */}
            {tableNumber && (
              <button
                onClick={() => setShowTableSheet(true)}
                className="h-9 px-3.5 bg-gradient-to-r from-purple-600/90 to-indigo-600/90 backdrop-blur-xl text-white rounded-full flex items-center gap-1.5 text-xs font-black shadow-[0_4px_16px_rgba(147,51,234,0.35)] border border-purple-400/40 active:scale-95 transition-transform cursor-pointer"
              >
                <Utensils size={13} className="text-purple-200" />
                <span>Mesa #{tableNumber}</span>
              </button>
            )}
          </div>

          {/* Right Badge: Bunz Reward */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', delay: 0.15 }}
            className="h-9 bg-linear-to-r from-[#E91E63] to-[#AD1457] text-white px-3.5 rounded-full flex items-center gap-1.5 shadow-[0_4px_16px_rgba(233,30,99,0.35)] border border-white/25 shrink-0"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span className="font-black text-sm">+{affiliate.rewardPercentage}%</span>
            <span className="font-bold text-[10px] opacity-90 tracking-wide">BUNZ</span>
          </motion.div>
        </div>
      </div>

      {/* Content Container (Card Overlap) */}
      <div className="relative bg-[#0D0D15] rounded-t-[36px] -mt-8 px-5 pt-6 pb-20 border-t border-white/10 shadow-2xl space-y-5">
        {/* Action Quick Links (Llegar, Mood, Mesa, Mensaje) Rediseñados */}
        <div className="grid grid-cols-4 gap-2 py-2 px-2 bg-white/[0.03] border border-white/10 rounded-2xl backdrop-blur-xl shadow-lg">
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={() => {
              PlatformBridge.hapticFeedback('medium');
              // 1era opción automática: abre nuestro mapa interactivo
              router.push(`/?tab=Freehands&affiliate=${affiliate.id}`);
            }}
            className="flex flex-col items-center gap-1.5 py-1.5 px-1 rounded-xl transition-all hover:bg-white/5 active:opacity-80 border-none bg-transparent cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-[#E91E63]/15 text-[#FF2E93] border border-[#E91E63]/30 flex items-center justify-center shadow-sm">
              <Navigation size={18} />
            </div>
            <span className="text-[10px] font-black text-white/90 tracking-tight">Llegar</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={() => {
              PlatformBridge.hapticFeedback('medium');
              setShowMoodCheckIn(true);
            }}
            className="flex flex-col items-center gap-1.5 py-1.5 px-1 rounded-xl transition-all hover:bg-white/5 active:opacity-80 border-none bg-transparent cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center shadow-sm">
              <Sparkles size={18} />
            </div>
            <span className="text-[10px] font-black text-amber-400 tracking-tight">Mood</span>
          </motion.button>

          {capabilities.tableServiceEnabled && tables.length > 0 ? (
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={() => setShowTableSheet(true)}
              className="flex flex-col items-center gap-1.5 py-1.5 px-1 rounded-xl transition-all hover:bg-white/5 active:opacity-80 border-none bg-transparent cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center justify-center shadow-sm">
                <QrCode size={18} />
              </div>
              <span className="text-[10px] font-black text-white/90 tracking-tight">
                {tableNumber ? `#${tableNumber}` : 'Mesa'}
              </span>
            </motion.button>
          ) : (
            <div className="flex flex-col items-center gap-1.5 py-1.5 px-1 opacity-30 pointer-events-none">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-500">
                <QrCode size={18} />
              </div>
              <span className="text-[10px] font-bold text-gray-500">Mesa</span>
            </div>
          )}

          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={() => setShowMessageSelector(true)}
            className="flex flex-col items-center gap-1.5 py-1.5 px-1 rounded-xl transition-all hover:bg-white/5 active:opacity-80 border-none bg-transparent cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-orange-500/15 text-orange-400 border border-orange-500/30 flex items-center justify-center shadow-sm">
              <MessageCircle size={18} />
            </div>
            <span className="text-[10px] font-black text-white/90 tracking-tight">Mensaje</span>
          </motion.button>
        </div>

        {/* Interactive Segmented Experience Tabs */}
        <div className="sticky top-[calc(max(var(--safe-top,0px),env(safe-area-inset-top,0px))+56px)] z-30 -mx-1 px-1 py-1 bg-[#0D0D15]/95 backdrop-blur-xl">
          <div className="grid grid-cols-2 p-1 bg-[#161622] rounded-2xl border border-white/10 shadow-lg">
            <button
              onClick={() => {
                PlatformBridge.hapticFeedback('light');
                setActiveTab('menu');
              }}
              className={`py-2.5 rounded-xl text-xs font-black tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'menu'
                  ? 'bg-gradient-to-r from-[#FF2E93] to-[#E91E63] text-white shadow-md shadow-[#E91E63]/30'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Utensils size={15} />
              <span>Menú y Servicios</span>
            </button>
            <button
              onClick={() => {
                PlatformBridge.hapticFeedback('light');
                setActiveTab('info');
              }}
              className={`py-2.5 rounded-xl text-xs font-black tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'info'
                  ? 'bg-gradient-to-r from-[#FF2E93] to-[#E91E63] text-white shadow-md shadow-[#E91E63]/30'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Layers size={15} />
              <span>Sucursal</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Menú y Catálogo Estructurado */}
        {activeTab === 'menu' && (
          <div className="space-y-6">
            <DigitalMenuCatalog
              categories={categories}
              currency="MXN"
              rewardPercentage={affiliate.rewardPercentage}
              onAddToCart={handleAddToCart}
              digitalOrderingEnabled={capabilities.digitalOrderingEnabled}
            />
          </div>
        )}

        {/* Tab 2: Sucursal, Ubicación, Happy Hour & Galería */}
        {/* ── "Planeo ir": acciona la proximidad y avisa al comercio ──
            H-PRESYNC: se oculta si ya estás checkeado (no puedes "planeo ir"
            cuando ya te registraste aquí), y muestra tu estado hidratado. */}
        <div className="rounded-2xl p-4 flex items-center justify-between gap-3" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="min-w-0">
            {hasPresenceCheckedIn ? (
              <>
                <p className="text-white font-bold text-sm">✓ Ya estás aquí</p>
                <p className="text-white/50 text-xs mt-0.5">Tu check-in está activo en este local</p>
              </>
            ) : (
              <>
                <p className="text-white font-bold text-sm">📍 Estoy cerca, planeo ir</p>
                <p className="text-white/50 text-xs mt-0.5">Avisa al comercio y te reciben con tu oferta lista</p>
              </>
            )}
          </div>
          {hasPresenceCheckedIn ? (
            <div
              className="shrink-0 px-4 py-2.5 rounded-full text-xs font-bold flex items-center gap-1.5"
              style={{ background: 'rgba(16,185,129,0.15)', color: '#34D399', border: '1px solid rgba(52,211,153,0.4)' }}
            >
              <span>Check-in activo</span>
            </div>
          ) : (
            <button
              onClick={async () => {
                try {
                  PlatformBridge.hapticFeedback('light');
                  const headers = await PlatformBridge.getAuthHeaders();
                  const res = await fetch('/api/location/plan-visit', {
                    method: 'POST',
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ businessId: id }),
                  });
                  const data = await res.json();
                  showToast(data?.message || (data?.error || 'Listo'), data?.success ? 'success' : 'info');
                  setPlanVisitSent(true);
                } catch { showToast('No se pudo enviar', 'error'); }
              }}
              disabled={planVisitSent}
              className="shrink-0 px-4 py-2.5 rounded-full text-xs font-bold active:scale-95 transition-transform cursor-pointer"
              style={{
                background: planVisitSent ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg, #8B5CF6 0%, #A855F7 100%)',
                color: planVisitSent ? 'rgba(255,255,255,0.4)' : '#FFF',
              }}
            >
              {planVisitSent ? '✓ Avisado' : 'Voy'}
            </button>
          )}
        </div>

        {/* ── Membresías del negocio (marketplace compacto) ── */}
        <MembershipMarketplace businessId={id} compact />

        {activeTab === 'info' && (
          <div className="space-y-5">
            {/* Happy Hour Bunz Highlight */}
            <div className="p-4 bg-linear-to-br from-[#E91E63]/15 to-[#AD1457]/10 rounded-3xl border border-[#E91E63]/25 space-y-2">
              <h4 className="text-sm font-black text-[#FF4081] flex items-center gap-2">
                <Tag size={16} /> Recompensa Bunz
              </h4>
              <p className="text-xs text-white/75 leading-relaxed">
                Escanea tu ticket de compra durante el horario oficial ({affiliate.startTime} a {affiliate.endTime}) para recibir <strong>+{affiliate.rewardPercentage}% Bunz</strong> en cada consumo.
              </p>
            </div>

            {/* Address & Hours card */}
            <div className="bg-[#161622] rounded-3xl p-5 border border-white/10 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-[#E91E63] shrink-0">
                  <MapPin size={18} />
                </div>
                <div>
                  <p className="font-bold text-sm text-white">{affiliate.address}</p>
                  {affiliate.distance && (
                    <p className="text-xs text-white/50 mt-0.5">A {affiliate.distance} de ti</p>
                  )}
                </div>
              </div>

              <div className="h-px bg-white/5" />

              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0 ${openNow ? 'text-emerald-400' : 'text-white/40'}`}>
                  <Clock size={18} />
                </div>
                <div>
                  <p className="font-bold text-sm text-white flex items-center gap-2">
                    {openNow ? 'Abierto ahora' : 'Cerrado ahora'}
                    <span className={`w-2 h-2 rounded-full ${openNow ? 'bg-emerald-400' : 'bg-white/25'}`} />
                  </p>
                  <p className="text-xs text-white/50 mt-0.5">
                    {affiliate.startTime || '—'} - {affiliate.endTime || '—'}
                  </p>
                  <p className="text-[10px] text-white/35 mt-0.5">
                    {activeDayLabels} · {affiliate.timezone || 'America/Mexico_City'}
                  </p>
                </div>
              </div>

              {/* Moverme: abre Rabbitty Move con este negocio como destino */}
              <div className="h-px bg-white/5" />
              <button
                type="button"
                onClick={() => {
                  PlatformBridge.hapticFeedback('medium');
                  router.push(
                    `/move?to=${encodeURIComponent(affiliate.address || affiliate.name)}&name=${encodeURIComponent(affiliate.name)}`,
                  );
                }}
                className="w-full flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-3.5 py-3 backdrop-blur-xl active:scale-[0.99] transition-transform"
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF2E93] to-[#8B5CF6] flex items-center justify-center shrink-0">
                    <Navigation size={17} color="#fff" />
                  </span>
                  <span className="min-w-0 text-left">
                    <span className="block text-sm font-bold text-white">Moverme hasta aquí</span>
                    <span className="block text-[11px] text-white/50 truncate">Uber con el destino precargado</span>
                  </span>
                </span>
                <ChevronRight size={16} className="text-white/40 shrink-0" />
              </button>

              {/* Website Link Action — solo si el negocio configuró su sitio */}
              {(affiliate.website || affiliate.webUrl) && (
                <>
                  <div className="h-px bg-white/5" />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-blue-400 shrink-0">
                        <Globe size={18} />
                      </div>
                      <div>
                        <p className="font-bold text-sm text-white">Sitio Web Oficial</p>
                        <p className="text-xs text-white/50">{targetWebsite}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowInAppBrowser(true)}
                      className="px-3.5 py-1.5 rounded-xl bg-white/10 text-white text-xs font-bold hover:bg-white/15"
                    >
                      Visitar
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Gallery */}
            {parsedGallery.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-black uppercase tracking-wider text-white">Galería</h3>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-6 px-6">
                  {parsedGallery.map((img: string, i: number) => (
                    <div
                      key={i}
                      className="relative w-48 h-32 rounded-2xl overflow-hidden shrink-0 border border-white/10 shadow-md"
                    >
                      <Image
                        src={img}
                        fill
                        unoptimized
                        className="object-cover"
                        alt={`Galería ${i}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* About text — solo si el negocio lo configuró (sin relleno) */}
            {affiliate.description && affiliate.description.trim().length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-black uppercase tracking-wider text-white">Acerca de</h3>
                <p className="text-xs text-white/70 leading-relaxed">{affiliate.description}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Persistent Bottom Bar (Cart) with dynamic push-down on scroll */}
      {totalCartCount > 0 && (
        <div
          className={`fixed left-0 right-0 px-4 z-40 pointer-events-none transition-all duration-300 ease-out ${
            isNavVisible
              ? 'bottom-[calc(max(var(--safe-bottom,0px),env(safe-area-inset-bottom,0px))+76px)]'
              : 'bottom-[calc(max(var(--safe-bottom,0px),env(safe-area-inset-bottom,0px))+14px)]'
          }`}
        >
          <div className="max-w-md mx-auto pointer-events-auto">
            <motion.button
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                PlatformBridge.hapticFeedback('medium');
                setShowCartSheet(true);
              }}
              className="w-full bg-linear-to-r from-[#E91E63] via-[#D81B60] to-[#C2185B] text-white py-3.5 px-5 rounded-2xl font-black text-sm shadow-[0_8px_25px_rgba(233,30,99,0.5)] border border-white/20 flex items-center justify-between transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-white text-[#E91E63] flex items-center justify-center text-xs font-black shadow">
                  {totalCartCount}
                </div>
                <div className="text-left">
                  {/* H-ORDEN-LOCAL: etiqueta coherente con el destino del pedido */}
                  <span className="block font-black text-sm leading-tight">
                    {hasPresenceCheckedIn ? 'Tu orden · en el local' : 'Tu pedido'}
                  </span>
                  <span className="text-[10px] text-white/80 font-medium">
                    {hasPresenceCheckedIn
                      ? 'Se envía al local y se suma a tu comanda'
                      : 'En Mesa o Para recoger'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 bg-black/20 py-1.5 px-3 rounded-xl border border-white/10">
                <span className="text-xs font-black">Continuar</span>
                <ChevronRight size={16} />
              </div>
            </motion.button>
          </div>
        </div>
      )}

      {/* Persistent Bottom Bar — Mi Cuenta (Fase C): el comensal ve su cuenta y paga */}
      {totalCartCount === 0 && tableNumber != null && (
        <div
          className={`fixed left-0 right-0 px-4 z-40 pointer-events-none transition-all duration-300 ease-out ${
            isNavVisible
              ? 'bottom-[calc(max(var(--safe-bottom,0px),env(safe-area-inset-bottom,0px))+76px)]'
              : 'bottom-[calc(max(var(--safe-bottom,0px),env(safe-area-inset-bottom,0px))+14px)]'
          }`}
        >
          <div className="max-w-md mx-auto pointer-events-auto">
            <motion.button
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                PlatformBridge.hapticFeedback('medium');
                setShowBillSheet(true);
              }}
              className="w-full bg-[#0F2B29] text-white py-3.5 px-5 rounded-2xl font-black text-sm shadow-[0_8px_25px_rgba(0,0,0,0.45)] border border-emerald-500/40 flex items-center justify-between transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs shadow">
                  <Receipt size={14} />
                </div>
                <div className="text-left">
                  <span className="block font-black text-sm leading-tight text-emerald-400">Mi Cuenta · Mesa #{tableNumber}</span>
                  <span className="text-[10px] text-white/70 font-medium">Ver consumo · pedir cuenta · pagar</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 bg-black/20 py-1.5 px-3 rounded-xl border border-white/10">
                <span className="text-xs font-black text-emerald-400">Abrir</span>
                <ChevronRight size={16} className="text-emerald-400" />
              </div>
            </motion.button>
          </div>
        </div>
      )}

      {/* Sheets & Modals */}
      <TableBillSheet
        isOpen={showBillSheet}
        onClose={() => setShowBillSheet(false)}
        tableId={tableId}
        tableNumber={tableNumber}
        businessName={affiliate?.name || 'el comercio'}
      />
      <TableContextSheet
        isOpen={showTableSheet}
        onClose={() => setShowTableSheet(false)}
        tables={tables}
        currentTableNumber={tableNumber}
        onSelectTable={(num, id) => {
          setTableNumber(num);
          setTableId(id);
          showToast(`Ubicado en Mesa #${num}`, 'success');
          // Fase C: reclamar la mesa en el sistema (POS ve al comensal; el
          // siguiente pedido entra al Tab de esta mesa). Best-effort:
          // si ya está tomada por otro, avisamos pero el flujo sigue local.
          (async () => {
            try {
              const headers = await PlatformBridge.getAuthHeaders();
              if (!headers?.Authorization && !headers?.['X-Init-Data']) return;
              let userLat: number | undefined;
              let userLng: number | undefined;
              try {
                const loc = await PlatformBridge.getLocation();
                if (loc?.success && loc.lat != null && loc.lng != null) {
                  userLat = loc.lat;
                  userLng = loc.lng;
                }
              } catch { /* sin GPS: el geofence solo aplica con GPS */ }
              const res = await fetch('/api/pos/claim-table', {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ tableId: id, branchId: affiliate?.id, userLat, userLng }),
              });
              const data = await res.json().catch(() => null);
              if (res.ok && data?.success) {
                if (data.hasActiveOrder) {
                  showToast(`🐰 Conectado a Mesa #${num} — ya tienes cuenta abierta de $${Number(data.orderTotal || 0).toFixed(2)}`, 'success');
                }
              } else if (data?.code === 'TABLE_ALREADY_CLAIMED') {
                showToast(data?.error || 'Esta mesa ya está vinculada a otro Rabbitter', 'error');
              } else if (data?.code === 'GEOFENCE_EXCEEDED') {
                showToast('Para vincularte a la mesa debes estar en el local', 'error');
              }
            } catch { /* silencioso: reclamo best-effort */ }
          })();
        }}
        businessName={affiliate.name}
      />

      <OrderCartSheet
        isOpen={showCartSheet}
        onClose={() => setShowCartSheet(false)}
        cart={cart}
        onRemoveItem={handleRemoveFromCart}
        onUpdateQuantity={handleUpdateQuantity}
        onClearCart={() => setCart([])}
        onSubmitOrder={handleSubmitOrder}
        tableNumber={tableNumber}
        rewardPercentage={affiliate.rewardPercentage}
        businessName={affiliate.name}
        // H-ORDEN-LOCAL: check-in activo ⇒ pedido directo al local, sin picker.
        checkedIn={hasPresenceCheckedIn}
      />

      {/* Pedido en rampa: identidad de tarjeta de pedido + barra de 5 s */}
      {pendingPosOrder && (
        <div
          style={{
            position: 'fixed',
            left: 10,
            right: 10,
            bottom: 'calc(var(--safe-bottom, 0px) + 84px)',
            zIndex: 120,
          }}
        >
          <div
            style={{
              borderRadius: 18,
              border: '1px solid rgba(233,30,99,0.45)',
              background: 'linear-gradient(180deg, rgba(233,30,99,0.16), rgba(20,10,16,0.98))',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              padding: '12px 14px 10px',
              boxShadow: '0 16px 40px rgba(0,0,0,0.55)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 16 }}>🧾</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 9.5,
                    fontWeight: 900,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    color: '#FF8FB8',
                  }}
                >
                  {pendingPosOrder.orderType === 'DELIVERY'
                    ? 'Pedido a domicilio por enviar'
                    : pendingPosOrder.orderType === 'DINE_IN'
                      ? 'Pedido en local por enviar'
                      : 'Pedido para recoger por enviar'}
                </p>
                <p style={{ margin: '1px 0 0', fontSize: 13, fontWeight: 900, color: 'var(--text-primary)' }}>
                  {affiliate?.name}
                </p>
              </div>
              <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--text-primary)' }}>
                ${pendingPosOrder.total.toFixed(2)}
              </span>
            </div>

            <div style={{ maxHeight: 90, overflow: 'hidden', marginBottom: 8 }}>
              {pendingPosOrder.items.slice(0, 4).map((it, i) => (
                <p key={i} style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                  • {it.quantity}× {it.name}
                </p>
              ))}
              {pendingPosOrder.items.length > 4 && (
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>
                  +{pendingPosOrder.items.length - 4} más
                </p>
              )}
              {pendingPosOrder.address && (
                <p style={{ margin: '4px 0 0', fontSize: 11, color: '#7DD3FC' }}>📍 {pendingPosOrder.address}</p>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={cancelPendingPosOrder}
                style={{
                  flex: 1,
                  border: '1px solid rgba(255,255,255,0.16)',
                  background: 'rgba(255,255,255,0.06)',
                  color: 'var(--text-primary)',
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 800,
                  padding: '9px 11px',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={modifyPendingPosOrder}
                style={{
                  flex: 1,
                  border: 'none',
                  background: '#E91E63',
                  color: '#fff',
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 900,
                  padding: '9px 11px',
                  cursor: 'pointer',
                }}
              >
                Modificar
              </button>
            </div>

            <div
              style={{
                marginTop: 9,
                height: 3,
                borderRadius: 999,
                background: 'rgba(255,255,255,0.12)',
                overflow: 'hidden',
              }}
            >
              <motion.div
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 5, ease: 'linear' }}
                style={{ height: '100%', background: 'linear-gradient(90deg, #FF2E93, #8B5CF6)' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Confirmación: misma tarjeta de pedido, ahora enviada */}
      {sentOrder && (
        <div
          style={{
            position: 'fixed',
            left: 10,
            right: 10,
            bottom: 'calc(var(--safe-bottom, 0px) + 84px)',
            zIndex: 120,
          }}
        >
          <div
            style={{
              borderRadius: 18,
              border: '1px solid rgba(16,185,129,0.45)',
              background: 'linear-gradient(180deg, rgba(16,185,129,0.16), rgba(12,16,14,0.98))',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              padding: '12px 14px 10px',
              boxShadow: '0 16px 40px rgba(0,0,0,0.55)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 16 }}>✅</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 9.5,
                    fontWeight: 900,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    color: '#6EE7B7',
                  }}
                >
                  {sentOrder.orderType === 'DELIVERY'
                    ? 'Pedido a domicilio enviado'
                    : sentOrder.orderType === 'DINE_IN'
                      ? 'Pedido en local enviado'
                      : 'Pedido para recoger enviado'}
                </p>
                <p style={{ margin: '1px 0 0', fontSize: 13, fontWeight: 900, color: 'var(--text-primary)' }}>
                  {affiliate?.name}
                </p>
              </div>
              <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--text-primary)' }}>
                ${sentOrder.total.toFixed(2)}
              </span>
            </div>

            <div style={{ maxHeight: 70, overflow: 'hidden', marginBottom: 6 }}>
              {sentOrder.items.slice(0, 3).map((it, i) => (
                <p key={i} style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                  • {it.quantity}× {it.name}
                </p>
              ))}
              {sentOrder.items.length > 3 && (
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>
                  +{sentOrder.items.length - 3} más
                </p>
              )}
              {sentOrder.address && (
                <p style={{ margin: '4px 0 0', fontSize: 11, color: '#7DD3FC' }}>📍 {sentOrder.address}</p>
              )}
            </div>

            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.45 }}>
              El local ya lo recibió. Te avisamos cuando esté en preparación, en camino y con el tiempo estimado.
            </p>

            <div
              style={{
                marginTop: 9,
                height: 3,
                borderRadius: 999,
                background: 'rgba(16,185,129,0.18)',
                overflow: 'hidden',
              }}
            >
              <motion.div
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 2.8, ease: 'linear' }}
                style={{ height: '100%', background: 'linear-gradient(90deg, #34D399, #10B981)' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Map selector modal */}
      {showMapSelector && (
        <div className="fixed inset-0 z-999 bg-black/70 backdrop-blur-md flex items-end">
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="w-full bg-[#111] rounded-t-4xl p-6 border-t border-white/10 space-y-4"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-base font-black text-white">🗺️ ¿Cómo quieres llegar?</h3>
              <button
                onClick={() => setShowMapSelector(false)}
                className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2.5">
              <button
                onClick={() => {
                  const query = encodeURIComponent(`${affiliate.name} ${affiliate.address || ''}`);
                  void PlatformBridge.openExternalUrl(`https://www.google.com/maps/search/?api=1&query=${query}`);
                  setShowMapSelector(false);
                }}
                className="w-full bg-[#1E1E24] text-white p-4 rounded-2xl border border-white/10 font-bold text-sm flex items-center gap-3 text-left"
              >
                🗺️ Abrir en Google Maps
              </button>
              <button
                onClick={() => {
                  const query = encodeURIComponent(`${affiliate.name} ${affiliate.address || ''}`);
                  void PlatformBridge.openExternalUrl(`https://waze.com/ul?q=${query}&navigate=yes`);
                  setShowMapSelector(false);
                }}
                className="w-full bg-[#1E1E24] text-white p-4 rounded-2xl border border-white/10 font-bold text-sm flex items-center gap-3 text-left"
              >
                🚗 Abrir en Waze
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Message selector modal */}
      {showMessageSelector && (
        <div className="fixed inset-0 z-999 bg-black/70 backdrop-blur-md flex items-end justify-center">
          <motion.div
            initial={{ y: 200, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-[#161622] rounded-t-4xl p-6 w-full max-w-lg border border-white/10 space-y-4"
          >
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-black text-white">Enviar mensaje</h3>
                <p className="text-xs text-white/50">Comunícate directamente con {affiliate.name}</p>
              </div>
              <button
                onClick={() => setShowMessageSelector(false)}
                className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => {
                  PlatformBridge.hapticFeedback('medium');
                  setShowMessageSelector(false);
                  router.push(`/chat/${affiliate.id}`);
                }}
                className="w-full bg-linear-to-r from-[#E91E63] to-[#FF4081] text-white p-4 rounded-2xl font-black text-sm flex items-center gap-3 shadow-lg shadow-[#E91E63]/30"
              >
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-lg">
                  💬
                </div>
                <div className="text-left">
                  <div className="font-black text-sm">Chat In-App Rabbitty</div>
                  <div className="text-[11px] opacity-80">Conversa en directo con el local</div>
                </div>
              </button>

              <button
                onClick={() => {
                  PlatformBridge.hapticFeedback('medium');
                  setShowMessageSelector(false);
                  const phone =
                    affiliate.supportWhatsApp || affiliate.phone || affiliate.owner?.phoneNumber;
                  if (phone) {
                    const cleanPhone = phone.replace(/[^0-9]/g, '');
                    const text = encodeURIComponent(
                      `¡Hola ${affiliate.name}! Vi su perfil en Rabbitty y me gustaría más información.`
                    );
                    void PlatformBridge.openExternalUrl(`https://wa.me/${cleanPhone}?text=${text}`);
                  } else {
                    showToast('WhatsApp directo no configurado por el comercio', 'info');
                  }
                }}
                className="w-full bg-[#25D366] text-white p-4 rounded-2xl font-black text-sm flex items-center gap-3 shadow-lg shadow-[#25D366]/30"
              >
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-lg">
                  📱
                </div>
                <div className="text-left">
                  <div className="font-black text-sm">WhatsApp Oficial</div>
                  <div className="text-[11px] opacity-80">Abrir chat en WhatsApp</div>
                </div>
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* In-app browser modal */}
      {showInAppBrowser && (
        <div className="fixed inset-0 z-9999 bg-[#05020A] flex flex-col">
          <div className="pt-[max(env(safe-area-inset-top,0px),56px)] pb-3 px-4 bg-[#110720] border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setShowInAppBrowser(false)}
                className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center font-bold"
              >
                ✕
              </button>
              <div>
                <p className="text-sm font-black text-white">{affiliate.name}</p>
                <p className="text-xs text-purple-400 truncate max-w-50">{formattedWebUrl}</p>
              </div>
            </div>
            <button
              onClick={() => void PlatformBridge.openExternalUrl(formattedWebUrl)}
              className="bg-[#E91E63] text-white px-3.5 py-1.5 rounded-xl font-bold text-xs"
            >
              Abrir en Navegador
            </button>
          </div>
          <iframe
            src={formattedWebUrl}
            className="w-full flex-1 border-none bg-white"
            title={`Web de ${affiliate.name}`}
          />
        </div>
      )}

      {/* Mood check-in sheet */}
      <MoodCheckInSheet
        isOpen={showMoodCheckIn}
        onClose={() => setShowMoodCheckIn(false)}
        businessId={affiliate.id}
        businessName={affiliate.name}
      />

      {/* H-TRACK-LOCAL: seguimiento del pedido de ESTE negocio (mismo sheet del home) */}
      <OrderTrackSheet
        orderId={trackOpenId}
        onClose={() => setTrackOpenId(null)}
        onUpdated={() => setTrackOpenId(null)}
      />

      <BottomNav />
    </div>
  );
}

export default function AffiliateProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="bg-[#0D0D15] min-h-screen flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border-3 border-white/10 border-t-[#E91E63] animate-spin" />
        </div>
      }
    >
      <AffiliateProfileContent />
    </Suspense>
  );
}
