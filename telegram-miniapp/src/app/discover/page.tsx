'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Map as MapIcon, List, Star, TrendingUp, Clock, ChevronRight, MapPin, Coffee, Dumbbell, ShoppingBag, Sparkles, Laptop } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import Header from '@/components/ui/Header';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';

const CATEGORIES = [
  { id: '1', name: 'Cafés', icon: <Coffee className="w-5 h-5 text-[#E91E63]" />, bg: 'bg-[#E91E63]/5', count: 12 },
  { id: '2', name: 'Restaurantes', icon: '🍕', bg: 'bg-[#FF9800]/5', count: 8 },
  { id: '3', name: 'Gimnasios', icon: <Dumbbell className="w-5 h-5 text-[#2196F3]" />, bg: 'bg-[#2196F3]/5', count: 5 },
  { id: '4', name: 'Retail', icon: <ShoppingBag className="w-5 h-5 text-[#9C27B0]" />, bg: 'bg-[#9C27B0]/5', count: 15 },
  { id: '5', name: 'Belleza', icon: <Sparkles className="w-5 h-5 text-[#E91E63]" />, bg: 'bg-[#E91E63]/5', count: 7 },
  { id: '6', name: 'Tecnología', icon: <Laptop className="w-5 h-5 text-[#4CAF50]" />, bg: 'bg-[#4CAF50]/5', count: 4 },
];

const TRENDING = [
  { 
    id: '1', 
    name: 'Café Cultura', 
    type: 'Café y desayunos', 
    reward: 50, 
    rating: 4.8, 
    distance: '120m',
    imageUrl: 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=800&q=80'
  },
  { 
    id: '2', 
    name: 'Pizza Napoli', 
    type: 'Restaurante italiano', 
    reward: 30, 
    rating: 4.6, 
    distance: '350m',
    imageUrl: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800&q=80'
  },
  { 
    id: '3', 
    name: 'Gimnasio Power', 
    type: 'Fitness y bienestar', 
    reward: 100, 
    rating: 4.9, 
    distance: '500m',
    imageUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80'
  },
];

const NEARBY = [
  { 
    id: '4', 
    name: 'TechZone', 
    type: 'Electrónica • Accesorios', 
    reward: 25, 
    distance: '800m',
    imageUrl: 'https://images.unsplash.com/photo-1603313011101-320f26a4f6f6?w=800&q=80'
  },
  { 
    id: '5', 
    name: 'Nail Studio', 
    type: 'Belleza • Cuidado Personal', 
    reward: 40, 
    distance: '1.2km',
    imageUrl: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=800&q=80'
  },
];

