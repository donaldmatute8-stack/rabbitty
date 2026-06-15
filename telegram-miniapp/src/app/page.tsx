'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ScanLine, Bell } from 'lucide-react';
import Link from 'next/link';
import BottomNav from '@/components/BottomNav';
import Header from '@/components/ui/Header';
import Tabs from '@/components/ui/Tabs';
import FeedCard from '@/components/ui/FeedCard';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/features/auth/AuthProvider';
import { Globe3D } from '@/components/ui/3d-globe';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';

const InteractiveMap = dynamic(() => import('@/features/map/InteractiveMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-[#0D0D1A] flex items-center justify-center">
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
  const [activeTab, setActiveTab] = useState("bunz'in");
  const [posts, setPosts] = useState<FeedItem[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [purchasing, setPurchasing] = useState(false);
  const [mapMode, setMapMode] = useState<'globe' | 'flat'>('flat');
  const { showToast } = useToast();

  const { address, balance } = useWallet();
  const { user } = useAuth();
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [locationLoaded, setLocationLoaded] = useState(false);

  const isDark = activeTab === 'Freehands';

  const [greeting, setGreeting] = useState('Buenos días,');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) setGreeting('Buenos días,');
    else if (hour >= 12 && hour < 19) setGreeting('Buenas tardes,');
    else setGreeting('Buenas noches,');
  }, []);

  const handleSpend = async (offerId: string, bunzCost: number, businessName: string, offerTitle: string) => {
    if (user && user.totalBunzEarned < bunzCost) {
      showToast('No tienes suficientes Bunz para adquirir esta oferta.', 'error');
      return;
    }
    setPurchasing(true);
    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          telegramId: user?.telegramId, 
          businessName, 
          offerTitle, 
          bunzCost 
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
        (pos) => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude); setLocationLoaded(true); },
        () => setLocationLoaded(true),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else setLocationLoaded(true);
  }, []);

  useEffect(() => {
    import('@twa-dev/sdk').then((mod) => {
      const app = mod.default;
      app.ready(); app.expand();
      try {
        app.setBackgroundColor(isDark ? '#0D0D1A' : '#FAFAFA');
        app.setHeaderColor(isDark ? '#0A0A14' : '#FFFFFF');
      } catch {}

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
  }, [isDark]);

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

  useEffect(() => {
    const loadData = async () => {
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
    };
    loadData();
  }, [activeTab]);

  return (
    <div
      className="page-wrap pb-28"
      style={{ background: isDark ? '#000000' : '#FAFAFA', color: isDark ? '#fff' : '#111', transition: 'background 0.5s' }}
    >
      {/* Sticky header */}
      <div className="sticky top-0 z-[60]" style={{
        background: isDark ? 'rgba(0,0,0,0.9)' : '#fff',
        backdropFilter: isDark ? 'blur(20px)' : 'none',
        borderBottom: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid #F0F0F0',
        transition: 'all 0.3s',
      }}>
        <div style={{ height: 'calc(var(--safe-top) + 50px)' }} />
        {/* Nuevo Custom Header (Buenos días, Bunz) */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <Link href="/profile" className="flex items-center gap-3 no-underline">
            <div className="w-11 h-11 rounded-full overflow-hidden" style={{ background: isDark ? '#1A1A2E' : '#F0F0F0', border: isDark ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
              <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${user?.firstName || 'Rabbitty'}&backgroundColor=E91E63`} alt={user?.firstName || 'User'} className="w-full h-full" />
            </div>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.5px] mb-[2px]" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : '#888' }}>{greeting}</p>
              <h1 className="text-[19px] font-black tracking-[-0.5px] m-0" style={{ color: isDark ? '#fff' : '#111' }}>{user?.firstName || 'Explorador'}</h1>
            </div>
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="px-3 py-[6px] rounded-full flex items-baseline gap-1" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#F4F4F4', border: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid #EBEBEB' }}>
              <span className="text-[15px] font-black" style={{ color: isDark ? '#fff' : '#111' }}>{(user?.totalBunzEarned || 0).toLocaleString()}</span>
              <span className="text-[11px] font-black text-[#E91E63]">BUNZ</span>
            </div>
            
            {/* Notification Bell */}
            <Link href="/notifications" className="relative w-9 h-9 rounded-full flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.04)]" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#fff', border: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid #F0F0F0' }}>
              <Bell size={18} color={isDark ? '#fff' : '#111'} strokeWidth={2.5} />
              {/* Unread indicator dot */}
              <div className="absolute top-2 right-[9px] w-[6px] h-[6px] bg-[#E91E63] rounded-full" style={{ border: `1.5px solid ${isDark ? '#000' : '#fff'}` }} />
            </Link>

            <Link href="/scan" className="w-9 h-9 rounded-full flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.04)]" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#fff', border: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid #F0F0F0' }}>
              <img 
                src="/logo_conejo.png" 
                alt="Scan" 
                className="w-4 h-5 object-contain"
                style={{ filter: isDark ? 'grayscale(100%) brightness(10)' : 'grayscale(100%) brightness(0)' }} 
              />
            </Link>
          </div>
        </div>
        <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} isDark={isDark} />
      </div>

      <main className="flex-1 w-full max-w-[600px] mx-auto" style={{ paddingLeft: isDark ? 0 : 16, paddingRight: isDark ? 0 : 16 }}>
        <div className="pt-6">

          {/* ── bunz'in tab ── */}
          {activeTab === "bunz'in" && (
            <>
              {!loading && postsWithDistance.length > 0 && (
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 h-px bg-[#EBEBEB]" />
                  <span className="text-[11px] font-black text-[#CCC] tracking-[0.5px]">CERCA DE TI</span>
                  <div className="flex-1 h-px bg-[#EBEBEB]" />
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
                    time={post.time}
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
                <svg className="absolute left-4 top-1/2 -translate-y-1/2" width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <circle cx="7" cy="7" r="5.5" stroke="#BBB" strokeWidth="1.5" />
                  <path d="M11 11L14 14" stroke="#BBB" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <input
                  placeholder="Buscar negocios..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#F2F2F2] border-none rounded-full py-3 px-4 pl-10 text-sm text-[#111] outline-none box-border"
                  style={{ fontFamily: 'var(--font-family-base)' }}
                />
              </div>

              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[17px] font-black text-[#111] m-0">Ofertas Disponibles</h2>
                {offers.length > 0 && (
                  <span className="text-xs font-bold text-[#E91E63]">
                    {offers.filter(o => o.isAvailable).length} activas
                  </span>
                )}
              </div>

              {loading ? (
                <SkeletonCard />
              ) : offers.length === 0 ? (
                <div className="bg-white rounded-[20px] p-6 text-center border-2 border-dashed border-[#E8E8E8]">
                  <p className="font-bold text-[#888] mb-1">No hay ofertas disponibles</p>
                  <p className="text-xs text-[#BBB] m-0">Los negocios subirán certificados de regalo pronto.</p>
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
                        className="bg-white rounded-[22px] overflow-hidden border border-[#F0F0F0] shadow-[0_2px_12px_rgba(0,0,0,0.04)] relative"
                        style={{ opacity: o.isAvailable ? 1 : 0.55, filter: o.isAvailable ? 'none' : 'grayscale(1)' }}
                      >
                        {/* Ticket notch */}
                        <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-[#FAFAFA] rounded-full border border-[#F0F0F0]" />
                        <div className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-[#FAFAFA] rounded-full border border-[#F0F0F0]" />

                        <div className="p-5">
                          <div className="flex items-start gap-4 mb-4">
                            {o.image ? (
                              <img src={o.image} alt={o.title} className="w-14 h-14 rounded-[16px] object-cover shrink-0 shadow-[0_2px_8px_rgba(0,0,0,0.1)]" />
                            ) : (
                              <div className="w-14 h-14 rounded-[16px] bg-[#F8F8F8] border border-[#F0F0F0] flex items-center justify-center text-2xl shrink-0">🏪</div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-black text-[#E91E63] tracking-[0.5px] uppercase mb-1">{o.businessName}</p>
                              <p className="font-black text-[#111] text-base leading-[1.2] mb-1">{o.title}</p>
                              <p className="text-xs text-[#999] leading-[1.5] m-0 line-clamp-2">{o.description}</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-4 border-t border-dashed border-[#EBEBEB]">
                            <div>
                              <p className="text-[9px] font-black text-[#BBB] tracking-[0.5px] uppercase mb-[2px]">Costo</p>
                              <div className="flex items-baseline gap-1">
                                <span className="text-[22px] font-black text-[#111]">{o.bunzCost}</span>
                                <span className="text-[13px] font-bold text-[#E91E63]">bunz</span>
                              </div>
                            </div>
                            <button
                              disabled={!o.isAvailable || purchasing}
                              onClick={() => handleSpend(o.id, o.bunzCost, o.businessName, o.title)}
                              className="text-[13px] font-black px-5 py-[10px] rounded-full border-none"
                              style={{
                                background: o.isAvailable && !purchasing ? '#111' : '#E0E0E0',
                                color: o.isAvailable && !purchasing ? '#fff' : '#999',
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
              style={{ top: 'calc(var(--safe-top, 0px) + 120px)' }}
            >
              {/* Holographic Toggle */}
              <div className="absolute z-[2000] flex bg-white/5 backdrop-blur-[10px] rounded-full border border-white/10 p-1" style={{ top: 70, right: 72 }}>
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

      <BottomNav />
    </div>
  );
}
