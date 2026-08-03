'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, MapPin, Crosshair } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import BottomNav from '@/components/BottomNav';
import Header from '@/components/ui/Header';
import EmptyState from '@/components/ui/EmptyState';

const InteractiveMap = dynamic(() => import('@/features/map/InteractiveMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-[#0D0D1A] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-pink-500/30 border-t-pink-500 animate-spin" />
    </div>
  ),
});

type Biz = {
  id: string;
  name: string;
  category: string;
  rewardPercentage: number;
  lat: number;
  lng: number;
  address: string;
};

const FILTERS = ['Todos', 'Cafés', 'Restaurantes', 'Gimnasios', 'Retail', 'Belleza'];

export default function MapPage() {
  const [activeFilter, setActiveFilter] = useState('Todos');
  const [showList, setShowList] = useState(true);
  const [businesses, setBusinesses] = useState<Biz[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import('@twa-dev/sdk').then((mod) => {
      const app = mod.default;
      app.ready();
      app.expand();
    });
  }, []);

  useEffect(() => {
    fetch('/api/feed')
      .then(r => r.json())
      .then((data: any) => {
        if (data.success) {
          const withCoords = data.data.filter((b: any) => b.lat && b.lng);
          setBusinesses(withCoords);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = activeFilter === 'Todos'
    ? businesses
    : businesses.filter(b => b.category?.toLowerCase().includes(activeFilter.replace('s', '').toLowerCase()));

  return (
    <div className="page-wrap pb-28 bg-white">
      <div style={{ height: 'var(--safe-top)' }} />
      <Header />

      <main className="flex-1 relative">
        <div className="h-[50vh] bg-[#0D0D1A] relative overflow-hidden">
          <InteractiveMap businesses={businesses} />
        </div>

        <motion.div
          initial={{ y: 100 }}
          animate={{ y: showList ? 0 : 300 }}
          transition={{ type: 'spring', damping: 25 }}
          className="bg-white rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)]"
        >
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-12 h-1 bg-gray-300 rounded-full" />
          </div>

          <div className="px-4 pb-3">
            <div className="relative mb-3">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8A8A8A]" strokeWidth={1.5} />
              <input
                type="text"
                placeholder="Buscar negocios..."
                className="w-full bg-[#F5F5F5] rounded-xl pl-12 pr-4 py-3 text-[15px] text-[#111] placeholder-[#8A8A8A] focus:outline-none focus:ring-2 focus:ring-[#E91E63]/20"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto">
              {FILTERS.map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    activeFilter === filter ? 'bg-[#111] text-white' : 'bg-[#F5F5F5] text-[#8A8A8A]'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="px-4 pb-6 space-y-3 max-h-[40vh] overflow-y-auto">
            {loading && <p className="text-center text-[#8A8A8A] py-4">Cargando...</p>}

            {!loading && filtered.length === 0 && (
              <p className="text-center text-[#8A8A8A] py-4">No hay negocios con ubicación disponible.</p>
            )}

            {filtered.map((business, i) => (
              <Link
                key={business.id}
                href={`/affiliate/${business.id}`}
                className="flex items-center gap-4 bg-[#F5F5F5] rounded-xl p-4 no-underline active:scale-[0.98] transition-transform"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#E91E63] to-[#C2185B] flex items-center justify-center text-white text-lg font-bold shrink-0">
                  {business.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[15px] text-[#111] truncate">{business.name}</p>
                  <p className="text-[13px] text-[#8A8A8A]">{business.category}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-xs font-bold text-[#E91E63]">+{business.rewardPercentage}%</span>
                  <span className="text-[11px] text-[#8A8A8A]">bunz</span>
                </div>
              </Link>
            ))}
          </div>
        </motion.div>
      </main>
      <BottomNav />
    </div>
  );
}
