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
import { MoodCheckInSheet } from '@/components/mood/MoodCheckInSheet';
import { DigitalMenuCatalog, CatalogCategory } from '@/components/affiliate/DigitalMenuCatalog';
import { TableContextSheet } from '@/components/affiliate/TableContextSheet';
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

  // Cart & Ordering
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCartSheet, setShowCartSheet] = useState(false);

  // Modals
  const [showMapSelector, setShowMapSelector] = useState(false);
  const [showInAppBrowser, setShowInAppBrowser] = useState(false);
  const [showMessageSelector, setShowMessageSelector] = useState(false);
  const [showMoodCheckIn, setShowMoodCheckIn] = useState(false);

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

  const handleSubmitOrder = async (orderType: 'DINE_IN' | 'PICKUP') => {
    PlatformBridge.hapticFeedback('heavy');

    const payload = {
      tableId: tableId || (tables.length > 0 ? tables[0].id : null),
      items: cart.map(item => ({
        id: item.menuItemId,
        price: item.price,
        quantity: item.quantity,
        notes: item.notes || null,
      })),
      paymentMethod: 'CASH',
      orderType,
    };

    const res = await fetch('/api/pos/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Error al enviar orden', 'error');
      throw new Error(data.error || 'Order submission failed');
    }

    showToast('¡Orden enviada a cocina / personal con éxito!', 'success');
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

  let parsedGallery: string[] = [];
  try {
    parsedGallery = affiliate.gallery ? JSON.parse(affiliate.gallery) : [];
  } catch {
    /* parse fallback */
  }
  const coverImage =
    affiliate.coverImageUrl ||
    (parsedGallery.length > 0
      ? parsedGallery[0]
      : 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1200&q=85');

  const targetWebsite = affiliate.website || affiliate.webUrl || 'https://rabbitty.me';
  const formattedWebUrl = targetWebsite.startsWith('http')
    ? targetWebsite
    : `https://${targetWebsite}`;

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

        {/* Central Floating Pill */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: isScrolled ? 1 : 0, y: isScrolled ? 0 : -6 }}
          transition={{ duration: 0.2 }}
          className="bg-white/5 border border-white/10 px-4 py-1 rounded-full flex flex-col items-center justify-center max-w-[65%] pointer-events-auto"
        >
          <span className="font-black text-xs text-white leading-tight truncate w-full text-center">
            {affiliate.name}
          </span>
          <span className="text-[9px] font-bold text-[#E91E63] uppercase tracking-wider">
            {affiliate.category || 'Negocio'}
          </span>
        </motion.div>

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

        {/* Floating Bunz Reward Badge */}
        <div className="absolute bottom-10 right-5">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', delay: 0.15 }}
            className="bg-linear-to-r from-[#E91E63] to-[#AD1457] text-white px-4 py-2 rounded-full flex items-center gap-2 shadow-xl shadow-[#E91E63]/30 border-2 border-white/20"
          >
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="font-black text-lg">+{affiliate.rewardPercentage}%</span>
            <span className="font-bold text-xs opacity-90">BUNZ</span>
          </motion.div>
        </div>

        {/* Table indicator badge if seated */}
        {tableNumber && (
          <div className="absolute bottom-10 left-5">
            <button
              onClick={() => setShowTableSheet(true)}
              className="bg-emerald-500/90 backdrop-blur-md text-white px-3.5 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-black shadow-lg border border-white/20 active:scale-95 transition-transform"
            >
              <Utensils size={14} />
              <span>Mesa #{tableNumber}</span>
            </button>
          </div>
        )}
      </div>

      {/* Content Container (Card Overlap) */}
      <div className="relative bg-[#0D0D15] rounded-t-[36px] -mt-8 px-6 pt-7 pb-20 border-t border-white/10 shadow-2xl space-y-6">
        {/* Title, Category & Verification */}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-black tracking-tight text-white leading-tight">
              {affiliate.name}
            </h1>
          </div>
          <p className="text-xs font-black text-[#E91E63] uppercase tracking-wider mt-1.5 flex items-center gap-2">
            <span>{affiliate.category}</span>
            <span className="text-white/30">•</span>
            <span className="text-emerald-400 font-bold lowercase">
              {affiliate.startTime} - {affiliate.endTime}
            </span>
          </p>
        </div>

        {/* Action Quick Links (Minimalist, integrated sleek action bar) */}
        <div className="flex items-center justify-around py-2 px-1 bg-white/[0.03] border border-white/8 rounded-2xl backdrop-blur-md">
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => setShowMapSelector(true)}
            className="flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-colors hover:bg-white/5 active:opacity-80 border-none bg-transparent cursor-pointer"
          >
            <div className="w-9 h-9 rounded-full bg-[#E91E63]/12 text-[#E91E63] border border-[#E91E63]/25 flex items-center justify-center">
              <Navigation size={16} />
            </div>
            <span className="text-[10px] font-bold text-white/80 tracking-tight">Llegar</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => {
              PlatformBridge.hapticFeedback('medium');
              setShowMoodCheckIn(true);
            }}
            className="flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-colors hover:bg-white/5 active:opacity-80 border-none bg-transparent cursor-pointer"
          >
            <div className="w-9 h-9 rounded-full bg-amber-500/12 text-amber-400 border border-amber-500/25 flex items-center justify-center">
              <Sparkles size={16} />
            </div>
            <span className="text-[10px] font-bold text-amber-400 tracking-tight">Mood</span>
          </motion.button>

          {capabilities.tableServiceEnabled && tables.length > 0 && (
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => setShowTableSheet(true)}
              className="flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-colors hover:bg-white/5 active:opacity-80 border-none bg-transparent cursor-pointer"
            >
              <div className="w-9 h-9 rounded-full bg-purple-500/12 text-purple-400 border border-purple-500/25 flex items-center justify-center">
                <QrCode size={16} />
              </div>
              <span className="text-[10px] font-bold text-white/80 tracking-tight">
                {tableNumber ? `#${tableNumber}` : 'Mesa'}
              </span>
            </motion.button>
          )}

          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => setShowMessageSelector(true)}
            className="flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-colors hover:bg-white/5 active:opacity-80 border-none bg-transparent cursor-pointer"
          >
            <div className="w-9 h-9 rounded-full bg-orange-500/12 text-orange-400 border border-orange-500/25 flex items-center justify-center">
              <MessageCircle size={16} />
            </div>
            <span className="text-[10px] font-bold text-white/80 tracking-tight">Mensaje</span>
          </motion.button>
        </div>

        {/* Interactive Segmented Experience Tabs (2 tabs, perfectly balanced) */}
        <div className="sticky top-[calc(max(var(--safe-top,0px),env(safe-area-inset-top,0px))+56px)] z-30 -mx-2 px-2 py-2 bg-[#0D0D15]/95 backdrop-blur-xl">
          <div className="grid grid-cols-2 p-1 bg-[#161622] rounded-2xl border border-white/10 shadow-lg">
            <button
              onClick={() => {
                PlatformBridge.hapticFeedback('light');
                setActiveTab('menu');
              }}
              className={`py-2.5 rounded-xl text-xs font-black tracking-wide transition-all flex items-center justify-center gap-2 ${
                activeTab === 'menu'
                  ? 'bg-[#E91E63] text-white shadow-md shadow-[#E91E63]/30'
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
              className={`py-2.5 rounded-xl text-xs font-black tracking-wide transition-all flex items-center justify-center gap-2 ${
                activeTab === 'info'
                  ? 'bg-[#E91E63] text-white shadow-md shadow-[#E91E63]/30'
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
            {/* Table context banner if seated */}
            {tableNumber && (
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl flex items-center justify-between text-xs text-emerald-400">
                <div className="flex items-center gap-2 font-bold">
                  <Utensils size={16} />
                  <span>Estás ordenando en la Mesa #{tableNumber}</span>
                </div>
                <button
                  onClick={() => setShowTableSheet(true)}
                  className="text-[11px] underline font-extrabold text-emerald-300"
                >
                  Cambiar
                </button>
              </div>
            )}

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
                  <p className="text-xs text-white/50 mt-0.5">A {affiliate.distance || '1.0km'} de ti</p>
                </div>
              </div>

              <div className="h-px bg-white/5" />

              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-emerald-400 shrink-0">
                  <Clock size={18} />
                </div>
                <div>
                  <p className="font-bold text-sm text-white flex items-center gap-2">
                    Abierto Hoy <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  </p>
                  <p className="text-xs text-white/50 mt-0.5">
                    {affiliate.startTime} - {affiliate.endTime}
                  </p>
                </div>
              </div>

              {/* Website Link Action */}
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

            {/* About text */}
            <div className="space-y-2">
              <h3 className="text-sm font-black uppercase tracking-wider text-white">Acerca de</h3>
              <p className="text-xs text-white/70 leading-relaxed">
                {affiliate.description ||
                  'Este establecimiento forma parte de la red de comercios oficiales afiliados a Rabbitty Rewards.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Persistent Bottom Bar (Cart / Scan) with dynamic push-down on scroll */}
      <div
        className={`fixed left-0 right-0 px-4 z-40 pointer-events-none transition-all duration-300 ease-out ${
          isNavVisible
            ? 'bottom-[calc(max(var(--safe-bottom,0px),env(safe-area-inset-bottom,0px))+76px)]'
            : 'bottom-[calc(max(var(--safe-bottom,0px),env(safe-area-inset-bottom,0px))+14px)]'
        }`}
      >
        <div className="max-w-md mx-auto pointer-events-auto">
          {totalCartCount > 0 ? (
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
                  <span className="block font-black text-sm leading-tight">Ver orden en mesa</span>
                  <span className="text-[10px] text-white/80 font-medium">Revisa tus productos agregados</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 bg-black/20 py-1.5 px-3 rounded-xl border border-white/10">
                <span className="text-xs font-black">Continuar</span>
                <ChevronRight size={16} />
              </div>
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                PlatformBridge.hapticFeedback('medium');
                router.push('/scan');
              }}
              className="w-full bg-linear-to-r from-[#E91E63] to-[#FF4081] text-white py-3 px-4 rounded-full font-black text-xs sm:text-sm shadow-[0_6px_20px_rgba(233,30,99,0.4)] border border-white/20 flex items-center justify-center gap-2 transition-all active:brightness-95"
            >
              <Tag size={16} className="shrink-0" />
              <span className="truncate">Escanear en caja y ganar +{affiliate.rewardPercentage}% Bunz</span>
            </motion.button>
          )}
        </div>
      </div>

      {/* Sheets & Modals */}
      <TableContextSheet
        isOpen={showTableSheet}
        onClose={() => setShowTableSheet(false)}
        tables={tables}
        currentTableNumber={tableNumber}
        onSelectTable={(num, id) => {
          setTableNumber(num);
          setTableId(id);
          showToast(`Ubicado en Mesa #${num}`, 'success');
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
      />

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
                  window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
                  setShowMapSelector(false);
                }}
                className="w-full bg-[#1E1E24] text-white p-4 rounded-2xl border border-white/10 font-bold text-sm flex items-center gap-3 text-left"
              >
                🗺️ Abrir en Google Maps
              </button>
              <button
                onClick={() => {
                  const query = encodeURIComponent(`${affiliate.name} ${affiliate.address || ''}`);
                  window.open(`https://waze.com/ul?q=${query}&navigate=yes`, '_blank');
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
                    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
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
              onClick={() => window.open(formattedWebUrl, '_blank')}
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
