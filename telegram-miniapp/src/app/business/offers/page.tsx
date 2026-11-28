'use client';

import { useCallback, useEffect, useState } from 'react';
import { Ticket, Plus, Pause, Play, RefreshCw } from 'lucide-react';
import { PlatformBridge } from '@/lib/platform';
import { useToast } from '@/contexts/ToastContext';

/**
 * ── Ofertas · Stock ────────────────────────────────────────────────────────
 * Lo que el negocio se compromete a honrar con Bunz. La disponibilidad real la
 * calcula el servidor: `min(stock, floor(respaldo / costo))`. Nunca se promete
 * más de lo que se puede honrar.
 */

interface Offer {
  id: string;
  title: string;
  description?: string | null;
  bunzCost: number;
  stockTotal: number;
  stockUsed: number;
  perUserLimit: number;
  status: string;
  canjesDisponibles: number;
  redemptions?: Record<string, number>;
}

interface BusinessInfo {
  name: string;
  bunzBalance: number;
  participationModel?: string;
}

export default function BusinessOffersPage() {
  const { showToast } = useToast();
  const [business, setBusiness] = useState<BusinessInfo | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [bunzCost, setBunzCost] = useState('30');
  const [stockTotal, setStockTotal] = useState('10');
  const [perUserLimit, setPerUserLimit] = useState('1');

  const load = useCallback(async () => {
    try {
      const headers = await PlatformBridge.getAuthHeaders().catch(() => null);
      const res = await fetch('/api/business/offers', { headers: headers || undefined, cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (data?.success) {
        setBusiness(data.business);
        setOffers(Array.isArray(data.offers) ? data.offers : []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    setSaving(true);
    try {
      const headers = await PlatformBridge.getAuthHeaders().catch(() => null);
      const res = await fetch('/api/business/offers', {
        method: 'POST',
        headers: { ...(headers || {}), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          bunzCost: Number(bunzCost),
          stockTotal: Number(stockTotal),
          perUserLimit: Number(perUserLimit),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        showToast(data?.error || 'No pudimos crear la oferta.', 'error');
        return;
      }
      showToast('Oferta publicada', 'success');
      setTitle('');
      await load();
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (offer: Offer) => {
    const headers = await PlatformBridge.getAuthHeaders().catch(() => null);
    const next = offer.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    const res = await fetch('/api/business/offers', {
      method: 'PATCH',
      headers: { ...(headers || {}), 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: offer.id, status: next }),
    });
    if (res.ok) {
      showToast(next === 'ACTIVE' ? 'Oferta activada' : 'Oferta pausada', 'success');
      await load();
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="m-0 text-[10px] font-black uppercase tracking-[0.22em] text-[#E91E63]">Stock</p>
          <h1 className="m-0 mt-1 text-2xl font-black">Tus ofertas</h1>
          <p className="m-0 mt-1 text-[12px] text-gray-500">
            Lo que un Rabbitter puede canjear con Bunz en tu negocio.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setLoading(true); void load(); }}
          className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-black text-gray-300"
        >
          <RefreshCw size={12} /> Actualizar
        </button>
      </div>

      {business && (
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-[#E91E63]/25 bg-[#E91E63]/10 px-3 py-2.5">
          <div>
            <p className="m-0 text-[10px] font-black uppercase tracking-wider text-[#E91E63]">Respaldo disponible</p>
            <p className="m-0 text-lg font-black text-white">
              {Number(business.bunzBalance).toLocaleString('es-MX')} Bunz
            </p>
          </div>
          <p className="m-0 max-w-[55%] text-right text-[10.5px] font-bold leading-snug text-gray-400">
            Solo se muestran los canjes que este respaldo puede honrar.
          </p>
        </div>
      )}

      <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="m-0 flex items-center gap-1.5 text-[12px] font-black text-white">
          <Plus size={14} /> Nueva oferta
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 80))}
            placeholder="Café de especialidad"
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none sm:col-span-2"
          />
          <label className="text-[10px] font-bold text-gray-400">
            Precio en Bunz
            <input
              value={bunzCost}
              onChange={(e) => setBunzCost(e.target.value.replace(/[^0-9]/g, ''))}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
            />
          </label>
          <label className="text-[10px] font-bold text-gray-400">
            Unidades
            <input
              value={stockTotal}
              onChange={(e) => setStockTotal(e.target.value.replace(/[^0-9]/g, ''))}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
            />
          </label>
          <label className="text-[10px] font-bold text-gray-400">
            Límite por persona
            <input
              value={perUserLimit}
              onChange={(e) => setPerUserLimit(e.target.value.replace(/[^0-9]/g, ''))}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => void create()}
            disabled={saving || title.trim().length < 3 || !Number(bunzCost) || !Number(stockTotal)}
            className="mt-4 self-end rounded-xl bg-[#E91E63] px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"
          >
            {saving ? 'Publicando…' : 'Publicar oferta'}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Cargando…</p>
      ) : offers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center">
          <Ticket className="mx-auto h-6 w-6 text-gray-500" />
          <p className="m-0 mt-2 text-sm font-black text-white">Aún no tienes ofertas</p>
          <p className="m-0 mt-1 text-[11.5px] text-gray-500">
            Publica la primera para aparecer en Stock y que puedan canjearte.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {offers.map((o) => (
            <div key={o.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <div className="min-w-0">
                <p className="m-0 truncate text-[13px] font-black text-white">{o.title}</p>
                <p className="m-0 mt-0.5 text-[11px] font-bold text-gray-400">
                  {o.bunzCost} Bunz · {o.stockUsed}/{o.stockTotal} usadas · {o.canjesDisponibles} disponibles
                  {o.redemptions?.RESERVED ? ` · ${o.redemptions.RESERVED} por validar` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void toggle(o)}
                className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black ${
                  o.status === 'ACTIVE' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-gray-400'
                }`}
              >
                {o.status === 'ACTIVE' ? <Pause size={10} /> : <Play size={10} />}
                {o.status === 'ACTIVE' ? 'Activa' : 'Pausada'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
