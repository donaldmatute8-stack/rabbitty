'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Award, Zap, Gift, TrendingUp, Users, MapPin, ScanLine } from 'lucide-react';
import Link from 'next/link';
import BottomNav from '@/components/BottomNav';
import Header from '@/components/ui/Header';
import Tabs from '@/components/ui/Tabs';
import FeedCard from '@/components/ui/FeedCard';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useWallet } from '@/contexts/WalletContext';
import dynamic from 'next/dynamic';

// Disable SSR for Map
const InteractiveMap = dynamic(() => import('@/features/map/InteractiveMap'), { 
  ssr: false,
  loading: () => <div className="h-full w-full bg-gray-100 animate-pulse rounded-2xl flex items-center justify-center">Cargando Mapa...</div>
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

const TABS = ["bunz'in", "Stock", "Freehands"];

const CATEGORIES = [
  { icon: '☕', label: 'Cafés', count: 12, color: '#FFE0EC', iconColor: '#E91E63' },
  { icon: '🍕', label: 'Restaurantes', count: 8, color: '#FFF4E0', iconColor: '#FF9800' },
  { icon: '💪', label: 'Gimnasios', count: 5, color: '#E0F0FF', iconColor: '#2196F3' },
  { icon: '🛍️', label: 'Retail', count: 15, color: '#F0E0FF', iconColor: '#9C27B0' },
  { icon: '✨', label: 'Belleza', count: 7, color: '#FFE0EC', iconColor: '#E91E63' },
  { icon: '💻', label: 'Tecnología', count: 4, color: '#E0FFE8', iconColor: '#4CAF50' },
];

const TRENDING = [
  { name: 'Café Cultura', desc: 'Café y desayunos', dist: '120m', stars: 4.8, bunz: '+50 bunz', img: '☕' },
  { name: 'Pizza Napoli', desc: 'Restaurante italiano', dist: '350m', stars: 4.6, bunz: '+30 bunz', img: '🍕' },
  { name: 'Gimnasio Power', desc: 'Fitness y bienestar', dist: '500m', stars: 4.9, bunz: '+100 bunz', img: '💪' },
];

export default function FeedPage() {
  const [activeTab, setActiveTab] = useState("bunz'in");
  const [posts, setPosts] = useState<FeedItem[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const { address } = useWallet();
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [locationLoaded, setLocationLoaded] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [reserving, setReserving] = useState(false);
  
  const handleSpend = async (offerId: string, bunzCost: number) => {
    if (balance < bunzCost) {
      alert("No tienes suficientes Bunz para adquirir esta oferta.");
      return;
    }
    setPurchasing(true);
    try {
      const res = await fetch('/api/transaction/spend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address, offerId })
      });
      const data = await res.json();
      if (data.success) {
        alert("¡Compra exitosa! Revisa tu inventario en el perfil.");
        // Optimistic update
        setBalance(prev => prev - bunzCost);
      } else {
        alert(data.error || "Ocurrió un error al procesar el pago.");
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión.");
    } finally {
      setPurchasing(false);
    }
  };

  const handleReserve = async (businessId: string) => {
    // We prompt the user for how many bunz they want to reserve
    const amountStr = window.prompt("¿Cuántos Bunz esperas gastar en esta visita?");
    if (!amountStr) return;
    
    const amount = parseInt(amountStr);
    if (isNaN(amount) || amount <= 0) {
      alert("Por favor ingresa un monto válido.");
      return;
    }
    
    if (balance < amount) {
      alert("No tienes suficientes Bunz para reservar esa cantidad.");
      return;
    }

    setReserving(true);
    try {
      const res = await fetch('/api/business/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address, businessId, reserveAmount: amount })
      });
      const data = await res.json();
      if (data.success) {
        alert("¡Reserva confirmada! El negocio te está esperando.");
      } else {
        alert(data.error || "Ocurrió un error al reservar.");
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión.");
    } finally {
      setReserving(false);
    }
  };

  // Detectar scroll para comprimir header
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fetch GPS on mount
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLat(pos.coords.latitude);
          setUserLng(pos.coords.longitude);
          setLocationLoaded(true);
        },
        () => {
          setLocationLoaded(true); // Default to null coords (trend mode)
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      setLocationLoaded(true);
    }
  }, []);

  // Fetch API data when tab or location changes
  useEffect(() => {
    if (!locationLoaded) return;
    
    const loadData = async () => {
      setLoading(true);
      try {
        if (activeTab === "bunz'in" || activeTab === "Freehands") {
          const locQuery = userLat && userLng ? `?lat=${userLat}&lng=${userLng}` : '';
          const res = await fetch(`/api/feed${locQuery}`);
          const data = await res.json();
          if (data.success) {
            setPosts(data.items);
          }
        } else if (activeTab === "Stock") {
          const res = await fetch(`/api/offers`);
          const data = await res.json();
          if (data.success) {
            setOffers(data.offers);
          }
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [activeTab, locationLoaded, userLat, userLng]);

  useEffect(() => {
    import('@twa-dev/sdk').then((mod) => {
      const app = mod.default;
      app.ready();
      app.expand();
      try {
        app.setBackgroundColor('#FFFFFF');
        app.setHeaderColor('#FFFFFF');
      } catch (e) {
      }
    });
  }, []);

  return (
    <div className="page-wrap pb-28 bg-white">
      <div className={`sticky top-0 z-[60] bg-white transition-shadow duration-300 ${isScrolled ? 'shadow-[0_2px_8px_rgba(0,0,0,0.04)]' : ''}`}>
        <div style={{ height: 'var(--safe-top)' }} />
        <Header showBack={true} isScrolled={isScrolled} />
        <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} isScrolled={isScrolled} />
      </div>

      <main className="flex-1 w-full max-w-[600px] mx-auto" style={{ backgroundColor: '#FFFFFF', paddingLeft: 16, paddingRight: 16 }}>
        {/* Feed */}
        <div style={{ paddingTop: '40px' }}>
          {activeTab === "bunz'in" && (
            loading ? (
              // Loading skeletons
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : posts.length > 0 ? (
              posts.map((post, i) => (
                <FeedCard
                  key={post.id}
                  id={post.id}
                  user={post.user}
                  device={post.device}
                  time={post.time}
                  label={`${post.distance}km`}
                  bunz={post.reward_percentage}
                  imageUrl={post.imageUrl}
                  index={i}
                  onReserve={reserving ? undefined : handleReserve}
                />
              ))
            ) : (
              <EmptyState
                icon={<Search className="w-8 h-8 text-[#8A8A8A]" />}
                title="Sin resultados"
                description={`No hay negocios disponibles en "${activeTab}" aún.`}
              />
            )
          )}

          {activeTab === "Stock" && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              {/* Buscador */}
              <div style={{ position: "relative", marginBottom: 24 }}>
                <svg style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="7" cy="7" r="5.5" stroke="#AAA" strokeWidth="1.5"/>
                  <path d="M11 11L14 14" stroke="#AAA" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input 
                  placeholder="Buscar negocios..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ 
                    width: "100%", 
                    backgroundColor: "#F4F4F4", 
                    border: "none", 
                    borderRadius: 100, 
                    padding: "12px 16px 12px 38px", 
                    fontSize: 15, 
                    color: "#111", 
                    outline: "none", 
                    fontFamily: "var(--font-family-base)" 
                  }} 
                />
              </div>

              {/* Stock Offers Grid */}
              <div className="flex flex-col gap-4 mt-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-black text-black">Ofertas Disponibles</h2>
                </div>
                
                {loading ? (
                  <SkeletonCard />
                ) : offers.length === 0 ? (
                  <div className="bg-gray-50 rounded-2xl p-6 text-center border-2 border-dashed border-gray-200">
                    <p className="font-bold text-gray-500 mb-2">No hay ofertas disponibles</p>
                    <p className="text-xs text-gray-400">Los negocios subirán certificados de regalo pronto.</p>
                  </div>
                ) : (
                  offers.map((o) => (
                    <div key={o.id} className={`bg-white border rounded-2xl p-4 flex flex-col gap-3 shadow-sm ${!o.isAvailable ? 'opacity-50 grayscale' : 'border-gray-100'}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-xs text-pink-500">{o.businessName}</span>
                            {!o.isAvailable && <span className="text-[10px] bg-red-100 text-red-500 px-2 py-0.5 rounded-md font-bold">Límite Diario</span>}
                          </div>
                          <p className="font-black text-black text-base leading-tight">{o.title}</p>
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{o.description}</p>
                        </div>
                        {o.image && (
                          <img src={o.image} alt={o.title} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                        <p className="font-black text-lg text-black">{o.bunzCost} Bunz</p>
                        <button 
                          disabled={!o.isAvailable || purchasing} 
                          onClick={() => handleSpend(o.id, o.bunzCost)}
                          className="bg-black text-white text-xs font-bold px-4 py-2 rounded-full disabled:bg-gray-300 transition-colors active:scale-95"
                        >
                          {purchasing ? 'Procesando...' : (o.isAvailable ? 'Adquirir' : 'Agotado Hoy')}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 24 }}>
                {CATEGORIES.map((cat, i) => (
                  <motion.div 
                    key={cat.label} 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.04 }}
                    style={{ backgroundColor: "#FAFAFA", border: "1px solid #F0F0F0", borderRadius: 14, padding: "14px 10px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer" }}
                  >
                    <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: cat.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                      {cat.icon}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>{cat.label}</span>
                    <span style={{ fontSize: 11, color: "#AAA" }}>{cat.count} negocios</span>
                  </motion.div>
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 13L6 3L10 10L12 6L14 13" stroke="#E91E63" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <h2 style={{ fontSize: 17, fontWeight: 700, color: "#111" }}>Tendencias</h2>
                </div>
                <span style={{ fontSize: 13, color: "#E91E63", fontWeight: 500 }}>Ver todo &rsaquo;</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 24 }}>
                {TRENDING.map((b, i) => (
                  <motion.div 
                    key={b.name} 
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 14, paddingBottom: 14, borderBottom: i < TRENDING.length - 1 ? "1px solid #F4F4F4" : "none" }}
                  >
                    <div style={{ width: 52, height: 52, borderRadius: "50%", backgroundColor: "#F0F0F0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>
                      {b.img}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 15, fontWeight: 700, color: "#111", marginBottom: 2 }}>{b.name}</p>
                      <p style={{ fontSize: 12, color: "#AAA", marginBottom: 4 }}>{b.desc} — {b.dist}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 14 }}>⭐</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{b.stars}</span>
                      </div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#E91E63", flexShrink: 0 }}>{b.bunz}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === "Freehands" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="h-[60vh] bg-[#F4F4F4] rounded-2xl flex items-center justify-center relative overflow-hidden"
            >
              <div className="h-[70vh] w-full mt-2 relative rounded-2xl overflow-hidden shadow-sm">
                <InteractiveMap 
                  businesses={posts} 
                  userLat={userLat} 
                  userLng={userLng} 
                />
              </div>
            </motion.div>
          )}
        </div>
      </main>

      {/* Floating Action Button para reclamar recompensas */}
      <Link href="/claim" className="fixed right-6 bottom-24 z-[90] active:scale-95 transition-transform" style={{ textDecoration: 'none' }}>
        <div className="bg-pink-500 shadow-xl shadow-pink-500/30 text-white rounded-full p-4 flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
          <ScanLine size={24} strokeWidth={2.5} className="relative z-10" />
        </div>
      </Link>

      <BottomNav />
    </div>
  );
}
