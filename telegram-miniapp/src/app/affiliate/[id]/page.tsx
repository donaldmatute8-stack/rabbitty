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
import { useState, useEffect, useMemo, Suspense } from 'react';
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
  tables: Array<{ id: string; number: number; qrCode?: string | null }>;
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
  const [tables, setTables] = useState<Array<{ id: string; number: number; qrCode?: string | null }>>([]);
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
  const [activeTab, setActiveTab] = useState<'menu' | 'info' | 'experiences'>('menu');
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

  // Header scroll detection
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 150);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
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
    parsedGallery.length > 0
      ? parsedGallery[0]
      : 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80';

  const targetWebsite = affiliate.website || affiliate.webUrl || 'https://rabbitty.me';
  const formattedWebUrl = targetWebsite.startsWith('http')
    ? targetWebsite
    : `https://${targetWebsite}`;

  return (
    <div className="bg-[#0D0D15] min-h-screen pb-36 relative text-white">
      {/* Floating Dynamic Header */}
      <div className="fixed top-0 left-0 right-0 z-50 pt-[calc(max(var(--safe-top,0),env(safe-area-inset-top,0))+12px)] pb-3 px-4 flex items-center justify-between pointer-events-none">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="w-11 h-11 rounded-full bg-[#14141A]/75 text-white flex items-center justify-center border border-white/15 backdrop-blur-xl shadow-xl pointer-events-auto active:scale-90 transition-transform"
          aria-label="Volver atrás"
        >
          <ChevronLeft size={22} />
        </button>

        {/* Central Floating Pill */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: isScrolled ? 1 : 0, y: isScrolled ? 0 : -10 }}
          transition={{ duration: 0.2 }}
          className="bg-[#181820]/90 backdrop-blur-xl border border-white/15 px-4 py-1.5 rounded-full flex flex-col items-center justify-center shadow-xl max-w-[62%] pointer-events-auto"
        >
          <span className="font-black text-sm text-white leading-tight truncate w-full text-center">
            {affiliate.name}
          </span>
          <span className="text-[10px] font-bold text-[#E91E63] uppercase tracking-wider">
            {affiliate.category || 'Negocio'}
          </span>
        </motion.div>

        {/* Top Right Quick Actions (Share + Favorite) */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => {
              PlatformBridge.hapticFeedback('light');
              setIsFavorite(!isFavorite);
              showToast(isFavorite ? 'Eliminado de favoritos' : '¡Guardado en tus favoritos!', 'success');
            }}
            className="w-11 h-11 rounded-full bg-[#14141A]/75 text-white flex items-center justify-center border border-white/15 backdrop-blur-xl shadow-xl active:scale-90 transition-transform"
            aria-label="Favorito"
          >
            <Heart size={18} className={isFavorite ? 'fill-[#E91E63] text-[#E91E63]' : 'text-white/80'} />
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
            className="w-11 h-11 rounded-full bg-[#14141A]/75 text-white flex items-center justify-center border border-white/15 backdrop-blur-xl shadow-xl active:scale-90 transition-transform"
            aria-label="Compartir"
          >
            <Share2 size={18} />
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

        {/* Action Quick Links */}
        <div className="grid grid-cols-4 gap-2.5">
          <motion.div
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowMapSelector(true)}
            className="bg-[#161622] rounded-2xl p-3 flex flex-col items-center gap-1.5 border border-white/10 cursor-pointer shadow-sm"
          >
            <div className="bg-[#E91E63]/15 text-[#E91E63] p-2.5 rounded-xl">
              <Navigation size={18} />
            </div>
            <span className="text-[11px] font-black text-white">Llegar</span>
          </motion.div>

          <motion.div
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              PlatformBridge.hapticFeedback('medium');
              setShowMoodCheckIn(true);
            }}
            className="bg-amber-500/10 rounded-2xl p-3 flex flex-col items-center gap-1.5 border border-amber-500/20 cursor-pointer shadow-sm"
          >
            <div className="bg-amber-500/20 text-amber-400 p-2.5 rounded-xl">
              <Sparkles size={18} />
            </div>
            <span className="text-[11px] font-black text-amber-400">Mood</span>
          </motion.div>

          <motion.div
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              if (capabilities.tableServiceEnabled) {
                setShowTableSheet(true);
              } else {
                router.push('/scan');
              }
            }}
            className="bg-[#161622] rounded-2xl p-3 flex flex-col items-center gap-1.5 border border-white/10 cursor-pointer shadow-sm"
          >
            <div className="bg-purple-500/15 text-purple-400 p-2.5 rounded-xl">
              <QrCode size={18} />
            </div>
            <span className="text-[11px] font-black text-white">
              {tableNumber ? `Mesa #${tableNumber}` : 'Mesa QR'}
            </span>
          </motion.div>

          <motion.div
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowMessageSelector(true)}
            className="bg-[#161622] rounded-2xl p-3 flex flex-col items-center gap-1.5 border border-white/10 cursor-pointer shadow-sm"
          >
            <div className="bg-orange-500/15 text-orange-400 p-2.5 rounded-xl">
              <MessageCircle size={18} />
            </div>
            <span className="text-[11px] font-black text-white">Mensaje</span>
          </motion.div>
        </div>

        {/* Interactive Segmented Experience Tabs */}
        <div className="flex p-1 bg-[#161622] rounded-2xl border border-white/10">
          <button
            onClick={() => setActiveTab('menu')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black tracking-wide transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'menu'
                ? 'bg-[#E91E63] text-white shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Utensils size={14} />
            <span>Menú y Servicios</span>
          </button>
          <button
            onClick={() => setActiveTab('experiences')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black tracking-wide transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'experiences'
                ? 'bg-[#E91E63] text-white shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Sparkles size={14} />
            <span>Rabbitty Mood</span>
          </button>
          <button
            onClick={() => setActiveTab('info')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black tracking-wide transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'info'
                ? 'bg-[#E91E63] text-white shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Layers size={14} />
            <span>Sucursal</span>
          </button>
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

        {/* Tab 2: Rabbitty Mood & Experiencias */}
        {activeTab === 'experiences' && (
          <div className="space-y-5">
            <div className="p-5 bg-linear-to-br from-amber-500/15 via-[#161622] to-purple-500/10 rounded-3xl border border-amber-500/20 space-y-3">
              <div className="flex items-center gap-2.5 text-amber-400">
                <Sparkles size={18} />
                <h3 className="text-sm font-black uppercase tracking-wider">
                  Atmósfera & Pairing de la Casa
                </h3>
              </div>
              <p className="text-xs text-white/70 leading-relaxed">
                Rabbitty analiza la energía en tiempo real de este local para sugerirte las mejores horas de visita, música sugerida y maridajes del chef.
              </p>
              <div className="pt-2 flex gap-2">
                <button
                  onClick={() => setShowMoodCheckIn(true)}
                  className="bg-amber-500 text-black px-4 py-2 rounded-xl text-xs font-black shadow-lg shadow-amber-500/20 active:scale-95 transition-transform"
                >
                  Registrar Check-In de Vibe
                </button>
              </div>
            </div>

            {/* Happy Hour Bonus */}
            <div className="p-5 bg-linear-to-br from-[#E91E63]/15 to-[#AD1457]/10 rounded-3xl border border-[#E91E63]/25 space-y-2">
              <h4 className="text-sm font-black text-[#FF4081] flex items-center gap-2">
                <Tag size={16} /> Happy Hour de Bunz
              </h4>
              <p className="text-xs text-white/70 leading-relaxed">
                Escanea tu ticket de compra durante el horario oficial ({affiliate.startTime} a {affiliate.endTime}) para llevarte hasta <strong>+{affiliate.rewardPercentage}%</strong> en recompensas de lealtad.
              </p>
            </div>
          </div>
        )}

        {/* Tab 3: Sucursal, Ubicación, Galería & Acerca de */}
        {activeTab === 'info' && (
          <div className="space-y-5">
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

      {/* Persistent Bottom Bar (Cart / Scan) */}
      <div className="fixed bottom-[calc(max(env(safe-area-inset-bottom,0),12px)+72px)] left-0 right-0 px-5 z-40 pointer-events-none">
        <div className="max-w-lg mx-auto pointer-events-auto flex gap-3">
          {totalCartCount > 0 ? (
            <button
              onClick={() => {
                PlatformBridge.hapticFeedback('medium');
                setShowCartSheet(true);
              }}
              className="flex-1 bg-linear-to-r from-[#E91E63] to-[#FF4081] text-white py-4 px-5 rounded-2xl font-black text-sm shadow-xl shadow-[#E91E63]/40 flex items-center justify-between active:scale-98 transition-transform"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-white text-[#E91E63] flex items-center justify-center text-xs font-black">
                  {totalCartCount}
                </div>
                <span>Ver tu pedido</span>
              </div>
              <div className="flex items-center gap-1">
                <ChevronRight size={18} />
              </div>
            </button>
          ) : (
            <button
              onClick={() => {
                PlatformBridge.hapticFeedback('medium');
                router.push('/scan');
              }}
              className="flex-1 bg-linear-to-r from-[#E91E63] to-[#FF4081] text-white py-4 px-5 rounded-2xl font-black text-sm shadow-xl shadow-[#E91E63]/30 flex items-center justify-center gap-2 active:scale-98 transition-transform"
            >
              <Tag size={18} />
              <span>Escanear en caja y ganar +{affiliate.rewardPercentage}% Bunz</span>
            </button>
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
