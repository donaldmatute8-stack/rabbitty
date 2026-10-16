'use client';

import { useEffect, useState, useMemo, useRef, useCallback, useSyncExternalStore } from 'react';
import { motion } from 'framer-motion';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import BottomNav from '@/components/BottomNav';
import Tabs from '@/components/ui/Tabs';
import FeedCard from '@/components/ui/FeedCard';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useAuth } from '@/features/auth/AuthProvider';
import { Globe3D } from '@/components/ui/3d-globe';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';
import { PlatformBridge } from '@/lib/platform';
import MembershipCard from '@/components/ui/MembershipCard';
import ProfileDrawer from '@/components/ProfileDrawer';
import { useTheme } from '@/contexts/ThemeContext';
import RabbittyContourLoader from '@/components/ui/RabbittyContourLoader';

const InteractiveMap = dynamic(() => import('@/features/map/InteractiveMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-[var(--bg-primary)] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full" style={{ border: '2px solid rgba(233,30,99,0.3)', borderTopColor: '#E91E63', animation: 'spin 0.8s linear infinite' }} />
        <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>Cargando Mapa...</p>
      </div>
    </div>
  ),
});

interface FeedItem {
  id: string;
  user: string;
  device: string;
  time: string;
  label: string;
  bunz: number;
  imageUrl?: string;
  distance?: number;
  reward_percentage: number;
  logo_base64?: string;
  activeDays?: number[];
  startTime?: string;
  endTime?: string;
  lat?: number;
  lng?: number;
}

interface Offer {
  id: string;
  title: string;
  description?: string;
  image?: string;
  businessName: string;
  bunzCost: number;
  isAvailable: boolean;
}

const TABS = ["bunz'in", 'Stock', 'Freehands'];

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}


