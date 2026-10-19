'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Store } from 'lucide-react';
import BottomNav from '@/components/BottomNav';

import { VibePassportRoute } from '@/types/mood';

type Business = {
  id: string;
  name: string;
  category: string;
  logoUrl: string | null;
  rewardPercentage: number;
  address: string;
};

interface PassportStampItem {
  id: string;
  routeId: string;
  stopOrder: number;
  vibe: string;
}

interface PassportRouteWithProgress extends VibePassportRoute {
  stamps?: PassportStampItem[];
  completedStopsCount?: number;
  isCompleted?: boolean;
}

export default function DiscoverPage() {
  const [query, setQuery] = useState('');
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(false);

  const [passportRoutes, setPassportRoutes] = useState<PassportRouteWithProgress[]>([]);
  const [stamping, setStamping] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/mood/passport')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.routes) {
          setPassportRoutes(d.routes);
        }
      })
      .catch(() => {});
  }, []);

  const handleManualStamp = async (routeId: string, stopOrder: number, vibe: string) => {
    try {
      setStamping(`${routeId}-${stopOrder}`);
      const res = await fetch('/api/mood/passport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routeId,
          stopOrder,
          vibe,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Refresh routes
        const rRes = await fetch('/api/mood/passport');
        const rData = await rRes.json();
        if (rData.success && rData.routes) {
          setPassportRoutes(rData.routes);
        }
      }
    } catch {
      // ignore
    } finally {
      setStamping(null);
    }
  };

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (!val.trim()) {
      setBusinesses([]);
    }
  };

  useEffect(() => {
    if (!query.trim()) return;
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
    <div className="page-wrap pb-28" style={{ fontFamily: "var(--font-family-base)", background: 'var(--bg-primary)' }}>
      <div style={{ height: 'var(--safe-top)' }} />
      <div className="p-4">
        <h1 className="text-[28px] font-extrabold tracking-[-0.5px] m-0 mb-4" style={{ color: 'var(--text-primary)' }}>Descubrir</h1>

        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
          <input
            type="text"
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            placeholder="Buscar negocios..."
            className="w-full rounded-xl pl-12 pr-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-(--border-focus)/20"
            style={{
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
            }}
          />
        </div>

        {loading && <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>Buscando...</p>}

        {!loading && businesses.length === 0 && query && (
          <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No se encontraron negocios.</p>
        )}

        {!loading && !query && (
          <div className="space-y-6">
            {/* Vibe Passport Spotlight */}
            <div className="rounded-2xl p-4 bg-linear-to-br from-amber-500/15 via-purple-500/10 to-transparent border border-amber-500/30">
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5 text-xs font-black text-amber-400 uppercase tracking-wider">
                  <span>🧭</span> Rabbitty Vibe Passport
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">
                  Rutas de la Ciudad
                </span>
              </div>
              <p className="text-xs text-white/70 leading-relaxed mb-4">
                Recorre la ciudad con pasaportes temáticos entre locales afiliados. Gana Bunz minteados al consumir en cada parada.
              </p>

              <div className="space-y-3">
                {passportRoutes.map((route) => (
                  <div key={route.id} className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-bold text-white block">{route.title}</span>
                        <span className="text-[10px] text-amber-300 font-medium">{route.theme} · {route.estimatedHours}</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${route.isCompleted ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-white/10 text-white/70'}`}>
                        {route.completedStopsCount}/{route.stops.length} Sellos
                      </span>
                    </div>
                    <p className="text-[11px] text-white/60 leading-tight">
                      {route.description}
                    </p>
                    <div className="space-y-1.5 pt-1">
                      {route.stops.map((stop) => {
                        const isStamped = route.stamps?.some((s) => s.stopOrder === stop.order);
                        const isStampingThis = stamping === `${route.id}-${stop.order}`;
                        return (
                          <div key={stop.order} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold bg-white/10 text-white">
                                {isStamped ? '✓' : stop.order}
                              </span>
                              <div>
                                <span className={`font-semibold ${isStamped ? 'text-emerald-400 line-through' : 'text-white'}`}>
                                  {stop.category}
                                </span>
                                <span className="text-[10px] text-white/50 block">{stop.pairingHint}</span>
                              </div>
                            </div>
                            {!isStamped ? (
                              <button
                                onClick={() => handleManualStamp(route.id, stop.order, stop.vibeRequired)}
                                disabled={isStampingThis}
                                className="px-2.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-bold border border-amber-500/30 cursor-pointer disabled:opacity-50"
                              >
                                {isStampingThis ? '...' : 'Sellar'}
                              </button>
                            ) : (
                              <span className="text-[10px] font-bold text-emerald-400">Sellado</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                <Store size={26} style={{ color: 'var(--text-muted)' }} />
              </div>
              <p className="text-xs text-white/50">Escribe el nombre o categoría de un comercio arriba para explorar la red.</p>
            </div>
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
              className="flex items-center gap-4 p-4 rounded-xl no-underline active:scale-[0.98] transition-transform"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="w-12 h-12 rounded-full bg-linear-to-br from-[#E91E63] to-[#C2185B] flex items-center justify-center text-white text-lg font-bold shrink-0 overflow-hidden">
                {biz.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={biz.logoUrl} alt={biz.name} className="w-full h-full rounded-full object-cover" />
                ) : (
                  biz.name[0]
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[15px] truncate" style={{ color: 'var(--text-primary)' }}>{biz.name}</p>
                <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>{biz.category}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs font-bold text-[#E91E63]">+{biz.rewardPercentage}%</span>
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>bunz</span>
              </div>
            </motion.a>
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
