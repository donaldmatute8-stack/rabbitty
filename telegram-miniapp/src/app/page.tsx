'use client';

import { useEffect, useState, useMemo, useRef, useCallback, useSyncExternalStore } from 'react';
import { motion } from 'framer-motion';
import { Bell, Sparkles, ChevronRight } from 'lucide-react';
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
import { openBunzy } from '@/lib/bunzyLaunch';
import { MoodCheckInSheet } from '@/components/mood/MoodCheckInSheet';

const InteractiveMap = dynamic(() => import('@/features/map/InteractiveMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-(--bg-primary) flex items-center justify-center">
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
  const [moodOpen, setMoodOpen] = useState(false);
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

    // Auto-prompt Rabbitty Mood una vez al día tras 1.2 segundos (si no fue descartado hoy)
    try {
      const today = new Date().toISOString().slice(0, 10);
      const dismissed = localStorage.getItem('rabbitty_mood_dismissed_date');
      if (dismissed !== today) {
        const timer = setTimeout(() => {
          setMoodOpen(true);
        }, 1200);
        return () => clearTimeout(timer);
      }
    } catch {}
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
    const startedAt = performance.now();
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
      const elapsed = performance.now() - startedAt;
      if (elapsed < 700) {
        await new Promise((r) => setTimeout(r, 700 - elapsed));
      }
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    queueMicrotask(() => { fetchFeedData(); });
  }, [fetchFeedData]);

  // Refresh disparado por el botón "Ra" del menú inferior: sube al inicio y recarga
  const handleRefresh = useCallback(() => {
    const se = (document.scrollingElement || document.documentElement) as HTMLElement;
    const prevBehavior = se.style.scrollBehavior;
    se.style.scrollBehavior = 'auto';
    se.scrollTop = 0;
    document.body.scrollTop = 0;
    window.scrollTo(0, 0);
    se.style.scrollBehavior = prevBehavior;
    requestAnimationFrame(() => {
      se.scrollTop = 0;
      window.scrollTo(0, 0);
    });
    PlatformBridge.hapticFeedback('light');
    fetchFeedData();
  }, [fetchFeedData]);

  useEffect(() => {
    window.addEventListener('rabbitty:refresh-feed', handleRefresh);
    return () => window.removeEventListener('rabbitty:refresh-feed', handleRefresh);
  }, [handleRefresh]);

  // Pull-to-refresh (deslizar hacia abajo en el inicio) -> muestra el loader del conejo
  useEffect(() => {
    let startY = 0;
    let armed = false;
    const onStart = (e: TouchEvent) => {
      armed = (window.scrollY || 0) <= 0 && e.touches.length === 1;
      if (armed) startY = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (!armed || e.touches.length !== 1) return;
      if (e.touches[0].clientY - startY > 90) {
        armed = false;
        handleRefresh();
      }
    };
    const onEnd = () => { armed = false; };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [handleRefresh]);

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
      className="page-wrap pb-16 relative overflow-x-hidden min-h-screen"
      style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', transition: 'background 0.5s' }}
    >
      {/* Contenedor animado con efecto X/Twitter al abrir el Drawer lateral */}
      <motion.div
        animate={{
          scale: drawerOpen ? 0.93 : 1,
          x: drawerOpen ? '55%' : 0,
          borderRadius: drawerOpen ? 24 : 0,
          filter: drawerOpen ? 'brightness(0.7)' : 'none',
        }}
        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
        style={{
          transformOrigin: 'center left',
          willChange: 'transform',
          minHeight: '100vh',
          background: 'var(--bg-primary)',
          overflow: drawerOpen ? 'hidden' : 'visible',
          pointerEvents: drawerOpen ? 'none' : 'auto',
        }}
      >
      {/* HEADER COMPLETO INICIAL: Se desplaza naturalmente con el scroll (ya no está fixed/sticky constante) */}
      <div
        className="w-full relative z-40"
        style={{
          background: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border-subtle)',
          paddingTop: 'var(--safe-top, 0px)',
        }}
      >
        {/* Fila Perfil / Saludo + Bunz + Bell + Scan (o Flecha de volver en modo Freehands) */}
        <div className="flex items-center justify-between px-5 pt-2 pb-2">
          {activeTab === 'Freehands' ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  PlatformBridge.hapticFeedback('light');
                  setActiveTab("bunz'in");
                }}
                className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer border-none active:scale-90 transition-transform"
                style={{ background: 'var(--bg-pressed)', color: 'var(--text-primary)' }}
                aria-label="Volver al feed"
              >
                <svg width="10" height="18" viewBox="0 0 10 18" fill="none">
                  <path d="M9 1L1 9L9 17" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div>
                <span className="text-[10px] font-black uppercase tracking-[1.5px] text-[#E91E63] block">Explorar Mapa</span>
                <h1 className="text-[17px] font-black m-0 leading-tight" style={{ color: 'var(--text-primary)' }}>Freehands</h1>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                PlatformBridge.hapticFeedback('light');
                setDrawerOpen(true);
              }}
              className="flex items-center gap-3 bg-transparent border-none cursor-pointer p-0 text-left active:scale-[0.98] transition-transform"
            >
              <div className="w-11 h-11 rounded-full overflow-hidden" style={{ background: 'var(--bg-pressed)', border: '1px solid var(--border-subtle)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${user?.firstName || 'Rabbitty'}&backgroundColor=E91E63`} alt={user?.firstName || 'User'} className="w-full h-full" />
              </div>
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.5px] mb-0.5" style={{ color: 'var(--text-muted)' }}>{greeting}</p>
                <h1 className="text-[19px] font-black tracking-[-0.5px] m-0" style={{ color: 'var(--text-primary)' }}>{user?.firstName || 'Explorador'}</h1>
              </div>
            </button>
          )}

          <div className="flex items-center gap-2.5">
            <div className="px-3 py-1.5 rounded-full flex items-baseline gap-1" style={{ background: 'var(--bg-pressed)', border: '1px solid var(--border-subtle)' }}>
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
              <div className="absolute top-2 right-2.25 w-1.5 h-1.5 bg-[#E91E63] rounded-full" style={{ border: '1.5px solid var(--bg-elevated)' }} />
            </Link>

            {/* Rabbitty Mood Trigger */}
            <button
              type="button"
              onClick={() => {
                PlatformBridge.hapticFeedback('medium');
                setMoodOpen(true);
              }}
              className="w-9 h-9 rounded-full flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.04)] active:scale-95 transition-transform bg-linear-to-tr from-amber-500/20 to-orange-500/20 border border-amber-400/30 text-amber-400"
              aria-label="Rabbitty Mood"
              title="Tu vibra y experiencia de hoy"
            >
              <Sparkles size={16} strokeWidth={2.5} />
            </button>

            <Link 
              href="/chat/bot" 
              onClick={(e) => { e.preventDefault(); PlatformBridge.hapticFeedback('medium'); openBunzy(); }}
              className="w-9 h-9 rounded-full flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.04)] active:scale-95 transition-transform" 
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
              aria-label="Hablar con Bunzy"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src="/logo_conejo.png" 
                alt="Bunzy" 
                className="w-4 h-5 object-contain"
                style={{ filter: isDark ? 'grayscale(100%) brightness(10)' : 'grayscale(100%) brightness(0)' }} 
              />
            </Link>
          </div>
        </div>

        {activeTab !== 'Freehands' && (
          <Tabs 
            tabs={TABS} 
            activeTab={activeTab} 
            onChange={(tab) => {
              PlatformBridge.hapticFeedback('light');
              setActiveTab(tab);
            }} 
            isDark={isDark} 
          />
        )}
      </div>

      {/* NAVBAR SUPERIOR MINIMALISTA FLOTANTE (ESTILO FACEBOOK):
          Aparece solo al hacer scroll hacia arriba y permanece oculto al bajar */}
      {activeTab !== 'Freehands' && (
      <div
        className="fixed top-0 left-0 right-0 z-80 transition-all duration-300 ease-out select-none"
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
        <div className="flex items-center justify-between max-w-150 mx-auto px-4 py-2">
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
              <div className="absolute top-1.5 right-1.75 w-1.25 h-1.25 bg-[#E91E63] rounded-full" />
            </Link>

            <Link 
              href="/chat/bot" 
              onClick={(e) => { e.preventDefault(); PlatformBridge.hapticFeedback('medium'); openBunzy(); }}
              className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-transform" 
              style={{ background: 'var(--bg-pressed)' }}
              aria-label="Hablar con Bunzy"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src="/logo_conejo.png" 
                alt="Bunzy" 
                className="w-3.5 h-4 object-contain"
                style={{ filter: isDark ? 'grayscale(100%) brightness(10)' : 'grayscale(100%) brightness(0)' }} 
              />
            </Link>
          </div>
        </div>
      </div>
      )}

      <main className="flex-1 w-full max-w-150 mx-auto" style={{ paddingLeft: isDark ? 0 : 16, paddingRight: isDark ? 0 : 16 }}>
        <div className="pt-4">

          {/* Loader del conejo (global, se muestra al actualizar desde cualquier pestaña) */}
          {loading && !(activeTab === "bunz'in") && (
            <div className="mb-2">
              <RabbittyContourLoader size={54} label="Actualizando..." />
            </div>
          )}

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

              {/* Rabbitty Vibe Passport Quick Banner */}
              <div className="px-1 mt-3">
                <Link
                  href="/discover"
                  onClick={() => PlatformBridge.hapticFeedback('light')}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-linear-to-r from-amber-500/15 via-orange-500/10 to-transparent border border-amber-500/25 active:scale-[0.98] transition-transform no-underline"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-lg shrink-0">
                      🧭
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-white">Rabbitty Vibe Passport</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 font-bold uppercase tracking-wider">
                          Nuevo
                        </span>
                      </div>
                      <p className="text-[11px] text-white/60 m-0 leading-tight mt-0.5">
                        Explora rutas temáticas urbanas y sella tus visitas
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-amber-400/80 shrink-0" />
                </Link>
              </div>

              {!loading && postsWithDistance.length > 0 && (
                <div className="flex items-center gap-3 mb-4 mt-2">
                  <div className="flex-1 h-px bg-(--border-subtle)" />
                  <span className="text-[11px] font-black text-(--text-muted) tracking-[0.5px]">COMERCIOS CERCA DE TI</span>
                  <div className="flex-1 h-px bg-(--border-subtle)" />
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
                  className="w-full bg-(--bg-elevated) border border-(--border-subtle) rounded-full py-3 px-4 pl-10 text-sm text-(--text-primary) placeholder:text-(--text-muted) outline-none box-border"
                  style={{ fontFamily: 'var(--font-family-base)' }}
                />
              </div>

              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[17px] font-black text-(--text-primary) m-0">Ofertas Disponibles</h2>
                {offers.length > 0 && (
                  <span className="text-xs font-bold text-[#E91E63]">
                    {offers.filter(o => o.isAvailable).length} activas
                  </span>
                )}
              </div>

              {loading ? (
                <SkeletonCard />
              ) : offers.length === 0 ? (
                <div className="bg-(--bg-elevated) rounded-[20px] p-6 text-center border-2 border-dashed border-(--border-subtle)">
                  <p className="font-bold text-(--text-secondary) mb-1">No hay ofertas disponibles</p>
                  <p className="text-xs text-(--text-muted) m-0">Los negocios subirán certificados de regalo pronto.</p>
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
                        className="bg-(--bg-elevated) rounded-[22px] overflow-hidden border border-(--border-subtle) shadow-[0_2px_12px_rgba(0,0,0,0.3)] relative"
                        style={{ opacity: o.isAvailable ? 1 : 0.55, filter: o.isAvailable ? 'none' : 'grayscale(1)' }}
                      >
                        {/* Ticket notch */}
                        <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-(--bg-primary) rounded-full border border-(--border-subtle)" />
                        <div className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-(--bg-primary) rounded-full border border-(--border-subtle)" />

                        <div className="p-5">
                          <div className="flex items-start gap-4 mb-4">
                            {o.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={o.image} alt={o.title} className="w-14 h-14 rounded-2xl object-cover shrink-0 shadow-[0_2px_8px_rgba(0,0,0,0.4)]" />
                            ) : (
                              <div className="w-14 h-14 rounded-2xl bg-(--bg-pressed) border border-(--border-subtle) flex items-center justify-center text-2xl shrink-0">🏪</div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-black text-[#E91E63] tracking-[0.5px] uppercase mb-1">{o.businessName}</p>
                              <p className="font-black text-(--text-primary) text-base leading-[1.2] mb-1">{o.title}</p>
                              <p className="text-xs text-(--text-muted) leading-normal m-0 line-clamp-2">{o.description}</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-4 border-t border-dashed border-(--border-subtle)">
                            <div>
                              <p className="text-[9px] font-black text-(--text-muted) tracking-[0.5px] uppercase mb-0.5">Costo</p>
                              <div className="flex items-baseline gap-1">
                                <span className="text-[22px] font-black text-(--text-primary)">{o.bunzCost}</span>
                                <span className="text-[13px] font-bold text-[#E91E63]">bunz</span>
                              </div>
                            </div>
                            <button
                              disabled={!o.isAvailable || purchasing}
                              onClick={() => handleSpend(o.id, o.bunzCost, o.businessName, o.title)}
                              className="text-[13px] font-black px-5 py-2.5 rounded-full border-none"
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
              className="fixed left-0 right-0 bottom-0 z-10 overflow-hidden bg-black flex items-center justify-center"
              style={{ top: 'calc(max(var(--safe-top, 0px), 8px) + 56px)' }}
            >
              {/* Holographic Toggle */}
              <div 
                className="absolute z-2000 flex bg-white/5 backdrop-blur-[10px] rounded-full border border-white/10 p-1" 
                style={{ top: PlatformBridge.isTelegram() ? 70 : 14, right: 64 }}
              >
                <button
                  onClick={() => setMapMode('globe')}
                  className="px-3 py-1 rounded-full text-[11px] font-bold border-none cursor-pointer"
                  style={{ background: mapMode === 'globe' ? 'rgba(233,30,99,0.2)' : 'transparent', color: mapMode === 'globe' ? '#E91E63' : '#888', transition: 'all 0.3s' }}
                >
                  Globo 3D
                </button>
                <button
                  onClick={() => setMapMode('flat')}
                  className="px-3 py-1 rounded-full text-[11px] font-bold border-none cursor-pointer"
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
      </motion.div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}} />

      {activeTab !== 'Freehands' && <BottomNav isDark={isDark} />}
      <ProfileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <MoodCheckInSheet isOpen={moodOpen} onClose={() => setMoodOpen(false)} />
    </div>
  );
}
