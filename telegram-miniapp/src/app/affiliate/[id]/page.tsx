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
  ShoppingBag,
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
import { CatalogItem, CatalogModifier, ProductDetailModal } from '@/components/affiliate/ProductDetailModal';
import { StoreCatalog } from '@/components/affiliate/StoreCatalog';
import { InAppPaySheet } from '@/components/affiliate/InAppPaySheet';
import { useAuth } from '@/features/auth/AuthProvider';

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
  branches?: Array<{ id: string; name: string; address?: string | null; lat?: number | null; lng?: number | null }>;
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
  /** Horario + caja: si el local recibe pedidos AHORA (misma regla que checkout). */
  ordering?: {
    canOrder: boolean;
    state: 'OPEN' | 'NO_TILL' | 'EXTENDED' | 'CLOSED';
    scheduleOpen: boolean;
    cashShiftOpen: boolean;
    message: string | null;
    tone: 'success' | 'info' | 'warn' | 'error';
    nextOpenLabel: string | null;
  } | null;
}

function AffiliateProfileContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string;
  const { showToast } = useToast();

  const { user } = useAuth();
  const [affiliate, setAffiliate] = useState<AffiliateData | null>(null);
  // Multi-sucursal: la ficha y el pedido deben caer en la MISMA sucursal.
  const [primaryBranch, setPrimaryBranch] = useState<{ id: string; name: string } | null>(null);
  const [branches, setBranches] = useState<Array<{ id: string; name: string; address?: string | null }>>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [tables, setTables] = useState<Array<{ id: string; number: number; capacity?: number; location?: string | null; qrCode?: string | null }>>([]);
  // ¿El local recibe pedidos ahora? (horario + caja) Lo resuelve el servidor.
  const [ordering, setOrdering] = useState<BusinessResponse['ordering']>(null);
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
  // `?tab=tienda|menu|info` permite enlazar directo a una pestaña (notificaciones,
  // campañas, QR). Se valida contra la lista: un valor raro cae en el menú.
  const initialTabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'menu' | 'tienda' | 'info'>(
    initialTabParam === 'tienda' || initialTabParam === 'info' ? initialTabParam : 'menu',
  );
  const [storeProduct, setStoreProduct] = useState<CatalogItem | null>(null);
  const [membershipPlans, setMembershipPlans] = useState<{ planId: string; planName: string; planDescription?: string | null; versionId: string; priceFiat: number; currency: string; billingInterval: string; alreadySubscribed: boolean }[]>([]);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  // H-PRESYNC · Voy: igual criterio que "Estoy aquí" — se hidrata del server
  // (PLAN_VISIT reciente en business_interactions, ventana antispam 12h).
  const [planVisitSent, setPlanVisitSent] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  // Preferencias (15.2+): producto favorito aprendido en este negocio.
  const [favoriteProduct, setFavoriteProduct] = useState<{ refId: string; label: string } | null>(null);

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
    paymentMethod: 'CASH' | 'BUNZ' | 'CARD';
  } | null>(null);

  // ── Pago con tarjeta (Rabbitty Pay) ──
  // El pedido se crea primero (PENDING_PAYMENT) y el cobro ocurre en el sheet.
  // Si el cliente cierra sin pagar, el POS lo muestra en "Por cobrar".
  const [payOrder, setPayOrder] = useState<{ orderId: string; total: number } | null>(null);
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
  const [webLoading, setWebLoading] = useState(true);
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

    const branchQuery = selectedBranchId ? `?branchId=${encodeURIComponent(selectedBranchId)}` : '';
    fetch(`/api/business/${id}${branchQuery}`)
      .then(res => res.json())
      .then((data: { success: boolean } & BusinessResponse) => {
        if (data.success && data.business) {
          setAffiliate(data.business);
          setPrimaryBranch(data.primaryBranch ?? null);
          setBranches(data.branches ?? []);
          setCategories(data.categories || []);
          setTables(data.tables || []);
          if (data.capabilities) setCapabilities(data.capabilities);
          setOrdering(data.ordering ?? null);

          // If initialTableNum exists, resolve its tableId
          if (data.tables && initialTableNum !== null) {
            const matched = data.tables.find(t => t.number === initialTableNum);
            if (matched) setTableId(matched.id);
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id, initialTableNum, selectedBranchId]);

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

  useEffect(() => {
    if (!affiliate?.id) return;
    let alive = true;
    void PlatformBridge.getAuthHeaders()
      .then((headers) => fetch('/api/preferences', { headers, cache: 'no-store' }))
      .then((r) => r.json())
      .then((d) => {
        if (!alive || !d?.success) return;
        const top = d.byBusiness?.[affiliate.id]?.products?.[0];
        if (top?.refId && top?.label) setFavoriteProduct({ refId: String(top.refId), label: String(top.label) });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [affiliate?.id]);

  // Conversión del aviso: si llegó aquí después de un "ya te alcanza", cuenta.
  useEffect(() => {
    if (!affiliate?.id) return;
    void PlatformBridge.getAuthHeaders()
      .then((headers) =>
        fetch('/api/preferences/visit', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ businessId: affiliate.id }),
        }),
      )
      .catch(() => {});
  }, [affiliate?.id]);

  const favoriteItem = useMemo(() => {
    if (!favoriteProduct?.refId) return null;
    for (const cat of categories) {
      const found = cat.items?.find((i) => i.id === favoriteProduct.refId);
      if (found) return found;
    }
    return null;
  }, [favoriteProduct, categories]);

  /** Guarda un producto del menú en la lista de deseos (contextual, sin salir). */
  const handleWishlist = async (item: { id: string; name: string; price: number; imageUrl?: string | null }) => {
    try {
      PlatformBridge.hapticFeedback('medium');
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch('/api/wishlist/items', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'PRODUCT',
          businessId: affiliate?.id,
          menuItemId: item.id,
          title: item.name,
          imageUrl: item.imageUrl ?? null,
          priceSnapshot: item.price,
        }),
      });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || 'No se pudo guardar');
      showToast('Guardado en tu lista de deseos 🎁', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo guardar', 'error');
    }
  };

  const handleAddToCart = (
    item: CatalogItem,
    quantity: number,
    modifiers: CatalogModifier[],
    notes: string
  ) => {
    PlatformBridge.hapticFeedback('light');
    const cartItemId = `${item.id}-${modifiers.map(m => m.id).sort().join('_')}-${notes.trim()}`;

    // ── Tienda: topes antes de agregar ──
    // El servidor también valida (nunca se confía en el cliente), pero aquí se
    // evita que el cliente llegue a un error al confirmar.
    const alreadyInCart = cart
      .filter((line) => line.menuItemId === item.id)
      .reduce((sum, line) => sum + line.quantity, 0);
    const maxPerOrder = typeof item.maxPerOrder === 'number' ? item.maxPerOrder : null;
    if (maxPerOrder && alreadyInCart + quantity > maxPerOrder) {
      showToast(`Solo puedes llevar ${maxPerOrder} de ${item.name} por pedido`, 'info');
      return;
    }
    if (typeof item.stock === 'number' && alreadyInCart + quantity > item.stock) {
      showToast(
        item.stock > 0 ? `Quedan ${item.stock} de ${item.name}` : `${item.name} está agotado`,
        'info',
      );
      return;
    }

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
    paymentMethod: 'CASH' | 'BUNZ' | 'CARD';
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

      if (order.paymentMethod === 'CARD') {
        // El pedido ya existe sin pagar: se cobra aquí mismo.
        showToast('Pedido creado. Completa el pago con tarjeta.', 'info');
        if (data.orderId) setPayOrder({ orderId: data.orderId, total: order.total });
      } else if (order.paymentMethod === 'BUNZ') {
        showToast('¡Pagado con Bunz! La cocina ya lo tiene.', 'success');
      } else {
        showToast('Pedido enviado. Paga en caja para que la cocina arranque.', 'success');
      }
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
    paymentMethod: 'CASH' | 'BUNZ' | 'CARD' = 'CASH',
  ) => {
    // El local no está recibiendo pedidos: se avisa AQUÍ y no se manda nada.
    // Antes el pedido se armaba, se enviaba y el servidor lo rechazaba (o el
    // Rabbitter se quedaba esperando un pedido que nunca entró al POS).
    if (ordering && !ordering.canOrder) {
      showToast(ordering.message || 'El local está cerrado ahora.', 'error');
      return;
    }
    PlatformBridge.hapticFeedback('heavy');

    const payload = {
      orderType,
      deliveryAddress: orderType === 'DELIVERY' ? address?.text ?? null : null,
      deliveryAddressData: orderType === 'DELIVERY' ? address?.data ?? null : null,
      // Sin mesa elegida el pedido puede salir "producto solo" — el POS la
      // vincula a mesa después si procede. Se manda la sucursal mostrada (si
      // existe) para que el pedido caiga en la misma carta que vio el cliente.
      tableId: tableId || null,
      branchId: primaryBranch?.id || affiliate?.id || null,
      items: cart.map(item => ({
        id: item.menuItemId,
        price: item.price,
        quantity: item.quantity,
        notes: item.notes || null,
      })),
      paymentMethod,
    };

    // El pedido sale solo tras la barra de 5 s, con la tarjeta inferior para
    // cancelar o modificar (misma identidad que la tarjeta de pedido).
    const order = {
      orderType,
      address: address?.text,
      payload,
      paymentMethod,
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

  /**
   * ── Tienda vs menú ──
   * Los productos de tienda son filas de `menu_items` con kind = 'PRODUCT'.
   * Se separan aquí para no mostrarlos dos veces y para que el menú quede
   * igual que siempre.
   */
  const { products, menuOnlyCategories } = useMemo(() => {
    const storeProducts: CatalogItem[] = [];
    const menuCats: CatalogCategory[] = [];
    for (const category of categories) {
      const dishes: CatalogItem[] = [];
      for (const item of category.items as CatalogItem[]) {
        if (item.kind === 'PRODUCT') storeProducts.push({ ...item, categoryName: category.name });
        else dishes.push(item);
      }
      if (dishes.length > 0) menuCats.push({ ...category, items: dishes });
    }
    return { products: storeProducts, menuOnlyCategories: menuCats };
  }, [categories]);

  const hasStore = products.length > 0;

  const totalCartCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  if (loading) {
    return (
      <div className="bg-[var(--bg-primary)] min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-3 border-white/10 border-t-[var(--rabbitty-pink)] animate-spin" />
      </div>
    );
  }

  if (!affiliate) {
    return (
      <div className="bg-[var(--bg-primary)] min-h-screen flex items-center justify-center text-white/50 font-semibold">
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
  // El CSP solo permite iframes de *.rabbitty.me. Un dominio propio quedaría
  // en blanco con el spinner pegado: en ese caso se ofrece abrirlo fuera.
  const isEmbeddableWebsite = /^https?:\/\/([a-z0-9-]+\.)*rabbitty\.me(?::\d+)?(\/|$)/i.test(formattedWebUrl)
    || /^https?:\/\/localhost(:\d+)?(\/|$)/i.test(formattedWebUrl);

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
    <div className="bg-[var(--bg-primary)] min-h-screen pb-36 relative text-white">
      {/* Floating Dynamic Header */}
      <div 
        className={`fixed top-0 left-0 right-0 z-50 pt-[calc(max(var(--safe-top,0px),env(safe-area-inset-top,0px))+8px)] pb-3 px-4 flex items-center justify-between transition-all duration-200 ${
          isScrolled 
            ? 'bg-[var(--bg-primary)]/95 backdrop-blur-xl border-b border-white/10 shadow-lg pointer-events-auto' 
            : 'pointer-events-none'
        }`}
      >
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-full bg-[var(--bg-elevated)]/80 text-white flex items-center justify-center border border-white/15 backdrop-blur-xl shadow-xl pointer-events-auto active:scale-90 transition-transform shrink-0"
          aria-label="Volver atrás"
        >
          <ChevronLeft size={20} />
        </button>

        {/* Central Floating Pill (Header Top) */}
        {/* Píldora del header: primero el nombre, luego el estado. Categoría y
            horario se ocultan en pantallas angostas (ya están en la identidad del
            hero) para que el nombre no se corte a "6…". */}
        <div className="inline-flex min-w-0 items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/15 bg-[var(--bg-elevated)]/85 backdrop-blur-xl shadow-xl pointer-events-auto max-w-[62%] sm:max-w-none">
          <h1 className="m-0 min-w-0 truncate text-[12px] sm:text-sm font-black tracking-tight text-white max-w-[38vw] sm:max-w-[200px]">
            {affiliate.name}
          </h1>
          {affiliate.category && (
            <span className="hidden shrink-0 items-center gap-1.5 sm:inline-flex">
              <span className="w-1 h-1 rounded-full bg-white/30" />
              <span className="max-w-[120px] truncate text-[10px] font-black uppercase tracking-wider text-[var(--rabbitty-pink)]">
                {affiliate.category}
              </span>
            </span>
          )}
          {affiliate.startTime && affiliate.endTime && (
            <span className="hidden shrink-0 items-center gap-1 text-[10px] font-bold text-gray-300 sm:inline-flex">
              <Clock size={10} className="text-gray-400" />
              <span>{affiliate.startTime}–{affiliate.endTime}</span>
            </span>
          )}
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[8px] font-black uppercase sm:text-[9px] ${
            openNow
              ? 'bg-[var(--success-soft)] text-[var(--success)] border border-[var(--success)]/30'
              : 'bg-[var(--error-soft)] text-[var(--error)] border border-[var(--error)]/30'
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
            className="w-10 h-10 rounded-full bg-[var(--bg-elevated)]/80 text-white flex items-center justify-center border border-white/15 backdrop-blur-xl shadow-xl active:scale-90 transition-transform"
            aria-label="Favorito"
          >
            <Heart size={16} className={isFavorite ? 'fill-[var(--rabbitty-pink)] text-[var(--rabbitty-pink)]' : 'text-white/80'} />
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
            className="w-10 h-10 rounded-full bg-[var(--bg-elevated)]/80 text-white flex items-center justify-center border border-white/15 backdrop-blur-xl shadow-xl active:scale-90 transition-transform"
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
        <div className="absolute inset-0 bg-linear-to-t from-[var(--bg-primary)] via-transparent to-black/50" />

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
                // Con el local cerrado no se puede marcar "Estoy aquí": el servidor
                // lo rechaza igual y el POS vería gente que no puede atender.
                disabled={checkingInPresence || hasPresenceCheckedIn || !openNow}
                title={!openNow ? 'El local está cerrado' : undefined}
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
                    ? 'bg-[var(--surface-2)] text-[var(--success)] border-[var(--success)]/30'
                    : 'bg-[var(--surface-2)] hover:bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--rabbitty-pink)]/40'
                }`}
              >
                <span className={`inline-block w-2 h-2 rounded-full ${hasPresenceCheckedIn ? 'bg-white' : 'bg-[var(--rabbitty-pink)] animate-ping'}`} />
                <span>
                  {hasPresenceCheckedIn
                    ? '✓ Estoy Aquí'
                    : checkingInPresence
                      ? 'Activando...'
                      : openNow
                        ? 'Estoy Aquí'
                        : 'Cerrado ahora'}
                </span>
              </motion.button>
            )}

            {/* Table indicator badge if seated */}
            {tableNumber && (
              <button
                onClick={() => setShowTableSheet(true)}
                className="h-9 px-3.5 bg-[var(--surface-2)] backdrop-blur-xl text-white rounded-full flex items-center gap-1.5 text-xs font-black border border-[var(--border-default)] active:scale-95 transition-transform cursor-pointer"
              >
                <Utensils size={13} className="text-[var(--text-secondary)]" />
                <span>Mesa #{tableNumber}</span>
              </button>
            )}
          </div>

          {/* Right Badge: Bunz Reward */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', delay: 0.15 }}
            className="h-9 bg-[image:var(--brand-gradient)] text-white px-3.5 rounded-full flex items-center gap-1.5 border border-white/20 shrink-0"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span className="font-black text-sm">+{affiliate.rewardPercentage}%</span>
            <span className="font-bold text-[10px] opacity-90 tracking-wide">BUNZ</span>
          </motion.div>
        </div>
      </div>

      {/* Content Container (Card Overlap) */}
      <div className="relative bg-[var(--bg-primary)] rounded-t-[36px] -mt-8 px-5 pt-6 pb-20 border-t border-white/10 shadow-2xl space-y-5">
        {/* Tu favorito (se aprende de tus pedidos) */}
        {favoriteProduct && (
          <div className="mx-1 mb-2 flex items-center justify-between gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-2">
            <div className="min-w-0">
              <p className="m-0 text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)]">Tu favorito aquí</p>
              <p className="m-0 truncate text-[12.5px] font-bold text-white">{favoriteProduct.label}</p>
            </div>
            {favoriteItem && (
              <button
                type="button"
                onClick={() => handleAddToCart(favoriteItem, 1, [], '')}
                className="shrink-0 rounded-full bg-[image:var(--brand-gradient)] px-3 py-1.5 text-[11px] font-black text-white active:scale-95 transition-transform"
              >
                Lo de siempre
              </button>
            )}
          </div>
        )}


        {/* ── Identidad: qué es, si está abierto, cuánto devuelve ── */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[10px] font-black uppercase tracking-[0.14em] ${
              ordering
                ? ordering.canOrder
                  ? 'text-[var(--success)]'
                  : 'text-[var(--text-muted)]'
                : openNow
                  ? 'text-[var(--success)]'
                  : 'text-[var(--text-muted)]'
            }`}>
              ● {ordering
                ? ordering.state === 'EXTENDED'
                  ? 'Atendiendo (fuera de horario)'
                  : ordering.state === 'NO_TILL'
                    ? 'Abierto · caja cerrada'
                    : ordering.canOrder
                      ? 'Abierto ahora'
                      : 'Cerrado'
                : openNow
                  ? 'Abierto ahora'
                  : 'Cerrado'}
            </span>
            {affiliate.category && (
              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
                {affiliate.category}
              </span>
            )}
            {affiliate.startTime && affiliate.endTime && (
              <span className="text-[10px] font-bold text-[var(--text-muted)]">
                {affiliate.startTime}–{affiliate.endTime}
              </span>
            )}
          </div>
          <h1 className="m-0 text-[26px] font-black leading-tight tracking-tight text-[var(--text-primary)]">
            {affiliate.name}
          </h1>
          <p className="m-0 text-[13px] font-bold text-[var(--text-secondary)]">
            Devuelve <span className="text-[var(--rabbitty-pink)]">+{affiliate.rewardPercentage}% en Bunz</span> en cada consumo
          </p>
          {branches.length > 1 && (
            <div className="mt-2 flex items-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-2">
              <MapPin size={14} className="shrink-0 text-[var(--rabbitty-pink)]" />
              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
                Sucursal
              </span>
              <select
                value={primaryBranch?.id ?? ''}
                onChange={(e) => {
                  const next = e.target.value;
                  // El menú, las mesas y el pedido son de UNA sucursal: al
                  // cambiar se limpia el carrito para no mezclar cartas.
                  setSelectedBranchId(next);
                  setCart([]);
                  setTableId(null);
                }}
                className="ml-auto min-w-0 flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1.5 text-[12px] font-bold text-[var(--text-primary)] outline-none"
                aria-label="Elegir sucursal"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* ── Estado de pedidos (horario + caja): se sabe ANTES de armar el pedido ── */}
        {ordering?.message && (
          <div
            role="status"
            className={`flex items-start gap-2 rounded-2xl border px-3 py-2.5 text-[11.5px] font-semibold leading-snug ${
              ordering.state === 'CLOSED'
                ? 'border-red-500/40 bg-red-500/10 text-red-200'
                : ordering.state === 'NO_TILL'
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                  : ordering.state === 'EXTENDED'
                    ? 'border-sky-500/40 bg-sky-500/10 text-sky-200'
                    : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
            }`}
          >
            <Clock size={14} className="mt-0.5 shrink-0" />
            <span>
              {ordering.message}
              {!ordering.canOrder && (
                <span className="mt-1 block text-[10.5px] font-bold opacity-80">
                  El menú sigue visible; ya puedes elegir y pedir cuando abra.
                </span>
              )}
            </span>
          </div>
        )}

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
            <div className="w-10 h-10 rounded-xl bg-[var(--surface-1)] text-[var(--text-secondary)] border border-[var(--border-subtle)] flex items-center justify-center">
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
            <div className="w-10 h-10 rounded-xl bg-[var(--surface-1)] text-[var(--text-secondary)] border border-[var(--border-subtle)] flex items-center justify-center">
              <Sparkles size={18} />
            </div>
            <span className="text-[10px] font-black text-[var(--text-secondary)] tracking-tight">Mood</span>
          </motion.button>

          {capabilities.tableServiceEnabled && tables.length > 0 ? (
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={() => setShowTableSheet(true)}
              className="flex flex-col items-center gap-1.5 py-1.5 px-1 rounded-xl transition-all hover:bg-white/5 active:opacity-80 border-none bg-transparent cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-[var(--surface-1)] text-[var(--text-secondary)] border border-[var(--border-subtle)] flex items-center justify-center">
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
            <div className="w-10 h-10 rounded-xl bg-[var(--surface-1)] text-[var(--text-secondary)] border border-[var(--border-subtle)] flex items-center justify-center">
              <MessageCircle size={18} />
            </div>
            <span className="text-[10px] font-black text-white/90 tracking-tight">Mensaje</span>
          </motion.button>
        </div>

        {/* Pestañas: etiquetas cortas y una línea por pestaña.
            Con tres pestañas el texto largo ("Menú y Servicios") se partía y se
            encimaba; ahora entra siempre, también en pantallas de 320 px. */}
        <div className="sticky top-[calc(max(var(--safe-top,0px),env(safe-area-inset-top,0px))+56px)] z-30 -mx-1 px-1 py-1 bg-[var(--bg-primary)]/95 backdrop-blur-xl">
          <div
            className={`grid ${hasStore ? 'grid-cols-3' : 'grid-cols-2'} gap-1 p-1 bg-[var(--bg-elevated)] rounded-2xl border border-[var(--border-subtle)]`}
          >
            {[
              { id: 'menu' as const, label: 'Menú', icon: Utensils, show: true },
              { id: 'tienda' as const, label: 'Tienda', icon: ShoppingBag, show: hasStore },
              { id: 'info' as const, label: 'Sucursal', icon: Layers, show: true },
            ]
              .filter((tab) => tab.show)
              .map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      PlatformBridge.hapticFeedback('light');
                      setActiveTab(tab.id);
                    }}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[11.5px] font-black leading-none transition-all ${
                      isActive
                        ? 'bg-[image:var(--brand-gradient)] text-white shadow-md shadow-[var(--rabbitty-pink)]/25'
                        : 'text-[var(--text-secondary)] hover:text-white'
                    }`}
                  >
                    <Icon size={14} className="shrink-0" />
                    <span className="truncate whitespace-nowrap">{tab.label}</span>
                  </button>
                );
              })}
          </div>
        </div>

        {/* Tab 1: Menú y Catálogo Estructurado */}
        {activeTab === 'menu' && (
          <div className="space-y-6">
            <DigitalMenuCatalog
              orderingBlocked={ordering ? !ordering.canOrder : false}
              orderingMessage={ordering?.message ?? null}
              categories={menuOnlyCategories}
              currency="MXN"
              rewardPercentage={affiliate.rewardPercentage}
              onAddToCart={handleAddToCart}
              onWishlist={handleWishlist}
              digitalOrderingEnabled={capabilities.digitalOrderingEnabled}
            />
          </div>
        )}

        {/* Tab 1b: Tienda de productos para llevar */}
        {activeTab === 'tienda' && (
          <StoreCatalog
            products={products}
            currency="MXN"
            onSelectProduct={(item) => {
              PlatformBridge.hapticFeedback('light');
              setStoreProduct(item);
            }}
          />
        )}

        {/* Tab 2: Sucursal, Ubicación, Happy Hour & Galería */}
        {activeTab === 'info' && (
          <div className="space-y-5">
        {/* ── "Planeo ir": acciona la proximidad y avisa al comercio ──
            H-PRESYNC: se oculta si ya estás checkeado (no puedes "planeo ir"
            cuando ya te registraste aquí), y muestra tu estado hidratado.
            Si el local está CERRADO no se ofrece: no tiene sentido avisar que
            vas a un lugar que ahora no atiende. */}
        {(hasPresenceCheckedIn || openNow) && (
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
              style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--success)', border: '1px solid rgba(52,211,153,0.4)' }}
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
                background: planVisitSent ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg, var(--accent-violet) 0%, var(--accent-violet) 100%)',
                color: planVisitSent ? 'rgba(255,255,255,0.4)' : '#FFF',
              }}
            >
              {planVisitSent ? '✓ Avisado' : 'Voy'}
            </button>
          )}
        </div>
        )}

        {/* ── Membresías del negocio (marketplace compacto) ── */}
        <MembershipMarketplace businessId={id} compact />


            {/* Happy Hour Bunz Highlight */}
            <div className="p-4 bg-linear-to-br from-[var(--rabbitty-pink)]/15 to-[var(--rabbitty-pink-dark)]/10 rounded-3xl border border-[var(--rabbitty-pink)]/25 space-y-2">
              <h4 className="text-sm font-black text-[var(--rabbitty-pink-light)] flex items-center gap-2">
                <Tag size={16} /> Recompensa Bunz
              </h4>
              <p className="text-xs text-white/75 leading-relaxed">
                Escanea tu ticket de compra durante el horario oficial ({affiliate.startTime} a {affiliate.endTime}) para recibir <strong>+{affiliate.rewardPercentage}% Bunz</strong> en cada consumo.
              </p>
            </div>

            {/* Address & Hours card */}
            <div className="bg-[var(--bg-elevated)] rounded-3xl p-5 border border-white/10 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-[var(--rabbitty-pink)] shrink-0">
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
                  <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--rabbitty-pink-light)] to-[var(--accent-violet)] flex items-center justify-center shrink-0">
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
                      onClick={() => { setWebLoading(true); setShowInAppBrowser(true); }}
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
              className="w-full bg-linear-to-r from-[var(--rabbitty-pink)] via-[var(--rabbitty-pink)] to-[var(--rabbitty-pink-dark)] text-white py-3.5 px-5 rounded-2xl font-black text-sm shadow-[0_8px_25px_rgba(233,30,99,0.5)] border border-white/20 flex items-center justify-between transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-white text-[var(--rabbitty-pink)] flex items-center justify-center text-xs font-black shadow">
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
              className="w-full bg-[var(--success-soft)] text-white py-3.5 px-5 rounded-2xl font-black text-sm shadow-[0_8px_25px_rgba(0,0,0,0.45)] border border-emerald-500/40 flex items-center justify-between transition-all"
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
                body: JSON.stringify({ tableId: id, branchId: primaryBranch?.id || affiliate?.id, userLat, userLng }),
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

      {/* Detalle de producto de la tienda (mismo modal que el menú) */}
      <ProductDetailModal
        item={storeProduct}
        orderingBlocked={ordering ? !ordering.canOrder : false}
        orderingMessage={ordering?.message ?? null}
        onClose={() => setStoreProduct(null)}
        onAddToCart={(item, quantity, modifiers, notes) => {
          handleAddToCart(item, quantity, modifiers, notes);
          setStoreProduct(null);
        }}
        currency="MXN"
        rewardPercentage={affiliate?.rewardPercentage ?? 0}
      />

      {/* Pago con tarjeta del pedido recién creado (Rabbitty Pay / Stripe) */}
      {payOrder && (
        <InAppPaySheet
          isOpen={Boolean(payOrder)}
          onClose={() => setPayOrder(null)}
          orderId={payOrder.orderId}
          total={payOrder.total}
          businessName={affiliate?.name}
          onPaid={() => {
            setPayOrder(null);
            showToast('¡Pago recibido! La cocina ya tiene tu pedido.', 'success');
          }}
        />
      )}

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
        branchOrBusinessId={affiliate.id}
        bunzBalance={Math.max(0, (user?.totalBunzEarned ?? 0) - (user?.totalBunzSpent ?? 0))}
        orderingNotice={ordering?.message ? { tone: ordering.tone, message: ordering.message } : null}
        orderingBlocked={ordering ? !ordering.canOrder : false}
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
                    color: 'var(--rabbitty-pink-light)',
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
                <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--info)' }}>📍 {pendingPosOrder.address}</p>
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
                  background: 'var(--rabbitty-pink)',
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
                style={{ height: '100%', background: 'linear-gradient(90deg, var(--rabbitty-pink-light), var(--accent-violet))' }}
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
                    color: 'var(--success)',
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
                <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--info)' }}>📍 {sentOrder.address}</p>
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
                style={{ height: '100%', background: 'linear-gradient(90deg, var(--success), var(--success))' }}
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
                className="w-full bg-[var(--bg-pressed)] text-white p-4 rounded-2xl border border-white/10 font-bold text-sm flex items-center gap-3 text-left"
              >
                🗺️ Abrir en Google Maps
              </button>
              <button
                onClick={() => {
                  const query = encodeURIComponent(`${affiliate.name} ${affiliate.address || ''}`);
                  void PlatformBridge.openExternalUrl(`https://waze.com/ul?q=${query}&navigate=yes`);
                  setShowMapSelector(false);
                }}
                className="w-full bg-[var(--bg-pressed)] text-white p-4 rounded-2xl border border-white/10 font-bold text-sm flex items-center gap-3 text-left"
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
            className="bg-[var(--bg-elevated)] rounded-t-4xl p-6 w-full max-w-lg border border-white/10 space-y-4"
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
                className="w-full bg-[image:var(--brand-gradient)] text-white p-4 rounded-2xl font-black text-sm flex items-center gap-3 shadow-lg shadow-[var(--rabbitty-pink)]/30"
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
                className="w-full bg-[var(--whatsapp)] text-white p-4 rounded-2xl font-black text-sm flex items-center gap-3 shadow-lg shadow-[var(--whatsapp)]/30"
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
        <div className="fixed inset-0 z-9999 bg-[var(--bg-primary)] flex flex-col">
          <div className="pt-[max(env(safe-area-inset-top,0px),56px)] pb-3 px-4 bg-[var(--bg-primary)] border-b border-white/10 flex items-center justify-between">
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
              className="bg-[var(--rabbitty-pink)] text-white px-3.5 py-1.5 rounded-xl font-bold text-xs"
            >
              Abrir en Navegador
            </button>
          </div>
          <div className="relative flex-1">
            {isEmbeddableWebsite ? (
              <>
                {webLoading && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[var(--bg-primary)]">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-[#E91E63]" />
                    <p className="m-0 text-[11px] font-bold text-white/50">Cargando el sitio…</p>
                  </div>
                )}
                <iframe
                  src={formattedWebUrl}
                  onLoad={() => setWebLoading(false)}
                  className="h-full w-full border-none bg-white"
                  title={`Web de ${affiliate.name}`}
                />
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <p className="m-0 text-sm font-black text-white">Este sitio se abre en el navegador</p>
                <p className="m-0 text-[11.5px] text-white/60">
                  Por seguridad, la app no incrusta dominios externos. Usa “Abrir en Navegador”.
                </p>
              </div>
            )}
          </div>
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
        <div className="bg-[var(--bg-primary)] min-h-screen flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border-3 border-white/10 border-t-[var(--rabbitty-pink)] animate-spin" />
        </div>
      }
    >
      <AffiliateProfileContent />
    </Suspense>
  );
}
