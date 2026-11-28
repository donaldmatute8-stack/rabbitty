'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw, Ticket, X, Check } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useToast } from '@/contexts/ToastContext';
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
    offerId: string;
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
  const { showToast } = useToast();
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [redeemResult, setRedeemResult] = useState<{
    code: string;
    title: string;
    businessName: string;
    expiresAt: string;
  } | null>(null);

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

  const redeem = useCallback(
    async (b: Biz) => {
      if (!b.spend?.offerId || redeeming) return;
      setRedeeming(b.spend.offerId);
      try {
        const headers = await PlatformBridge.getAuthHeaders().catch(() => null);
        const res = await fetch('/api/offers/redeem', {
          method: 'POST',
          headers: { ...(headers || {}), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            offerId: b.spend.offerId,
            idempotencyKey: `${b.spend.offerId}:${Date.now()}`,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) {
          showToast(data?.error || 'No pudimos completar el canje.', 'error');
          return;
        }
        setRedeemResult({
          code: String(data.code),
          title: String(data.offer?.title ?? b.spend.title),
          businessName: String(data.businessName ?? b.user),
          expiresAt: String(data.expiresAt ?? ''),
        });
        void load();
      } catch {
        showToast('No pudimos completar el canje.', 'error');
      } finally {
        setRedeeming(null);
      }
    },
    [redeeming, showToast, load],
  );

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
            onRedeem={b.spend?.affordable ? () => void redeem(b) : undefined}
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

      {/* Código del canje */}
      <AnimatePresence>
        {redeemResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[130] flex items-center justify-center p-5"
            style={{ background: 'rgba(6,4,10,0.9)', backdropFilter: 'blur(6px)' }}
          >
            <motion.div
              initial={{ scale: 0.94, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-sm overflow-hidden rounded-3xl"
              style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(233,30,99,0.45)' }}
            >
              <div className="flex items-start justify-between gap-2 bg-[#E91E63] px-4 py-3">
                <div>
                  <p className="m-0 text-[10px] font-black uppercase tracking-[0.2em] text-white/80">Canje listo</p>
                  <p className="m-0 mt-0.5 text-[14px] font-black text-white">{redeemResult.title}</p>
                  <p className="m-0 text-[11px] font-bold text-white/80">{redeemResult.businessName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setRedeemResult(null)}
                  className="rounded-full bg-white/15 p-1.5 text-white"
                  aria-label="Cerrar"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 text-center">
                <p className="m-0 text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>
                  Muestra este código en el local
                </p>
                <p className="m-0 mt-2 text-[38px] font-black tracking-[0.18em] text-[#E91E63]">
                  {redeemResult.code}
                </p>
                <p className="m-0 mt-2 flex items-center justify-center gap-1.5 text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>
                  <Ticket size={12} /> Vence {new Date(redeemResult.expiresAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
                <p className="m-0 mt-3 rounded-xl bg-emerald-500/10 px-3 py-2 text-[10.5px] font-bold text-emerald-500">
                  <Check size={11} className="mr-1 inline" /> Ya se descontaron tus Bunz. Si no lo usas antes del vencimiento, se te devuelven.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
