'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Bell, Sparkles, ChevronRight, Home } from 'lucide-react';
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
import { WelcomeRitual } from '@/components/ui/WelcomeRitual';
import { SmartBiometricPrompt } from '@/components/security/SmartBiometricPrompt';

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
  hops?: number;
  savedCount?: number;
  sharedCount?: number;
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
  const [posts, setPosts] = useState<FeedItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const cached = localStorage.getItem('rabbitty_feed_cache_v1');
      if (cached) return JSON.parse(cached);
    } catch {}
    return [];
  });
  const postsRef = useRef(posts);
  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(() => posts.length === 0);
  const [refreshKey, setRefreshKey] = useState(0);
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

    // Auto-prompt Rabbitty Mood moderado (máximo una vez cada 7 días, si ya vio el ritual de bienvenida)
    try {
      const lastShown = localStorage.getItem('rabbitty_mood_last_shown_time');
      const ritualSeen = localStorage.getItem('rabbitty_welcome_ritual_seen_v3');
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
      const now = Date.now();

      if (ritualSeen && (!lastShown || now - parseInt(lastShown, 10) > SEVEN_DAYS_MS)) {
        const timer = setTimeout(() => {
          setMoodOpen(true);
          try {
            localStorage.setItem('rabbitty_mood_last_shown_time', String(Date.now()));
          } catch {}
        }, 2000);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, []);

  useEffect(() => {
    import('@twa-dev/sdk').then((mod) => {
      try {
        const app = mod.default;
        if (app && typeof app.ready === 'function') {
          app.ready();
        }
        if (app && typeof app.expand === 'function') {
          app.expand();
        }

        // --- DEEP LINKING (SEO Public Landing Pages) ---
        const startParam = app?.initDataUnsafe?.start_param;
        if (startParam && startParam.startsWith('affiliate_')) {
          const affiliateId = startParam.split('affiliate_')[1];
          if (affiliateId) {
            router.push(`/affiliate/${affiliateId}`);
          }
        }

        // --- SEAMLESS TELEGRAM AUTH ---
        if (app?.initData) {
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
      } catch (err) {
        console.warn('[Telegram SDK] Ignored outside Telegram webview:', err);
      }
    }).catch(() => {});
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
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const measure = () => setHeaderHeight(Math.round(el.getBoundingClientRect().height));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeTab]);
  const lastTopScrollY = useRef(0);
  const topDeltaAcc = useRef(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        if (postsRef.current.length === 0) {
          setLoading(true);
        }
        if (activeTab === "bunz'in" || activeTab === 'Freehands') {
          const res = await fetch('/api/feed');
          if (res.ok) {
            const data = await res.json();
            if (active && data.success && Array.isArray(data.data)) {
              setPosts(data.data);
              try {
                localStorage.setItem('rabbitty_feed_cache_v1', JSON.stringify(data.data));
              } catch {}
            }
          }
        } else if (activeTab === 'Stock') {
          const res = await fetch('/api/offers');
          if (res.ok) {
            const { success, offers: o } = await res.json();
            if (active && success) setOffers(o);
          }
        }
      } catch (err) {
        console.error('[Feed] data fetch error:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [activeTab, refreshKey]);

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
    setRefreshKey((k) => k + 1);
  }, []);

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
      className="page-wrap pb-28 relative overflow-x-hidden min-h-screen"
      style={{
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        transition: 'background 0.5s',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* Contenedor animado con efecto X/Twitter al abrir el Drawer lateral */}
      <motion.div
        animate={drawerOpen ? {
          scale: 0.90,
          x: '74%',
          borderRadius: 36,
          filter: isDark ? 'brightness(0.65)' : 'brightness(0.97)',
        } : {
          scale: 1,
          x: 0,
          borderRadius: 0,
          filter: 'none',
        }}
        transition={{ type: 'spring', damping: 30, stiffness: 280 }}
        className="relative w-full"
        style={{
          transformOrigin: 'center left',
          background: 'var(--bg-primary)',
          pointerEvents: drawerOpen ? 'none' : 'auto',
          border: drawerOpen ? (isDark ? '1.5px solid rgba(255,255,255,0.18)' : '1.5px solid rgba(0,0,0,0.12)') : 'none',
          boxShadow: drawerOpen ? (isDark ? '-12px 0 45px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.08)' : '-10px 0 40px rgba(0,0,0,0.18)') : 'none',
        }}
      >
        {/* Indicador visual sutil de Home en la parte inferior derecha del borde de la pantalla principal */}
        {drawerOpen && (
          <div 
            className="absolute bottom-6 right-6 z-50 flex items-center justify-center w-9 h-9 rounded-full pointer-events-none select-none transition-all duration-300"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0.1)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.5)' : '0 4px 16px rgba(0,0,0,0.1)',
            }}
          >
            <Home size={16} strokeWidth={2.4} className={isDark ? 'text-white/80' : 'text-slate-800/80'} />
          </div>
        )}
      {/* HEADER COMPLETO INICIAL: Se desplaza naturalmente con el scroll (ya no está fixed/sticky constante) */}
      <div
        ref={headerRef}
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
            <>
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

              {/* Selector Globo 3D / Local estilizado en el Header */}
              <div 
                className="flex items-center bg-white/5 backdrop-blur-[10px] rounded-full border border-white/10 p-1"
              >
                <button
                  type="button"
                  onClick={() => {
                    PlatformBridge.hapticFeedback('light');
                    setMapMode('globe');
                  }}
                  className="px-3 py-1 rounded-full text-[11px] font-bold border-none cursor-pointer active:scale-95 transition-all"
                  style={{ background: mapMode === 'globe' ? 'rgba(233,30,99,0.25)' : 'transparent', color: mapMode === 'globe' ? '#E91E63' : '#888' }}
                >
                  Globo 3D
                </button>
                <button
                  type="button"
                  onClick={() => {
                    PlatformBridge.hapticFeedback('light');
                    setMapMode('flat');
                  }}
                  className="px-3 py-1 rounded-full text-[11px] font-bold border-none cursor-pointer active:scale-95 transition-all"
                  style={{ background: mapMode === 'flat' ? 'rgba(255,255,255,0.12)' : 'transparent', color: mapMode === 'flat' ? '#FFF' : '#888' }}
                >
                  Local
                </button>
              </div>
            </>
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
              <h1 className="sr-only">{user?.firstName || 'Rabbitty'}</h1>
            </button>
          )}

          <div className="flex items-center gap-2.5">
            
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
        className={`fixed top-0 left-0 right-0 z-80 transition-all duration-300 ease-out select-none ${
          showMinimalHeader ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
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

      <main className="flex-1 w-full max-w-150 mx-auto px-4">
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
              {/* Digital Pass / Membership Card */}
              <div className="px-1">
                <MembershipCard user={user} levelName={user?.level?.name || '1'} isDark={isDark} />
              </div>

              {/* Rabbitty Vibe Passport Quick Banner */}
              <div className="px-1 mt-1 mb-5">
                <Link
                  href="/discover"
                  onClick={() => PlatformBridge.hapticFeedback('light')}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border active:scale-[0.98] transition-all no-underline ${
                    isDark
                      ? 'bg-linear-to-r from-[#E91E63]/15 via-[#240C1A]/60 to-zinc-950/60 border-[#E91E63]/25 shadow-[0_4px_20px_rgba(233,30,99,0.08)]'
                      : 'bg-linear-to-r from-pink-50 via-rose-50/50 to-white border-pink-200 shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#E91E63]/15 text-[#E91E63] border border-[#E91E63]/30 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(233,30,99,0.25)]">
                      <Sparkles size={20} className="text-[#E91E63]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>Rabbitty Vibe Passport</span>
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#E91E63]/20 text-[#E91E63] font-black uppercase tracking-wider border border-[#E91E63]/30">
                          Nuevo
                        </span>
                      </div>
                      <p className={`text-[11px] m-0 leading-tight mt-0.5 ${isDark ? 'text-white/60' : 'text-slate-500'}`}>
                        Explora rutas temáticas urbanas y sella tus visitas
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-[#E91E63]/80 shrink-0" />
                </Link>
              </div>

              {postsWithDistance.length > 0 && (
                <div className="flex items-center gap-3 mb-4 mt-2">
                  <div className="flex-1 h-px bg-(--border-subtle)" />
                  <span className="text-[11px] font-black text-(--text-muted) tracking-[0.5px]">COMERCIOS CERCA DE TI</span>
                  <div className="flex-1 h-px bg-(--border-subtle)" />
                </div>
              )}
              {loading && postsWithDistance.length === 0 ? (
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
                    initialHops={post.hops}
                    initialSavedCount={post.savedCount}
                    initialSharedCount={post.sharedCount}
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
            <div
              className="fixed left-0 right-0 bottom-0 z-30 overflow-hidden bg-black flex flex-col"
              style={{ top: headerHeight > 0 ? headerHeight : 'calc(max(var(--safe-top, 0px), 8px) + 56px)' }}
            >
              {mapMode === 'flat' ? (
                <div className="h-full w-full overflow-hidden">
                  <InteractiveMap businesses={postsWithDistance} userLat={userLat} userLng={userLng} />
                </div>
              ) : (
                <div className="flex-1 w-full h-full relative flex items-center justify-center">
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
            </div>
          )}

        </div>
      </main>
      </motion.div>

      {activeTab !== 'Freehands' && <BottomNav isDark={isDark} />}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}} />

      <ProfileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <MoodCheckInSheet
        isOpen={moodOpen}
        onClose={() => setMoodOpen(false)}
        onExploreMap={() => setActiveTab('Freehands')}
      />
      <WelcomeRitual />
      <SmartBiometricPrompt />
    </div>
  );
}
