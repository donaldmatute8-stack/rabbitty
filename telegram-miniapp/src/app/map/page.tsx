'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Navigation, MapPin, Filter, Crosshair } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import Header from '@/components/ui/Header';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';

const FILTERS = ['Todos', 'Cafés', 'Restaurantes', 'Gimnasios', 'Retail', 'Belleza'];

const NEARBY_BUSINESSES = [
  { id: '1', name: 'Café Cultura', type: 'Café', rewardRate: 25, distance: '120m', rating: 4.8, lat: 0, lng: 0 },
  { id: '2', name: 'Pizza Napoli', type: 'Restaurante', rewardRate: 30, distance: '350m', rating: 4.6, lat: 0, lng: 0 },
  { id: '3', name: 'Gimnasio Power', type: 'Gym', rewardRate: 20, distance: '500m', rating: 4.9, lat: 0, lng: 0 },
  { id: '4', name: 'TechZone', type: 'Electrónica', rewardRate: 15, distance: '800m', rating: 4.5, lat: 0, lng: 0 },
];

export default function MapPage() {
  const [activeFilter, setActiveFilter] = useState('Todos');
  const [showList, setShowList] = useState(true);

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

      <main className="flex-1 relative">
        {/* Map Placeholder */}
        <div className="h-[50vh] bg-[#F5F5F5] relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <EmptyState
              icon={<MapPin className="w-12 h-12 text-[#8A8A8A]" />}
              title="Mapa en desarrollo"
              description="Integración con Google Maps próximamente."
            />
          </div>

          {/* Map Controls */}
          <div className="absolute top-4 right-4 flex flex-col gap-2">
            <button className="w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center active:scale-95 transition-transform">
              <Crosshair className="w-5 h-5 text-[#111111]" />
            </button>
            <button 
              onClick={() => setShowList(!showList)}
              className="w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center active:scale-95 transition-transform"
            >
              <Navigation className="w-5 h-5 text-[#111111]" />
            </button>
          </div>
        </div>

        {/* Bottom Sheet - Business List */}
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: showList ? 0 : 300 }}
          transition={{ type: 'spring', damping: 25 }}
          className="bg-white rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)]"
        >
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-12 h-1 bg-gray-300 rounded-full" />
          </div>

          {/* Search & Filters */}
          <div className="px-4 pb-3">
            <div className="relative mb-3">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8A8A8A]" strokeWidth={1.5} />
              <input
                type="text"
                placeholder="Buscar negocios..."
                className="w-full bg-[#F5F5F5] rounded-xl pl-12 pr-4 py-3 text-[15px] text-[#111111] placeholder-[#8A8A8A] focus:outline-none focus:ring-2 focus:ring-[#E91E63]/20"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto">
              {FILTERS.map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    activeFilter === filter
                      ? 'bg-[#111111] text-white'
                      : 'bg-[#F5F5F5] text-[#8A8A8A]'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {/* Business List */}
          <div className="px-4 pb-6 space-y-3 max-h-[40vh] overflow-y-auto">
            {NEARBY_BUSINESSES.map((business, i) => (
              <motion.div
                key={business.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="bg-[#F5F5F5] rounded-xl p-4 flex items-center gap-4"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#E91E63] to-[#C2185B] flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                  {business.name[0]}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="font-medium text-[15px] text-[#111111] truncate">{business.name}</p>
                    <span className="text-xs text-[#8A8A8A]">{business.distance}</span>
                  </div>
                  <p className="text-[13px] text-[#8A8A8A]">{business.type}</p>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <Badge variant="bunz">+{business.rewardRate}% bunz</Badge>
                  <div className="flex items-center gap-1 text-[12px] text-[#8A8A8A]">
                    ⭐ {business.rating}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </main>

      <BottomNav />
    </div>
  );
}
