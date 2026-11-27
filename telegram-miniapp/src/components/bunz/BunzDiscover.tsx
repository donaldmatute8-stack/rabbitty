'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { MapPin, Clock, Search, Sparkles, ChevronRight, Wallet, RefreshCw } from 'lucide-react';
import { PlatformBridge } from '@/lib/platform';
import { SkeletonCard } from '@/components/ui/Skeleton';

/**
 * ── Bunz · descubrimiento (v2) ──────────────────────────────────────────────
 *
 * Una sola lista. Sin switch "ganar/gastar": cada tarjeta muestra lo que aplica
 * para este Rabbitter (saldo + stock + horario) y el servidor la ordena.
 *
 *  · Puedes canjear  → cinta + CTA Canjear
 *  · No te alcanza   → "te faltan N", sin CTA de canje
 *  · Solo recompensa → "+X%"
 *  · Sin nada        → no se lista
 *
 * La cinta de billetera informa (no es un control).
 */

interface Biz {
  id: string;
  name: string;
  category: string | null;
  niche: string | null;
  imageUrl: string;
  logoUrl: string | null;
  distanceKm: number | null;
  open: boolean;
  opensAt: string;
  earn: { pct: number } | null;
  spend: {
    title: string;
    minCost: number;
    canjesDisponibles: number;
    affordable: boolean;
    faltan: number;
  } | null;
  tags: string[];
}

interface Props {
  isDark: boolean;
  userLat?: number | null;
  userLng?: number | null;
  fallbackBalance?: number;
}

const money = (n: number) => Number(n || 0).toLocaleString('es-MX');

export default function BunzDiscover({ isDark, userLat, userLng, fallbackBalance = 0 }: Props) {
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
        b.name?.toLowerCase().includes(q) ||
        b.category?.toLowerCase().includes(q) ||
        b.niche?.toLowerCase().includes(q),
    );
  }, [businesses, query]);

  const canjearCount = businesses.filter((b) => b.spend?.affordable && b.spend.canjesDisponibles > 0).length;
  const earnCount = businesses.filter((b) => b.earn).length;

  return (
    <div>
      {/* Cinta de billetera: informa, no se toca */}
      <div
        className="mb-3 flex items-center gap-2 rounded-2xl px-3 py-2.5"
        style={{
          background: isDark ? 'rgba(233,30,99,0.10)' : 'rgba(233,30,99,0.07)',
          border: '1px solid rgba(233,30,99,0.22)',
        }}
      >
        <Wallet size={15} className="shrink-0 text-[#E91E63]" />
        <p className="m-0 text-[11.5px] font-bold leading-snug" style={{ color: 'var(--text-secondary)' }}>
          <span className="font-black" style={{ color: 'var(--text-primary)' }}>{money(balance)} Bunz</span>
          {canjearCount > 0
            ? ` · puedes canjear en ${canjearCount} ${canjearCount === 1 ? 'lugar' : 'lugares'}`
            : ` · gana tus primeros en ${earnCount} ${earnCount === 1 ? 'lugar' : 'lugares'}`}
        </p>
      </div>

      {/* Buscador: único control (sin chips en v1) */}
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
        <div className="rounded-2xl p-6 text-center" style={{ background: 'var(--bg-elevated)', border: '1px dashed var(--border-subtle)' }}>
          <p className="m-0 text-sm font-black" style={{ color: 'var(--text-primary)' }}>
            {query ? 'Nada con esa búsqueda' : 'Aún no hay nada cerca de ti'}
          </p>
          <p className="m-0 mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            {query ? 'Prueba con otra palabra.' : 'Estamos sumando negocios; vuelve pronto.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((b, i) => (
            <BizCard key={b.id} b={b} isDark={isDark} index={i} balance={balance} />
          ))}
        </div>
      )}
    </div>
  );
}

