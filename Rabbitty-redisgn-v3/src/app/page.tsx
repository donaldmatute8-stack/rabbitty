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
    <div className="h-full w-full bg-[#0D0D1A] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#E91E63]/30 border-t-[#E91E63] rounded-full animate-spin" />
        <p className="text-white/40 text-xs font-semibold">Cargando Mapa...</p>
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
      if (data.success) {
        alert('¡Compra exitosa! Revisa tu inventario en el perfil.');
      } else {
        alert(data.error || 'Ocurrió un error al procesar el pago.');
      }
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
        (pos) => {
          setUserLat(pos.coords.latitude);
          setUserLng(pos.coords.longitude);
          setLocationLoaded(true);
        },
        () => setLocationLoaded(true),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      setLocationLoaded(true);
    }
  }, []);

  useEffect(() => {
    import('@twa-dev/sdk').then((mod) => {
      const app = mod.default;
      app.ready();
      app.expand();
      try {
        app.setBackgroundColor(activeTab === 'Freehands' ? '#0D0D1A' : '#FAFAFA');
        app.setHeaderColor(activeTab === 'Freehands' ? '#0A0A14' : '#FFFFFF');
      } catch {}
    });
  }, [activeTab]);

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

  const isDark = activeTab === 'Freehands';

  return (
    <div
      className={`page-wrap pb-28 transition-colors duration-500 ${
        isDark ? 'bg-[#0D0D1A] text-white' : 'bg-[#FAFAFA] text-[#111]'
      }`}
    >
      {/* Sticky header + tabs */}
      <div
        className={`sticky top-0 z-[60] transition-all duration-300 ${
          isDark
            ? 'bg-[#0A0A14]/90 backdrop-blur-xl border-b border-white/5'
            : 'bg-white border-b border-[#F0F0F0]'
        } ${isScrolled && !isDark ? 'shadow-[0_2px_8px_rgba(0,0,0,0.04)]' : ''}`}
      >
        <div style={{ height: 'var(--safe-top)' }} />
        <Header showBack={true} isScrolled={isScrolled} isDark={isDark} />
        <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} isScrolled={isScrolled} isDark={isDark} />
      </div>

      <main
        className="flex-1 w-full max-w-[600px] mx-auto"
        style={{ paddingLeft: isDark ? 0 : 16, paddingRight: isDark ? 0 : 16 }}
      >
        <div style={{ paddingTop: 24 }}>

          {/* ── bunz'in tab ── */}
          {activeTab === "bunz'in" && (
            <>
              {!loading && posts.length > 0 && (
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 h-px bg-[#EBEBEB]" />
                  <span className="text-[11px] font-black text-[#CCC] tracking-[0.5px]">CERCA DE TI</span>
                  <div className="flex-1 h-px bg-[#EBEBEB]" />
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
                  className="w-full bg-[#F2F2F2] rounded-full py-3 pl-10 pr-4 text-[14px] text-[#111] outline-none border-none placeholder:text-[#BBB]"
                  style={{ fontFamily: 'var(--font-family-base)' }}
                />
              </div>

              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[17px] font-black text-[#111]">Ofertas Disponibles</h2>
                {offers.length > 0 && (
                  <span className="text-[12px] font-bold text-[#E91E63]">
                    {offers.filter((o) => o.isAvailable).length} activas
                  </span>
                )}
              </div>

              {loading ? (
                <SkeletonCard />
              ) : offers.length === 0 ? (
                <div className="bg-white rounded-[20px] p-6 text-center border-2 border-dashed border-[#E8E8E8]">
                  <p className="font-bold text-[#888] mb-1">No hay ofertas disponibles</p>
                  <p className="text-xs text-[#BBB]">Los negocios subirán certificados de regalo pronto.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {offers
                    .filter(
                      (o) =>
                        !searchQuery ||
                        o.businessName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        o.title?.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((o) => (
                      <div
                        key={o.id}
                        className={`bg-white rounded-[22px] overflow-hidden border border-[#F0F0F0] shadow-[0_2px_12px_rgba(0,0,0,0.04)] relative ${
                          !o.isAvailable ? 'opacity-55 grayscale' : ''
                        }`}
                      >
                        {/* Ticket notch effect */}
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 bg-[#FAFAFA] rounded-full border border-[#F0F0F0]" />
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-5 h-5 bg-[#FAFAFA] rounded-full border border-[#F0F0F0]" />

                        <div className="p-5">
                          <div className="flex items-start gap-4 mb-4">
                            {o.image ? (
                              <img src={o.image} alt={o.title} className="w-14 h-14 rounded-[16px] object-cover flex-shrink-0 shadow-sm" />
                            ) : (
                              <div className="w-14 h-14 rounded-[16px] bg-[#F8F8F8] border border-[#F0F0F0] flex items-center justify-center text-2xl flex-shrink-0">
                                🏪
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-black text-[#E91E63] uppercase tracking-[0.5px] mb-1">{o.businessName}</p>
                              <p className="font-black text-[#111] text-[16px] leading-tight mb-1">{o.title}</p>
                              <p className="text-[12px] text-[#999] line-clamp-2 leading-snug">{o.description}</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-4 border-t border-dashed border-[#EBEBEB]">
                            <div>
                              <p className="text-[9px] font-black text-[#BBB] uppercase tracking-[0.5px] mb-0.5">Costo</p>
                              <div className="flex items-baseline gap-1">
                                <span className="text-[22px] font-black text-[#111]">{o.bunzCost}</span>
                                <span className="text-[13px] font-bold text-[#E91E63]">bunz</span>
                              </div>
                            </div>
                            <button
                              disabled={!o.isAvailable || purchasing}
                              onClick={() => handleSpend(o.id, o.bunzCost)}
                              className="bg-[#111] disabled:bg-[#E0E0E0] text-white disabled:text-[#999] text-[13px] font-black px-5 py-2.5 rounded-full transition-transform active:scale-95"
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
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-[calc(100vh-130px)] w-full relative overflow-hidden bg-[#0D0D1A]"
            >
              <InteractiveMap businesses={posts} userLat={userLat} userLng={userLng} />
            </motion.div>
          )}

        </div>
      </main>

      {/* Floating scan button */}
      <Link href="/claim" className="fixed right-5 bottom-24 z-[90] active:scale-95 transition-transform" style={{ textDecoration: 'none' }}>
        <div className="bg-gradient-to-br from-[#E91E63] to-[#AD1457] shadow-[0_8px_24px_rgba(233,30,99,0.45)] text-white rounded-full p-4 flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-white/15 animate-pulse rounded-full" />
          <ScanLine size={22} strokeWidth={2.5} className="relative z-10" />
        </div>
      </Link>

      <BottomNav />
    </div>
  );
}
