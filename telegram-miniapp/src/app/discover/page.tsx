'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Search, Store, Sparkles, ChevronLeft } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import { PlatformBridge } from '@/lib/platform';

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
  const router = useRouter();
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
      
      {/* Rabbitty Identity Header: Back arrow left, Central Pill title */}
      <div className="flex items-center justify-between px-4 py-3 sticky top-0 z-30" style={{ background: 'var(--bg-primary)' }}>
        <button
          type="button"
          onClick={() => {
            PlatformBridge.hapticFeedback('light');
            if (window.history.length > 1) {
              router.back();
            } else {
              router.push('/');
            }
          }}
          className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer border-none active:scale-90 transition-transform"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
          aria-label="Volver"
        >
          <ChevronLeft size={20} strokeWidth={2.5} />
        </button>

        {/* Central Pill */}
        <div 
          className="px-4 py-1.5 rounded-full flex items-center justify-center shadow-xs"
          style={{ 
            background: 'var(--bg-elevated)', 
            border: '1px solid var(--border-subtle)',
          }}
        >
          <span className="text-[14px] font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Descubrir
          </span>
        </div>

        {/* Spacer for symmetrical centering */}
        <div className="w-10" />
      </div>

      <div className="p-4 pt-1">
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
            <div className="rounded-3xl p-4.5 bg-linear-to-br from-[#E91E63]/20 via-[#1F0A17]/80 to-zinc-950/90 border border-[#E91E63]/30 shadow-[0_8px_32px_rgba(233,30,99,0.12)]">
              <div className="flex items-center justify-between mb-2.5">
                <span className="flex items-center gap-2 text-xs font-black text-[#E91E63] uppercase tracking-wider">
                  <div className="w-5 h-5 rounded-md bg-[#E91E63]/20 flex items-center justify-center border border-[#E91E63]/40">
                    <Sparkles size={12} className="text-[#E91E63]" />
                  </div>
                  <span>Rabbitty Vibe Passport</span>
                </span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#E91E63]/20 text-pink-300 font-extrabold border border-[#E91E63]/30 uppercase tracking-wider">
                  Rutas de la Ciudad
                </span>
              </div>
              <p className="text-xs text-white/70 leading-relaxed mb-4">
                Recorre la ciudad con pasaportes temáticos entre locales afiliados. Gana Bunz minteados al consumir en cada parada.
              </p>

              <div className="space-y-3.5">
                {passportRoutes.map((route) => (
                  <div key={route.id} className="p-4 rounded-2xl bg-[#120E15]/80 border border-white/10 space-y-3 shadow-inner">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-black text-white block tracking-tight">{route.title}</span>
                        <span className="text-[10px] text-[#E91E63] font-bold tracking-wide uppercase">{route.theme} · {route.estimatedHours}</span>
                      </div>
                      <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${route.isCompleted ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-[#E91E63]/15 text-pink-300 border border-[#E91E63]/25'}`}>
                        {route.completedStopsCount}/{route.stops.length} Sellos
                      </span>
                    </div>
                    <p className="text-[11px] text-white/60 leading-normal">
                      {route.description}
                    </p>
                    <div className="space-y-2 pt-1">
                      {route.stops.map((stop) => {
                        const isStamped = route.stamps?.some((s) => s.stopOrder === stop.order);
                        const isStampingThis = stamping === `${route.id}-${stop.order}`;
                        return (
                          <div key={stop.order} className="flex items-center justify-between p-2.5 rounded-xl bg-white/4 border border-white/8 text-xs hover:border-[#E91E63]/30 transition-colors">
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${isStamped ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-[#E91E63]/20 text-[#E91E63] border border-[#E91E63]/30'}`}>
                                {isStamped ? '✓' : stop.order}
                              </span>
                              <div className="min-w-0 truncate">
                                <span className={`font-bold block truncate ${isStamped ? 'text-emerald-400 line-through' : 'text-white'}`}>
                                  {stop.category}
                                </span>
                                <span className="text-[10px] text-white/50 block truncate">{stop.pairingHint}</span>
                              </div>
                            </div>
                            {!isStamped ? (
                              <button
                                onClick={() => handleManualStamp(route.id, stop.order, stop.vibeRequired)}
                                disabled={isStampingThis}
                                className="px-3 py-1.5 rounded-lg bg-[#E91E63] hover:bg-[#D81B60] active:scale-95 text-white text-[10px] font-black border-none cursor-pointer disabled:opacity-50 shadow-[0_2px_10px_rgba(233,30,99,0.35)] shrink-0 transition-transform"
                              >
                                {isStampingThis ? '...' : 'Sellar'}
                              </button>
                            ) : (
                              <span className="text-[10px] font-black text-emerald-400 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 shrink-0">Sellado</span>
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
