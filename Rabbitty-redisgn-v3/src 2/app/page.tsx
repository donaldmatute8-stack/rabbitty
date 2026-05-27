'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ScanLine } from 'lucide-react';
import Link from 'next/link';
import BottomNav from '@/components/BottomNav';
import Header from '@/components/ui/Header';
import Tabs from '@/components/ui/Tabs';
import FeedCard from '@/components/ui/FeedCard';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useWallet } from '@/contexts/WalletContext';
import dynamic from 'next/dynamic';

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
}

const TABS = ["bunz'in", 'Stock', 'Freehands'];

export default function FeedPage() {
  const [activeTab, setActiveTab] = useState("bunz'in");
  const [posts, setPosts] = useState<FeedItem[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [purchasing, setPurchasing] = useState(false);

  const { address, balance } = useWallet();
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [locationLoaded, setLocationLoaded] = useState(false);

  const isDark = activeTab === 'Freehands';

  const handleSpend = async (offerId: string, bunzCost: number) => {
    if (parseFloat(balance) < bunzCost) {
      alert('No tienes suficientes Bunz para adquirir esta oferta.');
      return;
    }
    setPurchasing(true);
    try {
      const res = await fetch('/api/transaction/spend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address, offerId }),
      });
      const data = await res.json();
      if (data.success) alert('¡Compra exitosa! Revisa tu inventario en el perfil.');
      else alert(data.error || 'Ocurrió un error al procesar el pago.');
    } catch {
      alert('Error de conexión.');
    } finally {
      setPurchasing(false);
    }
  };

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
    });
  }, [isDark]);

  useEffect(() => {
    if (!locationLoaded) return;
    const loadData = async () => {
      setLoading(true);
      try {
        if (activeTab === "bunz'in" || activeTab === 'Freehands') {
          const q = userLat && userLng ? `?lat=${userLat}&lng=${userLng}` : '';
          const res = await fetch(`/api/businessfeed${q}`);
          const { success, items } = await res.json();
          if (success) setPosts(items);
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
  }, [activeTab, locationLoaded, userLat, userLng]);

  return (
    <div
      className="page-wrap"
      style={{ background: isDark ? '#0D0D1A' : '#FAFAFA', color: isDark ? '#fff' : '#111', paddingBottom: 112, transition: 'background 0.5s' }}
    >
      {/* Sticky header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 60,
        background: isDark ? 'rgba(10,10,20,0.9)' : '#fff',
        backdropFilter: isDark ? 'blur(20px)' : 'none',
        borderBottom: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid #F0F0F0',
        boxShadow: isScrolled && !isDark ? '0 2px 8px rgba(0,0,0,0.04)' : 'none',
        transition: 'all 0.3s',
      }}>
        <div style={{ height: 'var(--safe-top)' }} />
        <Header showBack={true} isScrolled={isScrolled} isDark={isDark} />
        <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} isScrolled={isScrolled} isDark={isDark} />
      </div>

      <main style={{ flex: 1, width: '100%', maxWidth: 600, margin: '0 auto', paddingLeft: isDark ? 0 : 16, paddingRight: isDark ? 0 : 16 }}>
        <div style={{ paddingTop: 24 }}>

          {/* ── bunz'in tab ── */}
          {activeTab === "bunz'in" && (
            <>
              {!loading && posts.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ flex: 1, height: 1, background: '#EBEBEB' }} />
                  <span style={{ fontSize: 11, fontWeight: 900, color: '#CCC', letterSpacing: 0.5 }}>CERCA DE TI</span>
                  <div style={{ flex: 1, height: 1, background: '#EBEBEB' }} />
                </div>
              )}
              {loading ? (
                <><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
              ) : posts.length > 0 ? (
                posts.map((post, i) => (
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
                              onClick={() => handleSpend(o.id, o.bunzCost)}
                              style={{
                                background: o.isAvailable && !purchasing ? '#111' : '#E0E0E0',
                                color: o.isAvailable && !purchasing ? '#fff' : '#999',
                                fontSize: 13, fontWeight: 900, padding: '10px 20px',
                                borderRadius: 999, border: 'none', cursor: o.isAvailable && !purchasing ? 'pointer' : 'not-allowed',
                              }}
                            >
                              {purchasing ? '...' : o.isAvailable ? 'Reservar Visita' : 'Agotado Hoy'}
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
              style={{ height: 'calc(100vh - 130px)', width: '100%', position: 'relative', overflow: 'hidden', background: '#0D0D1A' }}
            >
              <InteractiveMap businesses={posts} userLat={userLat} userLng={userLng} />
            </motion.div>
          )}

        </div>
      </main>

      {/* Floating scan button */}
      <Link href="/claim" style={{ position: 'fixed', right: 20, bottom: 96, zIndex: 90, textDecoration: 'none' }}>
        <div style={{
          background: 'linear-gradient(135deg, #E91E63 0%, #AD1457 100%)',
          boxShadow: '0 8px 24px rgba(233,30,99,0.45)',
          color: '#fff', borderRadius: '50%', padding: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.15)', borderRadius: '50%', animation: 'pulse 2s infinite' }} />
          <ScanLine size={22} strokeWidth={2.5} style={{ position: 'relative', zIndex: 1 }} />
        </div>
      </Link>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}} />

      <BottomNav />
    </div>
  );
}
