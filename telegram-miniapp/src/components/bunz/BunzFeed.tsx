'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { PlatformBridge } from '@/lib/platform';
import FeedCard from '@/components/ui/FeedCard';
import { SkeletonCard } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';

/**
 * ── Bunz · feed social + capa Bunz ──────────────────────────────────────────
 *
 * Se conserva la tarjeta social de siempre (Hop, Madriguera, Compartir, foto,
 * +X% BUNZ) y se le AGREGA la capa Bunz: cuánto cuesta canjear, si te alcanza y
 * si está abierto. Sin switch "ganar/gastar": la lista se ordena sola y cada
 * tarjeta muestra lo que aplica.
 */

interface Biz {
  id: string;
  user: string;
  device: string;
  label: string;
  bunz: number;
  imageUrl: string;
  hops: number;
  savedCount: number;
  sharedCount: number;
  open: boolean;
  opensAt: string;
  spend: {
    title: string;
    minCost: number;
    canjesDisponibles: number;
    affordable: boolean;
    faltan: number;
  } | null;
}

interface Props {
  isDark: boolean;
  userLat?: number | null;
  userLng?: number | null;
  fallbackBalance?: number;
  /** Resume el feed para mostrarlo dentro del Rabbitty Pass (sin duplicar). */
  onSummary?: (summary: { balance: number; canjearPlaces: number; earnPlaces: number }) => void;
}

export default function BunzFeed({ isDark, userLat, userLng, fallbackBalance = 0, onSummary }: Props) {
  const [businesses, setBusinesses] = useState<Biz[]>([]);
  const [balance, setBalance] = useState(fallbackBalance);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setError(false);
    try {
      const headers = await PlatformBridge.getAuthHeaders().catch(() => null);
      const params = new URLSearchParams();
      if (Number.isFinite(userLat)) params.set('lat', String(userLat));
      if (Number.isFinite(userLng)) params.set('lng', String(userLng));
      const res = await fetch(`/api/bunz/discover?${params.toString()}`, {
        headers: headers || undefined,
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('bad status');
      const data = await res.json();
      if (data?.success) {
        setBusinesses(Array.isArray(data.businesses) ? data.businesses : []);
        setBalance(Number(data.balance ?? fallbackBalance));
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [userLat, userLng, fallbackBalance]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return businesses;
    return businesses.filter(
      (b) =>
        b.user?.toLowerCase().includes(q) ||
        b.device?.toLowerCase().includes(q),
    );
  }, [businesses, query]);

  const canjearCount = businesses.filter((b) => b.spend?.affordable && b.spend.canjesDisponibles > 0).length;
  const earnCount = businesses.filter((b) => b.bunz > 0).length;

  useEffect(() => {
    if (!onSummary) return;
    onSummary({ balance, canjearPlaces: canjearCount, earnPlaces: earnCount });
  }, [onSummary, balance, canjearCount, earnCount]);

  return (
    <div>
      {/* Buscador: único control */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar negocio, café, corte…"
          className="w-full rounded-full px-4 py-3 pl-10 text-sm outline-none"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-family-base)',
          }}
        />
      </div>

      {loading ? (
        <><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
      ) : error ? (
        <div className="rounded-2xl p-5 text-center" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
          <p className="m-0 text-sm font-black" style={{ color: 'var(--text-primary)' }}>No pudimos cargar Bunz</p>
          <button
            type="button"
            onClick={() => { setLoading(true); void load(); }}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#E91E63] px-4 py-2 text-xs font-black text-white"
          >
            <RefreshCw size={13} /> Reintentar
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<span className="text-4xl">🐇</span>}
          title={query ? 'Nada con esa búsqueda' : 'Sin negocios aún'}
          description={
            query
              ? 'Prueba con otra palabra.'
              : 'No hay afiliados disponibles cerca de ti en este momento.'
          }
        />
      ) : (
        filtered.map((b, i) => (
          <FeedCard
            key={b.id}
            id={b.id}
            user={b.user}
            device={b.device}
            label={b.label}
            bunz={b.bunz}
            imageUrl={b.imageUrl}
            initialHops={b.hops}
            initialSavedCount={b.savedCount}
            initialSharedCount={b.sharedCount}
            index={i}
            spend={
              b.spend
                ? {
                    ...b.spend,
                    canjesParaMi: Math.max(
                      1,
                      Math.min(
                        b.spend.canjesDisponibles,
                        Math.floor(balance / Math.max(1, b.spend.minCost)),
                      ),
                    ),
                  }
                : null
            }
            open={b.open}
            hours={b.opensAt}
          />
        ))
      )}
    </div>
  );
}
