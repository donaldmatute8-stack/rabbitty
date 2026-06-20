'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Store, MapPin, Percent } from 'lucide-react';
import BottomNav from '@/components/BottomNav';

type Business = {
  id: string;
  name: string;
  category: string;
  logoUrl: string | null;
  rewardPercentage: number;
  address: string;
};

export default function DiscoverPage() {
  const [query, setQuery] = useState('');
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    import('@twa-dev/sdk').then((mod) => {
      const app = mod.default;
      app.ready();
      app.expand();
    });
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setBusinesses([]);
      return;
    }
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/business/search?q=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then(data => {
          if (data.success) setBusinesses(data.businesses || []);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="page-wrap pb-28 bg-white" style={{ fontFamily: "var(--font-family-base)" }}>
      <div style={{ height: 'var(--safe-top)' }} />
      <div className="p-4">
        <h1 className="text-[28px] font-[800] text-[#111] tracking-[-0.5px] m-0 mb-4">Descubrir</h1>

        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8A8A8A]" strokeWidth={1.5} />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar negocios..."
            className="w-full bg-[#F5F5F5] rounded-xl pl-12 pr-4 py-3 text-[15px] text-[#111] placeholder-[#8A8A8A] focus:outline-none focus:ring-2 focus:ring-[#E91E63]/20"
          />
        </div>

        {loading && <p className="text-sm text-[#8A8A8A] text-center py-8">Buscando...</p>}

        {!loading && businesses.length === 0 && query && (
          <p className="text-sm text-[#8A8A8A] text-center py-8">No se encontraron negocios.</p>
        )}

        {!loading && !query && (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-[#F5F5F5] rounded-full flex items-center justify-center mx-auto mb-4">
              <Store size={32} className="text-[#8A8A8A]" />
            </div>
            <p className="text-[#8A8A8A] text-sm">Busca negocios afiliados a Rabbitty</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {businesses.map((biz, i) => (
            <motion.a
              key={biz.id}
              href={`/affiliate/${biz.id}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-4 p-4 bg-[#F5F5F5] rounded-xl no-underline active:scale-[0.98] transition-transform"
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#E91E63] to-[#C2185B] flex items-center justify-center text-white text-lg font-bold shrink-0">
                {biz.logoUrl ? (
                  <img src={biz.logoUrl} alt={biz.name} className="w-full h-full rounded-full object-cover" />
                ) : (
                  biz.name[0]
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[15px] text-[#111] truncate">{biz.name}</p>
                <p className="text-[13px] text-[#8A8A8A]">{biz.category}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs font-bold text-[#E91E63]">+{biz.rewardPercentage}%</span>
                <span className="text-[11px] text-[#8A8A8A]">bunz</span>
              </div>
            </motion.a>
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
