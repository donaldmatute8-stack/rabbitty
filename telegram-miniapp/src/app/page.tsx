'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Award, Zap, Gift, TrendingUp, Users, MapPin } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import Header from '@/components/ui/Header';
import Tabs from '@/components/ui/Tabs';
import FeedCard from '@/components/ui/FeedCard';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { api } from '@/services/api';
import { useWallet } from '@/contexts/WalletContext';

interface FeedItem {
  id: string;
  user: string;
  device: string;
  time: string;
  label: string;
  bunz: number;
  imageUrl?: string;
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
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { isConnected, balance: walletBalance } = useWallet();

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

  // Cargar datos del backend
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // Cargar feed según tab
        const feedData = await api.feed.get(activeTab);
        if (feedData?.items) {
          setPosts(feedData.items.map((item: any) => ({
            id: item.id?.toString() || Math.random().toString(),
            user: item.name || item.user || 'Negocio',
            device: item.type || item.device || 'Afiliado',
            time: item.distance ? `${item.distance}km • ${item.rating}★` : 'Abierto ahora',
            label: item.label || item.description || '',
            bunz: item.reward_rate || item.rewardAmount || 0,
          })));
        }

        // Cargar balance
        try {
          const balanceData = await api.users.balance();
          setBalance(balanceData.balance || 0);
        } catch (e) {
          // Fallback a mock si no hay auth
          setBalance(1250);
        }

        setError(null);
      } catch (err) {
        console.error('Error loading feed:', err);
        setError('No se pudo cargar el feed. Usando datos locales.');
        // Fallback a mock data
        setPosts(getMockPosts());
        setBalance(1250);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [activeTab]);

  // Inicializar Telegram WebApp
  useEffect(() => {
    import('@twa-dev/sdk').then((mod) => {
      const app = mod.default;
      app.ready();
      app.expand();
      try {
        app.setBackgroundColor('#FFFFFF');
        app.setHeaderColor('#FFFFFF');
      } catch (e) {
        console.error('Error setting Telegram colors', e);
      }
    });
  }, []);

  const getMockPosts = (): FeedItem[] => {
    if (activeTab === "bunz'in") {
      return [
        { id: '1', user: 'Café Cultura', device: 'Café y desayunos', time: 'Abierto ahora', label: 'Avocado Toast', bunz: 50, imageUrl: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&q=80' },
        { id: '2', user: 'Pizza Napoli', device: 'Restaurante italiano', time: 'Abierto hasta 11pm', label: 'Pizza Margherita', bunz: 30, imageUrl: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800&q=80' },
        { id: '3', user: 'Gimnasio Power', device: 'Fitness y bienestar', time: 'Abierto 24hrs', label: 'Membresía mensual', bunz: 100, imageUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80' },
      ];
    } else if (activeTab === 'Stock') {
      return [
        { id: '4', user: 'TechZone', device: 'Electrónica', time: 'Acepta bunz', label: 'AirPods Pro', bunz: 500, imageUrl: 'https://images.unsplash.com/photo-1606220588913-b3aecb4b276c?w=800&q=80' },
        { id: '5', user: 'Café Cultura', device: 'Café y desayunos', time: 'Acepta bunz', label: 'Desayuno completo', bunz: 80, imageUrl: 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=800&q=80' },
        { id: '6', user: 'Pizza Napoli', device: 'Restaurante italiano', time: 'Acepta bunz', label: 'Cena para 2', bunz: 200, imageUrl: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=800&q=80' },
      ];
    } else {
      return [
        { id: '7', user: 'Café Cultura', device: 'Café • Desayuno • Wifi', time: '1.2km • 4.8★', label: 'Avocado Toast', bunz: 50, imageUrl: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&q=80' },
        { id: '8', user: 'Gimnasio Power', device: 'Fitness • Crossfit • Yoga', time: '0.8km • 4.9★', label: 'Clase grupal', bunz: 40, imageUrl: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&q=80' },
        { id: '9', user: 'TechZone', device: 'Electrónica • Accesorios', time: '2.5km • 4.6★', label: 'iPhone 15 Case', bunz: 25, imageUrl: 'https://images.unsplash.com/photo-1603313011101-320f26a4f6f6?w=800&q=80' },
      ];
    }
  };

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
                  label={post.label}
                  bunz={post.bunz}
                  imageUrl={post.imageUrl}
                  index={i}
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

              <h2 style={{ fontSize: 17, fontWeight: 700, color: "#111", marginBottom: 14 }}>Categorías</h2>
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
              <div className="text-center">
                <MapPin className="w-12 h-12 text-[#AAA] mx-auto mb-3" strokeWidth={1.5} />
                <p className="text-[#111] font-bold text-[17px] mb-1">Mapa interactivo</p>
                <p className="text-[#888] text-[13px]">Disponible próximamente</p>
              </div>
            </motion.div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