export default function FeedPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab && TABS.includes(tab)) return tab;
    }
    return "bunz'in";
  });
  const [posts, setPosts] = useState<FeedItem[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [purchasing, setPurchasing] = useState(false);
  const [mapMode, setMapMode] = useState<'globe' | 'flat'>('flat');
  const { showToast } = useToast();

  const { user } = useAuth();
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);

  const { isDark } = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const bunzBalance = (user?.totalBunzEarned || 0) - (user?.totalBunzSpent || 0);

  const greeting = useSyncExternalStore(
    () => () => {},
    () => {
      const hour = new Date().getHours();
      if (hour >= 5 && hour < 12) return 'Buenos días,';
      if (hour >= 12 && hour < 19) return 'Buenas tardes,';
      return 'Buenas noches,';
    },
    () => 'Buenos días,'
  );

  const handleSpend = async (offerId: string, bunzCost: number, businessName: string, offerTitle: string) => {
    if (user && bunzBalance < bunzCost) {
      showToast('No tienes suficientes Bunz para adquirir esta oferta.', 'error');
      return;
    }
    setPurchasing(true);
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      let initData = '';
      try {
        const mod = await import('@twa-dev/sdk');
        initData = mod.default?.initData || '';
      } catch {}
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          initData,
          businessName, 
          offerTitle, 
          bunzCost,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('¡Reserva creada exitosamente! Revisa el estatus en tu perfil.', 'success');
      }
      else showToast(data.error || 'Ocurrió un error al procesar la reserva.', 'error');
    } catch {
      showToast('Error de conexión.', 'error');
    } finally {
      setPurchasing(false);
    }
  };



  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude); },
        () => {},
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, []);

  useEffect(() => {
    import('@twa-dev/sdk').then((mod) => {
      const app = mod.default;
      app.ready(); app.expand();

      // --- DEEP LINKING (SEO Public Landing Pages) ---
      const startParam = app.initDataUnsafe?.start_param;
      if (startParam && startParam.startsWith('affiliate_')) {
        const affiliateId = startParam.split('affiliate_')[1];
        if (affiliateId) {
          router.push(`/affiliate/${affiliateId}`);
        }
      }

      // --- SEAMLESS TELEGRAM AUTH ---
      if (app.initData) {
        fetch('/api/auth/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            initData: app.initData,
            startParam: app.initDataUnsafe?.start_param
          })
        })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            console.log("🐰 Autenticación Rabbitty Exitosa:", data.user);
          }
        })
        .catch(err => console.error("Error en auth:", err));
      }
    });
  }, [router]);

  const postsWithDistance = useMemo(() => {
    if (!userLat || !userLng) return posts;
    return posts.map(post => {
      if (post.lat && post.lng) {
        const dist = getDistance(userLat, userLng, post.lat, post.lng);
        return { ...post, distance: parseFloat(dist.toFixed(1)) };
      }
      return post;
    });
  }, [posts, userLat, userLng]);

  const [showMinimalHeader, setShowMinimalHeader] = useState(false);
  const lastTopScrollY = useRef(0);
  const topDeltaAcc = useRef(0);

  const fetchFeedData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === "bunz'in" || activeTab === 'Freehands') {
        const res = await fetch('/api/feed');
        const data = await res.json();
        if (data.success) {
          setPosts(data.data);
        }
      } else if (activeTab === 'Stock') {
        const res = await fetch('/api/offers');
        const { success, offers: o } = await res.json();
        if (success) setOffers(o);
      }
    } catch (err) {
      console.error('[Feed] data fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    queueMicrotask(() => { fetchFeedData(); });
  }, [fetchFeedData]);

  useEffect(() => {
    const handleRefresh = () => {
      fetchFeedData();
    };
    window.addEventListener('rabbitty:refresh-feed', handleRefresh);
    return () => window.removeEventListener('rabbitty:refresh-feed', handleRefresh);
  }, [fetchFeedData]);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY || document.documentElement.scrollTop || 0;
      const diff = currentY - lastTopScrollY.current;

      // Si estamos muy arriba (en la zona del header inicial o tarjeta), ocultar la barra minimalista flotante
      if (currentY < 90) {
        setShowMinimalHeader(false);
        topDeltaAcc.current = 0;
        lastTopScrollY.current = currentY;
        return;
      }

      // Si hacemos scroll hacia abajo -> que todo permanezca oculto
      if (diff > 8) {
        topDeltaAcc.current += diff;
        if (topDeltaAcc.current > 20) {
          setShowMinimalHeader(false);
          topDeltaAcc.current = 0;
        }
      } else if (diff < -8) {
        // Si hacemos scroll hacia arriba -> mostrar la barra minimalista ajustada
        topDeltaAcc.current = 0;
        setShowMinimalHeader(true);
      }

      lastTopScrollY.current = currentY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div
      className="page-wrap pb-16"
      style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', transition: 'background 0.5s' }}
    >
      {/* HEADER COMPLETO INICIAL: Se desplaza naturalmente con el scroll (ya no está fixed/sticky constante) */}
      <div
        className="w-full relative z-[40]"
        style={{
          background: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border-subtle)',
          paddingTop: 'var(--safe-top, 0px)',
        }}
      >
        {/* Fila Perfil / Saludo + Bunz + Bell + Scan */}
        <div className="flex items-center justify-between px-5 pt-2 pb-2">
          <button
            type="button"
            onClick={() => {
              PlatformBridge.hapticFeedback('light');
              setDrawerOpen(true);
            }}
            className="flex items-center gap-3 bg-transparent border-none cursor-pointer p-0 text-left active:scale-[0.98] transition-transform"
          >
            <div className="w-11 h-11 rounded-full overflow-hidden" style={{ background: 'var(--bg-pressed)', border: '1px solid var(--border-subtle)' }}>
              <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${user?.firstName || 'Rabbitty'}&backgroundColor=E91E63`} alt={user?.firstName || 'User'} className="w-full h-full" />
            </div>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.5px] mb-[2px]" style={{ color: 'var(--text-muted)' }}>{greeting}</p>
              <h1 className="text-[19px] font-black tracking-[-0.5px] m-0" style={{ color: 'var(--text-primary)' }}>{user?.firstName || 'Explorador'}</h1>
            </div>
          </button>
          <div className="flex items-center gap-2.5">
            <div className="px-3 py-[6px] rounded-full flex items-baseline gap-1" style={{ background: 'var(--bg-pressed)', border: '1px solid var(--border-subtle)' }}>
              <span className="text-[15px] font-black" style={{ color: 'var(--text-primary)' }}>{bunzBalance.toLocaleString()}</span>
              <span className="text-[11px] font-black text-[#E91E63]">BUNZ</span>
            </div>
            
            {/* Notification Bell */}
            <Link 
              href="/notifications" 
              onClick={() => PlatformBridge.hapticFeedback('light')}
              className="relative w-9 h-9 rounded-full flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.04)] active:scale-95 transition-transform" 
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
            >
              <Bell size={18} strokeWidth={2.5} style={{ color: 'var(--text-primary)' }} />
              <div className="absolute top-2 right-[9px] w-[6px] h-[6px] bg-[#E91E63] rounded-full" style={{ border: '1.5px solid var(--bg-elevated)' }} />
            </Link>

            <Link 
              href="/scan" 
              onClick={() => PlatformBridge.hapticFeedback('medium')}
              className="w-9 h-9 rounded-full flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.04)] active:scale-95 transition-transform" 
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
            >
              <img 
                src="/logo_conejo.png" 
                alt="Scan" 
                className="w-4 h-5 object-contain"
                style={{ filter: isDark ? 'grayscale(100%) brightness(10)' : 'grayscale(100%) brightness(0)' }} 
              />
            </Link>
          </div>
        </div>
        <Tabs 
          tabs={TABS} 
          activeTab={activeTab} 
          onChange={(tab) => {
            PlatformBridge.hapticFeedback('light');
            setActiveTab(tab);
          }} 
          isDark={isDark} 
        />
      </div>

      {/* NAVBAR SUPERIOR MINIMALISTA FLOTANTE (ESTILO FACEBOOK):
          Aparece solo al hacer scroll hacia arriba y permanece oculto al bajar */}
      <div
        className="fixed top-0 left-0 right-0 z-[80] transition-all duration-300 ease-out select-none"
        style={{
          transform: showMinimalHeader ? 'translateY(0)' : 'translateY(-110%)',
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid var(--glass-border)',
          paddingTop: 'var(--safe-top, 0px)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
        }}
      >
        <div className="flex items-center justify-between max-w-[600px] mx-auto px-4 py-2">
          {/* 3/4 Horizontal: Los 3 menús compactos (bunz'in, Stock, Freehands) */}
          <div className="flex items-center gap-1.5 w-[75%] pr-2">
            {TABS.map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => {
                    PlatformBridge.hapticFeedback('light');
                    setActiveTab(tab);
                  }}
                  className="relative py-1.5 px-2.5 rounded-full text-[13px] font-bold tracking-tight transition-all active:scale-95 whitespace-nowrap"
                  style={{
                    background: isActive ? 'rgba(233, 30, 99, 0.18)' : 'transparent',
                    color: isActive ? '#E91E63' : 'var(--text-secondary)',
                    border: isActive ? '1px solid rgba(233, 30, 99, 0.35)' : '1px solid transparent',
                  }}
                >
                  {tab}
                </button>
              );
            })}
          </div>

          {/* 1/4 Horizontal: Iconos de Notificaciones + Mini Conejo Scan */}
          <div className="flex items-center justify-end gap-2 w-[25%]">
            <Link 
              href="/notifications" 
              onClick={() => PlatformBridge.hapticFeedback('light')}
              className="relative w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-transform" 
              style={{ background: 'var(--bg-pressed)' }}
            >
              <Bell size={16} strokeWidth={2.3} style={{ color: 'var(--text-primary)' }} />
              <div className="absolute top-1.5 right-[7px] w-[5px] h-[5px] bg-[#E91E63] rounded-full" />
            </Link>

            <Link 
              href="/scan" 
              onClick={() => PlatformBridge.hapticFeedback('medium')}
              className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-transform" 
              style={{ background: 'var(--bg-pressed)' }}
            >
              <img 
                src="/logo_conejo.png" 
                alt="Scan" 
                className="w-3.5 h-4 object-contain"
                style={{ filter: isDark ? 'grayscale(100%) brightness(10)' : 'grayscale(100%) brightness(0)' }} 
              />
            </Link>
          </div>
        </div>
      </div>

      <main className="flex-1 w-full max-w-[600px] mx-auto" style={{ paddingLeft: isDark ? 0 : 16, paddingRight: isDark ? 0 : 16 }}>
        <div className="pt-4">

          {/* ── bunz'in tab ── */}
          {activeTab === "bunz'in" && (
            <>
              {loading && (
                <div className="mb-2">
                  <RabbittyContourLoader size={54} label="Actualizando comercios..." />
                </div>
              )}

              {/* Digital Pass / Membership Card */}
              <div className="px-1">
                <MembershipCard user={user} levelName={user?.level?.name || '1'} isDark={isDark} />
              </div>

              {!loading && postsWithDistance.length > 0 && (
                <div className="flex items-center gap-3 mb-4 mt-2">
                  <div className="flex-1 h-px bg-[var(--border-subtle)]" />
                  <span className="text-[11px] font-black text-[var(--text-muted)] tracking-[0.5px]">COMERCIOS CERCA DE TI</span>
                  <div className="flex-1 h-px bg-[var(--border-subtle)]" />
                </div>
              )}
              {loading ? (
                <><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
              ) : postsWithDistance.length > 0 ? (
                postsWithDistance.map((post, i) => (
                  <FeedCard
                    key={post.id}
                    id={post.id}
                    user={post.user}
                    device={post.device}
                    label={post.distance ? `${post.distance}km` : post.label}
                    bunz={post.reward_percentage}
                    imageUrl={post.imageUrl}
                    index={i}
                  />
                ))
              ) : (
                <EmptyState
                  icon={<span className="text-4xl">🐇</span>}
                  title="Sin negocios aún"
                  description="No hay afiliados disponibles cerca de ti en este momento."
                />
              )}
            </>
          )}

          {/* ── Stock tab ── */}
          {activeTab === 'Stock' && (
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
              {/* Search */}
              <div className="relative mb-5">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2" width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ color: 'var(--text-muted)' }}>
                  <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <input
                  placeholder="Buscar negocios..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-full py-3 px-4 pl-10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none box-border"
                  style={{ fontFamily: 'var(--font-family-base)' }}
                />
              </div>

              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[17px] font-black text-[var(--text-primary)] m-0">Ofertas Disponibles</h2>
                {offers.length > 0 && (
                  <span className="text-xs font-bold text-[#E91E63]">
                    {offers.filter(o => o.isAvailable).length} activas
                  </span>
                )}
              </div>

              {loading ? (
                <SkeletonCard />
              ) : offers.length === 0 ? (
                <div className="bg-[var(--bg-elevated)] rounded-[20px] p-6 text-center border-2 border-dashed border-[var(--border-subtle)]">
                  <p className="font-bold text-[var(--text-secondary)] mb-1">No hay ofertas disponibles</p>
                  <p className="text-xs text-[var(--text-muted)] m-0">Los negocios subirán certificados de regalo pronto.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {offers
                    .filter(o =>
                      !searchQuery ||
                      o.businessName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      o.title?.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((o) => (
                      <div
                        key={o.id}
                        className="bg-[var(--bg-elevated)] rounded-[22px] overflow-hidden border border-[var(--border-subtle)] shadow-[0_2px_12px_rgba(0,0,0,0.3)] relative"
                        style={{ opacity: o.isAvailable ? 1 : 0.55, filter: o.isAvailable ? 'none' : 'grayscale(1)' }}
                      >
                        {/* Ticket notch */}
                        <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-[var(--bg-primary)] rounded-full border border-[var(--border-subtle)]" />
                        <div className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-[var(--bg-primary)] rounded-full border border-[var(--border-subtle)]" />

                        <div className="p-5">
                          <div className="flex items-start gap-4 mb-4">
                            {o.image ? (
                              <img src={o.image} alt={o.title} className="w-14 h-14 rounded-[16px] object-cover shrink-0 shadow-[0_2px_8px_rgba(0,0,0,0.4)]" />
                            ) : (
                              <div className="w-14 h-14 rounded-[16px] bg-[var(--bg-pressed)] border border-[var(--border-subtle)] flex items-center justify-center text-2xl shrink-0">🏪</div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-black text-[#E91E63] tracking-[0.5px] uppercase mb-1">{o.businessName}</p>
                              <p className="font-black text-[var(--text-primary)] text-base leading-[1.2] mb-1">{o.title}</p>
                              <p className="text-xs text-[var(--text-muted)] leading-[1.5] m-0 line-clamp-2">{o.description}</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-4 border-t border-dashed border-[var(--border-subtle)]">
                            <div>
                              <p className="text-[9px] font-black text-[var(--text-muted)] tracking-[0.5px] uppercase mb-[2px]">Costo</p>
                              <div className="flex items-baseline gap-1">
                                <span className="text-[22px] font-black text-[var(--text-primary)]">{o.bunzCost}</span>
                                <span className="text-[13px] font-bold text-[#E91E63]">bunz</span>
                              </div>
                            </div>
                            <button
                              disabled={!o.isAvailable || purchasing}
                              onClick={() => handleSpend(o.id, o.bunzCost, o.businessName, o.title)}
                              className="text-[13px] font-black px-5 py-[10px] rounded-full border-none"
                              style={{
                                background: o.isAvailable && !purchasing ? '#E91E63' : 'var(--bg-pressed)',
                                color: o.isAvailable && !purchasing ? '#fff' : 'var(--text-muted)',
                                cursor: o.isAvailable && !purchasing ? 'pointer' : 'not-allowed',
                              }}
                            >
                              {purchasing ? '...' : o.isAvailable ? 'Reservar' : 'Agotado Hoy'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Freehands tab ── */}
          {activeTab === 'Freehands' && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="fixed left-0 right-0 bottom-0 z-10 overflow-hidden bg-black"
              style={{ top: 'calc(max(var(--safe-top, 0px), 8px) + 104px)' }}
            >
              {/* Holographic Toggle */}
              <div 
                className="absolute z-[2000] flex bg-white/5 backdrop-blur-[10px] rounded-full border border-white/10 p-1" 
                style={{ top: PlatformBridge.isTelegram() ? 70 : 14, right: 64 }}
              >
                <button
                  onClick={() => setMapMode('globe')}
                  className="px-3 py-[4px] rounded-full text-[11px] font-bold border-none cursor-pointer"
                  style={{ background: mapMode === 'globe' ? 'rgba(233,30,99,0.2)' : 'transparent', color: mapMode === 'globe' ? '#E91E63' : '#888', transition: 'all 0.3s' }}
                >
                  Globo 3D
                </button>
                <button
                  onClick={() => setMapMode('flat')}
                  className="px-3 py-[4px] rounded-full text-[11px] font-bold border-none cursor-pointer"
                  style={{ background: mapMode === 'flat' ? 'rgba(255,255,255,0.1)' : 'transparent', color: mapMode === 'flat' ? '#FFF' : '#888', transition: 'all 0.3s' }}
                >
                  Local
                </button>
              </div>

              {mapMode === 'flat' ? (
                <div className="h-full w-full overflow-hidden">
                  <InteractiveMap businesses={postsWithDistance} userLat={userLat} userLng={userLng} />
                </div>
              ) : (
                <div className="h-full w-full relative flex items-center justify-center">
                  {loading ? (
                    <div className="w-10 h-10 rounded-full" style={{ border: '3px solid rgba(233,30,99,0.3)', borderTopColor: '#E91E63', animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <Globe3D 
                      markers={postsWithDistance.filter(p => p.lat && p.lng).map(p => ({ 
                        id: p.id,
                        lat: p.lat!, 
                        lng: p.lng!, 
                        label: p.user, 
                        src: p.logo_base64 || p.imageUrl 
                      }))} 
                      onMarkerClick={(m) => {
                        console.log("Clicked:", m.label);
                      }}
                    />
                  )}
                </div>
              )}
            </motion.div>
          )}

        </div>
      </main>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}} />

      <BottomNav isDark={isDark} />
      <ProfileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
