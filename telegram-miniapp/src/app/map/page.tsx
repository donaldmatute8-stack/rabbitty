'use client';

import { Suspense, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import BottomNav from '@/components/BottomNav';
import Header from '@/components/ui/Header';
import { PlatformBridge } from '@/lib/platform';

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

type FeedResponse = {
  success?: boolean;
  data?: Biz[];
};

// Inner component that uses useSearchParams — must be inside Suspense
function MapPageInner() {
  const searchParams = useSearchParams();
  const targetLat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : null;
  const targetLng = searchParams.get('lng') ? parseFloat(searchParams.get('lng')!) : null;

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
      .then(r => r.json() as Promise<FeedResponse>)
      .then((data) => {
        if (data?.success && Array.isArray(data.data)) {
          const withCoords = data.data.filter((b): b is Biz => typeof b?.lat === 'number' && typeof b?.lng === 'number');
          setBusinesses(withCoords);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const [userCoords, setUserCoords] = useState<{ lat: number | null; lng: number | null }>({
    lat: targetLat,
    lng: targetLng,
  });
  const [isLocating, setIsLocating] = useState(false);

  const requestLocation = async () => {
    setIsLocating(true);
    try {
      const loc = await PlatformBridge.getLocation();
      if (loc.success && loc.lat != null && loc.lng != null) {
        setUserCoords({ lat: loc.lat, lng: loc.lng });
      }
    } finally {
      setIsLocating(false);
    }
  };

  useEffect(() => {
    if (targetLat != null && targetLng != null) return;
    PlatformBridge.getLocation().then((loc) => {
      if (loc.success && loc.lat != null && loc.lng != null) {
        setUserCoords({ lat: loc.lat, lng: loc.lng });
      }
    });
  }, [targetLat, targetLng]);

  const filtered = activeFilter === 'Todos'
    ? businesses
    : businesses.filter(b => b.category?.toLowerCase().includes(activeFilter.replace('s', '').toLowerCase()));

  return (
    <div className="page-wrap pb-28" style={{ background: 'var(--bg-primary)' }}>
      <div style={{ height: 'var(--safe-top)' }} />
      <Header />

      <main className="flex-1 relative">
        <div className="h-[50vh] bg-[#0D0D1A] relative overflow-hidden">
          <InteractiveMap
            businesses={businesses}
            userLat={userCoords.lat}
            userLng={userCoords.lng}
            onRequestLocation={requestLocation}
            isLocating={isLocating}
          />
        </div>

        <motion.div
          initial={{ y: 100 }}
          animate={{ y: showList ? 0 : 300 }}
          transition={{ type: 'spring', damping: 25 }}
            className="rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)]"
            style={{ background: 'var(--bg-primary)' }}
        >
          <button
            type="button"
            onClick={() => setShowList(!showList)}
            className="w-full flex justify-center pt-3 pb-2 focus:outline-none"
            aria-label="Toggle list view"
          >
            <div className="w-12 h-1 bg-gray-300 rounded-full" />
          </button>

          <div className="px-4 pb-3">
            <div className="relative mb-3">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8A8A8A]" strokeWidth={1.5} />
              <input
                type="text"
                placeholder="Buscar negocios..."
                className="w-full rounded-xl pl-12 pr-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-(--border-focus)/20"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              />
            </div>

            <div className="flex gap-2 overflow-x-auto">
              {FILTERS.map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    activeFilter === filter ? 'bg-[#111] text-white' : ''
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

            {filtered.map((business) => (
              <Link
                key={business.id}
                href={`/affiliate/${business.id}`}
                className="flex items-center gap-4 rounded-xl p-4 no-underline active:scale-[0.98] transition-transform"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
              >
                <div className="w-12 h-12 rounded-full bg-linear-to-br from-[#E91E63] to-[#C2185B] flex items-center justify-center text-white text-lg font-bold shrink-0">
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

// Outer page wraps inner in Suspense to satisfy Next.js static-page requirement for useSearchParams
export default function MapPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-[#0D0D1A]">
        <div className="w-10 h-10 rounded-full border-2 border-pink-500/30 border-t-pink-500 animate-spin" />
      </div>
    }>
      <MapPageInner />
    </Suspense>
  );
}