export default function DiscoverPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [isScrolled, setIsScrolled] = useState(false);

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

  useEffect(() => {
    import('@twa-dev/sdk').then((mod) => {
      const app = mod.default;
      app.ready();
      app.expand();
    });
  }, []);

  return (
    <div className="page-wrap pb-28 bg-white">
      <div className={`sticky top-0 z-[60] bg-white transition-shadow duration-300 ${isScrolled ? 'shadow-[0_2px_8px_rgba(0,0,0,0.04)]' : ''}`}>
        <div style={{ height: 'var(--safe-top)' }} />
        <Header showBack={true} isScrolled={isScrolled} />
      </div>

      <main className="flex-1 w-full max-w-[600px] mx-auto px-4" style={{ backgroundColor: '#FFFFFF' }}>
        {/* Search Bar */}
        <div className="relative mt-4 mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8A8A8A]" strokeWidth={1.5} />
          <input
            type="text"
            placeholder="Buscar negocios..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#FAFAFA] border border-[#F0F0F0] rounded-xl pl-12 pr-4 py-3 text-[15px] text-[#111111] placeholder-[#8A8A8A] focus:outline-none focus:border-[#E91E63] focus:bg-white focus:ring-2 focus:ring-[#E91E63]/5 transition-all duration-300"
          />
        </div>

        {/* View Toggle */}
        <div className="flex bg-[#F5F5F5] rounded-xl p-1 mb-6">
          <button
            onClick={() => setViewMode('list')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-300 ${
              viewMode === 'list' 
                ? 'bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] text-[#111111] font-semibold' 
                : 'text-[#8A8A8A] active:opacity-60'
            }`}
          >
            <List className="w-4 h-4" strokeWidth={viewMode === 'list' ? 2 : 1.5} />
            Lista
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-300 ${
              viewMode === 'map' 
                ? 'bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] text-[#111111] font-semibold' 
                : 'text-[#8A8A8A] active:opacity-60'
            }`}
          >
            <MapIcon className="w-4 h-4" strokeWidth={viewMode === 'map' ? 2 : 1.5} />
            Mapa
          </button>
        </div>

        <AnimatePresence mode="wait">
          {viewMode === 'list' ? (
            <motion.div
              key="list-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              {/* Categories Grid */}
              <section className="mb-8">
                <h2 className="text-lg font-normal text-[#111111] mb-4 px-1">Categorías</h2>
                <div className="grid grid-cols-3 gap-3">
                  {CATEGORIES.map((cat, i) => (
                    <motion.button
                      key={cat.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.04, duration: 0.3 }}
                      className="flex flex-col items-center p-4 bg-white border border-[#F0F0F0] rounded-2xl active:scale-[0.97] transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.02)] hover:border-[#E91E63]/10"
                    >
                      <div className={`w-11 h-11 rounded-full ${cat.bg} flex items-center justify-center text-xl mb-3`}>
                        {cat.icon}
                      </div>
                      <span className="text-[13px] font-normal text-[#111111] mb-1">{cat.name}</span>
                      <span className="text-[11px] text-[#8A8A8A] font-light">{cat.count} negocios</span>
                    </motion.button>
                  ))}
                </div>
              </section>

              {/* Trending Section */}
              <section className="mb-8">
                <div className="flex items-center justify-between mb-4 px-1">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-[#E91E63]" strokeWidth={1.5} />
                    <h2 className="text-lg font-normal text-[#111111]">Tendencias</h2>
                  </div>
                  <button className="flex items-center text-[#E91E63] text-sm font-medium active:opacity-60 transition-opacity">
                    Ver todo <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  {TRENDING.map((biz, i) => (
                    <motion.div
                      key={biz.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08, duration: 0.35 }}
                      className="flex items-center gap-4 p-3 bg-white border border-[#F0F0F0] rounded-2xl active:scale-[0.99] transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.03)]"
                    >
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                        <img src={biz.imageUrl} alt={biz.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-normal text-[#111111] text-[16px] mb-0.5 truncate">{biz.name}</p>
                        <p className="text-[13px] text-[#8A8A8A] font-light truncate">{biz.type} — {biz.distance}</p>
                        <div className="flex items-center gap-1 mt-1 text-[12px] text-[#8A8A8A] font-light">
                          <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium text-[#111111]">{biz.rating}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end justify-center">
                        <Badge variant="bunz">+{biz.reward} bunz</Badge>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </section>

              {/* Nearby Section */}
              <section className="mb-8">
                <div className="flex items-center gap-2 mb-4 px-1">
                  <MapPin className="w-5 h-5 text-[#8A8A8A]" strokeWidth={1.5} />
                  <h2 className="text-lg font-normal text-[#111111]">Cerca de ti</h2>
                </div>

                <div className="space-y-4">
                  {NEARBY.map((biz, i) => (
                    <motion.div
                      key={biz.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + i * 0.08, duration: 0.35 }}
                      className="flex items-center gap-4 p-3 bg-white border border-[#F0F0F0] rounded-2xl active:scale-[0.99] transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.03)]"
                    >
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                        <img src={biz.imageUrl} alt={biz.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-normal text-[#111111] text-[16px] mb-0.5 truncate">{biz.name}</p>
                        <p className="text-[13px] text-[#8A8A8A] font-light truncate">{biz.type} — {biz.distance}</p>
                      </div>
                      <div className="flex flex-col items-end justify-center">
                        <Badge variant="bunz">+{biz.reward} bunz</Badge>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </section>
            </motion.div>
          ) : (
            /* Map View */
            <motion.div
              key="map-view"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
              className="h-[60vh] bg-white border border-[#F0F0F0] rounded-2xl flex items-center justify-center relative overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.02)]"
            >
              {/* Fake Premium Map Background with simple vector styling */}
              <div className="absolute inset-0 bg-[#F5F5F3] opacity-40 pointer-events-none" />
              <EmptyState
                icon={<MapIcon className="w-12 h-12 text-[#8A8A8A]" strokeWidth={1.5} />}
                title="Mapa en desarrollo"
                description="La vista de mapa estará disponible próximamente integrada directamente con Google Maps."
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  );
}