function BizCard({ b, isDark, index, balance }: { b: Biz; isDark: boolean; index: number; balance: number }) {
  const canjear = Boolean(b.spend?.affordable && b.spend.canjesDisponibles > 0);
  const href = `/affiliate/${b.id}`;
  const distance =
    b.distanceKm == null
      ? null
      : b.distanceKm < 0.1
        ? 'Aquí'
        : b.distanceKm < 1
          ? `${Math.round(b.distanceKm * 1000)} m`
          : `${b.distanceKm.toFixed(1)} km`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.2) }}
      className="relative overflow-hidden rounded-[22px]"
      style={{
        background: 'var(--bg-elevated)',
        border: canjear ? '1.5px solid rgba(233,30,99,0.55)' : '1px solid var(--border-subtle)',
        boxShadow: canjear ? '0 10px 32px -22px rgba(233,30,99,0.9)' : 'none',
        opacity: b.open ? 1 : 0.72,
      }}
    >
      {canjear && (
        <div className="flex items-center gap-1.5 bg-[#E91E63] px-3 py-1">
          <Sparkles size={11} className="text-white" />
          <span className="text-[9.5px] font-black uppercase tracking-[0.14em] text-white">
            Puedes canjear aquí
          </span>
        </div>
      )}

      <div className="flex gap-3 p-3.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={b.logoUrl || b.imageUrl}
          alt={b.name}
          className="h-14 w-14 shrink-0 rounded-2xl object-cover"
          style={{ border: '1px solid var(--border-subtle)' }}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="m-0 truncate text-[14.5px] font-black" style={{ color: 'var(--text-primary)' }}>
                {b.name}
              </p>
              <p className="m-0 mt-0.5 flex items-center gap-1.5 truncate text-[10.5px] font-bold" style={{ color: 'var(--text-muted)' }}>
                {b.category || 'Negocio'}
                {distance && (<><span>·</span><MapPin size={10} />{distance}</>)}
              </p>
            </div>
            <span
              className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-black"
              style={{
                background: b.open ? 'rgba(16,185,129,0.14)' : 'rgba(148,163,184,0.14)',
                color: b.open ? '#10B981' : 'var(--text-muted)',
              }}
            >
              <Clock size={9} />
              {b.open
                ? `Cierra ${(b.opensAt || '').split('–')[1] || ''}`
                : `Abre ${(b.opensAt || '').split('–')[0] || ''}`}
            </span>
          </div>

          <div className="mt-2 space-y-1">
            {b.spend ? (
              <p className="m-0 text-[11.5px] font-bold" style={{ color: 'var(--text-secondary)' }}>
                <span className="font-black" style={{ color: canjear ? '#E91E63' : 'var(--text-primary)' }}>
                  Desde {b.spend.minCost} Bunz
                </span>
                {canjear
                  ? ` · te alcanza para ${Math.min(b.spend.canjesDisponibles, Math.floor(balance / Math.max(1, b.spend.minCost)))}`
                  : ` · te faltan ${Math.max(0, b.spend.faltan)}`}
              </p>
            ) : null}

            {b.earn ? (
              <p className="m-0 text-[11.5px] font-bold" style={{ color: 'var(--text-secondary)' }}>
                Te da <span className="font-black text-[#E91E63]">+{b.earn.pct}%</span> en Bunz
              </p>
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {b.spend && b.spend.canjesDisponibles <= 4 && (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-black text-amber-500">
                Últimas {b.spend.canjesDisponibles}
              </span>
            )}
            {b.tags.includes('Cerrado') && (
              <span className="rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ background: 'var(--bg-pressed)', color: 'var(--text-muted)' }}>
                Cerrado ahora
              </span>
            )}
          </div>
        </div>
      </div>

      <Link
        href={href}
        onClick={() => PlatformBridge.hapticFeedback('light')}
        className="flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-black no-underline active:opacity-80"
        style={{
          background: canjear ? '#E91E63' : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
          color: canjear ? '#fff' : 'var(--text-primary)',
          borderTop: canjear ? 'none' : '1px solid var(--border-subtle)',
        }}
      >
        {canjear ? 'Canjear' : 'Ver'}
        <ChevronRight size={14} />
      </Link>
    </motion.div>
  );
}
