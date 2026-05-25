'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Map as MapIcon, List, Star, TrendingUp, Clock, ChevronRight } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import Header from '@/components/ui/Header';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';

const CATEGORIES = [
  { id: '1', name: 'Cafés', icon: '☕', count: 12 },
  { id: '2', name: 'Restaurantes', icon: '🍕', count: 8 },
  { id: '3', name: 'Gimnasios', icon: '💪', count: 5 },
  { id: '4', name: 'Retail', icon: '🛍️', count: 15 },
  { id: '5', name: 'Belleza', icon: '💅', count: 7 },
  { id: '6', name: 'Tecnología', icon: '💻', count: 4 },
];

const TRENDING = [
  { id: '1', name: 'Café Cultura', type: 'Café', reward: 50, rating: 4.8, distance: '120m' },
  { id: '2', name: 'Pizza Napoli', type: 'Restaurante', reward: 30, rating: 4.6, distance: '350m' },
  { id: '3', name: 'Gimnasio Power', type: 'Fitness', reward: 100, rating: 4.9, distance: '500m' },
];

const NEARBY = [
  { id: '4', name: 'TechZone', type: 'Electrónica', reward: 25, distance: '800m' },
  { id: '5', name: 'Nail Studio', type: 'Belleza', reward: 40, distance: '1.2km' },
];

export default function DiscoverPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  useEffect(() => {
    import('@twa-dev/sdk').then((mod) => {
      const app = mod.default;
      app.ready();
      app.expand();
    });
  }, []);

  return (
    <div className="page-wrap pb-28 bg-white">
      <div style={{ height: 'var(--safe-top)' }} />

      <Header />

      <main className="flex-1 px-4 pt-4">
        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8A8A8A]" strokeWidth={1.5} />
          <input
            type="text"
            placeholder="Buscar negocios..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#F5F5F5] rounded-xl pl-12 pr-4 py-3.5 text-[15px] text-[#111111] placeholder-[#8A8A8A] focus:outline-none focus:ring-2 focus:ring-[#E91E63]/20"
          />
        </div>

        {/* View Toggle */}
        <div className="flex bg-[#F5F5F5] rounded-lg p-1 mb-6 mx-2">
          <button
            onClick={() => setViewMode('list')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-[13px] font-medium transition-all ${
              viewMode === 'list' ? 'bg-white shadow-sm text-[#111111]' : 'text-[#8A8A8A]'
            }`}
          >
            <List className="w-4 h-4" />
            Lista
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-[13px] font-medium transition-all ${
              viewMode === 'map' ? 'bg-white shadow-sm text-[#111111]' : 'text-[#8A8A8A]'
            }`}
          >
            <MapIcon className="w-4 h-4" />
            Mapa
          </button>
        </div>

        {viewMode === 'list' ? (
          <>
            {/* Categories Grid */}
            <section className="mb-8 px-2">
              <h2 className="text-lg font-semibold text-[#111111] mb-4">Categorías</h2>
              <div className="grid grid-cols-3 gap-3">
                {CATEGORIES.map((cat, i) => (
                  <motion.button
                    key={cat.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex flex-col items-center p-4 bg-[#F5F5F5] rounded-xl active:scale-95 transition-transform"
                  >
                    <span className="text-2xl mb-2">{cat.icon}</span>
                    <span className="text-[13px] font-medium text-[#111111]">{cat.name}</span>
                    <span className="text-[11px] text-[#8A8A8A]">{cat.count} negocios</span>
                  </motion.button>
                ))}
              </div>
            </section>

            {/* Trending Section */}
            <section className="mb-8 px-2">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#E91E63]" />
                  <h2 className="text-lg font-semibold text-[#111111]">Tendencias</h2>
                </div>
                <button className="flex items-center text-[#E91E63] text-sm font-medium">
                  Ver todo <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                {TRENDING.map((biz, i) => (
                  <motion.div
                    key={biz.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center gap-4 p-4 bg-white border border-gray-100 rounded-xl active:scale-[0.98] transition-transform"
                  >
                    <div className="w-12 h-12 rounded-full bg-[#E91E63]/10 flex items-center justify-center text-xl">
                      🔥
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-[#111111] text-[15px]">{biz.name}</p>
                      <p className="text-[13px] text-[#8A8A8A]">{biz.type} • {biz.distance}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant="bunz">+{biz.reward} bunz</Badge>
                      <div className="flex items-center gap-1 text-[12px] text-[#8A8A8A]">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        {biz.rating}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>

            {/* Nearby Section */}
            <section className="mb-8 px-2">
              <div className="flex items-center gap-2 mb-4">
                <MapIcon className="w-5 h-5 text-[#8A8A8A]" />
                <h2 className="text-lg font-semibold text-[#111111]">Cerca de ti</h2>
              </div>

              <div className="space-y-3">
                {NEARBY.map((biz, i) => (
                  <motion.div
                    key={biz.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                    className="flex items-center gap-4 p-4 bg-[#F5F5F5] rounded-xl"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <MapIcon className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-[#111111] text-[15px]">{biz.name}</p>
                      <p className="text-[13px] text-[#8A8A8A]">{biz.type} • {biz.distance}</p>
                    </div>
                    <Badge variant="bunz">+{biz.reward} bunz</Badge>
                  </motion.div>
                ))}
              </div>
            </section>
          </>
        ) : (
          /* Map View */
          <div className="h-[60vh] bg-[#F5F5F5] rounded-2xl flex items-center justify-center">
            <EmptyState
              icon={<MapIcon className="w-12 h-12 text-[#8A8A8A]" />}
              title="Mapa en desarrollo"
              description="La vista de mapa estará disponible próximamente con Google Maps."
            />
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
