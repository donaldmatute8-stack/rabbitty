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
    <div style={{ height: '100%', width: '100%', background: '#0D0D1A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(233,30,99,0.3)', borderTopColor: '#E91E63', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 600 }}>Cargando Mapa...</p>
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
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
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
            // Aquí podríamos guardar data.user en un GlobalContext
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
          // Fetch Real Businesses from Database
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
      className="page-wrap"
      style={{ background: isDark ? '#000000' : '#FAFAFA', color: isDark ? '#fff' : '#111', paddingBottom: 112, transition: 'background 0.5s' }}
    >
      {/* Sticky header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 60,
        background: isDark ? 'rgba(0,0,0,0.9)' : '#fff',
        backdropFilter: isDark ? 'blur(20px)' : 'none',
        borderBottom: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid #F0F0F0',
        transition: 'all 0.3s',
      }}>
        <div style={{ height: 'var(--tg-safe-top-adjusted, calc(env(safe-area-inset-top, 0px) + 50px))' }} />
        {/* Nuevo Custom Header (Buenos días, Bunz) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 8px' }}>
          <Link href="/profile" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: isDark ? '#1A1A2E' : '#F0F0F0', overflow: 'hidden', border: isDark ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
              <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${user?.firstName || 'Rabbitty'}&backgroundColor=E91E63`} alt={user?.firstName || 'User'} style={{ width: '100%', height: '100%' }} />
            </div>
            <div>
              <p style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.5)' : '#888', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>{greeting}</p>
              <h1 style={{ fontSize: 19, color: isDark ? '#fff' : '#111', fontWeight: 900, letterSpacing: '-0.5px', margin: 0 }}>{user?.firstName || 'Explorador'}</h1>
            </div>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#F4F4F4', padding: '6px 12px', borderRadius: 999, display: 'flex', alignItems: 'baseline', gap: 4, border: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid #EBEBEB' }}>
              <span style={{ fontSize: 15, fontWeight: 900, color: isDark ? '#fff' : '#111' }}>{(user?.totalBunzEarned || 0).toLocaleString()}</span>
              <span style={{ fontSize: 11, fontWeight: 900, color: '#E91E63' }}>BUNZ</span>
            </div>
            
            {/* Notification Bell */}
            <Link href="/notifications" style={{ position: 'relative', width: 36, height: 36, background: isDark ? 'rgba(255,255,255,0.05)' : '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid #F0F0F0' }}>
              <Bell size={18} color={isDark ? '#fff' : '#111'} strokeWidth={2.5} />
              {/* Unread indicator dot */}
              <div style={{ position: 'absolute', top: 8, right: 9, width: 6, height: 6, background: '#E91E63', borderRadius: '50%', border: `1.5px solid ${isDark ? '#000' : '#fff'}` }} />
            </Link>

            <Link href="/scan" style={{ width: 36, height: 36, background: isDark ? 'rgba(255,255,255,0.05)' : '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid #F0F0F0' }}>
              <img 
                src="/logo_conejo.png" 
                alt="Scan" 
                style={{ 
                  width: 16, 
                  height: 20, 
                  objectFit: 'contain',
                  filter: isDark ? 'grayscale(100%) brightness(10)' : 'grayscale(100%) brightness(0)' 
                }} 
              />
            </Link>
          </div>
        </div>
        <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} isDark={isDark} />
      </div>

      <main style={{ flex: 1, width: '100%', maxWidth: 600, margin: '0 auto', paddingLeft: isDark ? 0 : 16, paddingRight: isDark ? 0 : 16 }}>
        <div style={{ paddingTop: 24 }}>

          {/* ── bunz'in tab ── */}
          {activeTab === "bunz'in" && (
            <>
              {!loading && postsWithDistance.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ flex: 1, height: 1, background: '#EBEBEB' }} />
                  <span style={{ fontSize: 11, fontWeight: 900, color: '#CCC', letterSpacing: 0.5 }}>CERCA DE TI</span>
                  <div style={{ flex: 1, height: 1, background: '#EBEBEB' }} />
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
                  icon={<span style={{ fontSize: 36 }}>🐇</span>}
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
              <div style={{ position: 'relative', marginBottom: 20 }}>
                <svg style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }} width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <circle cx="7" cy="7" r="5.5" stroke="#BBB" strokeWidth="1.5" />
                  <path d="M11 11L14 14" stroke="#BBB" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <input
                  placeholder="Buscar negocios..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%', background: '#F2F2F2', border: 'none',
                    borderRadius: 999, padding: '12px 16px 12px 40px',
                    fontSize: 14, color: '#111', outline: 'none',
                    fontFamily: 'var(--font-family-base)', boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2 style={{ fontSize: 17, fontWeight: 900, color: '#111', margin: 0 }}>Ofertas Disponibles</h2>
                {offers.length > 0 && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#E91E63' }}>
                    {offers.filter(o => o.isAvailable).length} activas
                  </span>
                )}
              </div>

              {loading ? (
                <SkeletonCard />
              ) : offers.length === 0 ? (
                <div style={{ background: '#fff', borderRadius: 20, padding: 24, textAlign: 'center', border: '2px dashed #E8E8E8' }}>
                  <p style={{ fontWeight: 700, color: '#888', marginBottom: 4 }}>No hay ofertas disponibles</p>
                  <p style={{ fontSize: 12, color: '#BBB', margin: 0 }}>Los negocios subirán certificados de regalo pronto.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {offers
                    .filter(o =>
                      !searchQuery ||
                      o.businessName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      o.title?.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((o) => (
                      <div
                        key={o.id}
                        style={{
                          background: '#fff', borderRadius: 22, overflow: 'hidden',
                          border: '1px solid #F0F0F0', boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                          position: 'relative', opacity: o.isAvailable ? 1 : 0.55,
                          filter: o.isAvailable ? 'none' : 'grayscale(1)',
                        }}
                      >
                        {/* Ticket notch */}
                        <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translate(-50%,-50%)', width: 20, height: 20, background: '#FAFAFA', borderRadius: '50%', border: '1px solid #F0F0F0' }} />
                        <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translate(50%,-50%)', width: 20, height: 20, background: '#FAFAFA', borderRadius: '50%', border: '1px solid #F0F0F0' }} />

                        <div style={{ padding: 20 }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
                            {o.image ? (
                              <img src={o.image} alt={o.title} style={{ width: 56, height: 56, borderRadius: 16, objectFit: 'cover', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
                            ) : (
                              <div style={{ width: 56, height: 56, borderRadius: 16, background: '#F8F8F8', border: '1px solid #F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>🏪</div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 10, fontWeight: 900, color: '#E91E63', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 }}>{o.businessName}</p>
                              <p style={{ fontWeight: 900, color: '#111', fontSize: 16, lineHeight: 1.2, marginBottom: 4 }}>{o.title}</p>
                              <p style={{ fontSize: 12, color: '#999', lineHeight: 1.5, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{o.description}</p>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, borderTop: '1px dashed #EBEBEB' }}>
                            <div>
                              <p style={{ fontSize: 9, fontWeight: 900, color: '#BBB', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2 }}>Costo</p>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                                <span style={{ fontSize: 22, fontWeight: 900, color: '#111' }}>{o.bunzCost}</span>
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#E91E63' }}>bunz</span>
                              </div>
                            </div>
                            <button
                              disabled={!o.isAvailable || purchasing}
                              onClick={() => handleSpend(o.id, o.bunzCost, o.businessName, o.title)}
                              style={{
                                background: o.isAvailable && !purchasing ? '#111' : '#E0E0E0',
                                color: o.isAvailable && !purchasing ? '#fff' : '#999',
                                fontSize: 13, fontWeight: 900, padding: '10px 20px',
                                borderRadius: 999, border: 'none', cursor: o.isAvailable && !purchasing ? 'pointer' : 'not-allowed',
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
              style={{ position: 'fixed', left: 0, right: 0, top: 'calc(var(--safe-top, 0px) + 120px)', bottom: 0, zIndex: 10, overflow: 'hidden', background: '#000000' }}
            >
              {/* Holographic Toggle */}
              <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 20, display: 'flex', background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', borderRadius: 999, border: '1px solid rgba(255,255,255,0.1)', padding: 4 }}>
                <button
                  onClick={() => setMapMode('globe')}
                  style={{ background: mapMode === 'globe' ? 'rgba(233,30,99,0.2)' : 'transparent', color: mapMode === 'globe' ? '#E91E63' : '#888', padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 0.3s' }}
                >
                  Globo 3D
                </button>
                <button
                  onClick={() => setMapMode('flat')}
                  style={{ background: mapMode === 'flat' ? 'rgba(255,255,255,0.1)' : 'transparent', color: mapMode === 'flat' ? '#FFF' : '#888', padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 0.3s' }}
                >
                  Local
                </button>
              </div>

              {mapMode === 'flat' ? (
                <div style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
                  <InteractiveMap businesses={postsWithDistance} userLat={userLat} userLng={userLng} />
                </div>
              ) : (
                <div style={{ height: '100%', width: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {loading ? (
                    <div style={{ width: 40, height: 40, border: '3px solid rgba(233,30,99,0.3)', borderTopColor: '#E91E63', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
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
