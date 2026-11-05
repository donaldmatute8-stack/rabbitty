'use client';

import { useCallback, useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import { BunzyUpdateCard } from '@/components/chat/BunzyUpdateCard';
import { PlatformBridge } from '@/lib/platform';

interface Comunicado {
  deliveryId: string;
  broadcastId: string;
  category: string;
  title: string;
  body: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
  createdAt: string;
  readAt: string | null;
  archivedAt: string | null;
  deliveryStatus: string;
}

type Filter = 'all' | 'unread' | 'archived';

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'unread', label: 'Sin leer' },
  { id: 'archived', label: 'Archivados' },
];

/**
 * Centro de comunicados oficiales de Rabbitty.
 *
 * Es el archivo de Bunzy Connect: lo que llega por el chat se puede consultar
 * aquí incluso después de pulsar "Entendido". El estado es por persona
 * (readAt / archivedAt en bunzyDeliveries), no un pin del chat.
 */
export default function ComunicadosPage() {
  const [items, setItems] = useState<Comunicado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async () => {
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch('/api/chat/bunzy-comunicados', { headers });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || 'No se pudieron cargar');
      setItems(Array.isArray(data.items) ? data.items : []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los comunicados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const acknowledge = async (deliveryId: string) => {
    const prev = items;
    setItems((list) =>
      list.map((c) =>
        c.deliveryId === deliveryId
          ? { ...c, archivedAt: new Date().toISOString(), readAt: c.readAt || new Date().toISOString() }
          : c,
      ),
    );
    PlatformBridge.hapticFeedback('light');
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch('/api/chat/bunzy-comunicados', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryId }),
      });
      if (!res.ok) throw new Error('archive failed');
      PlatformBridge.hapticFeedback('success');
    } catch {
      setItems(prev);
    }
  };

  const visible = items.filter((c) => {
    if (filter === 'unread') return !c.readAt && !c.archivedAt;
    if (filter === 'archived') return Boolean(c.archivedAt);
    return true;
  });

  const unread = items.filter((c) => !c.readAt && !c.archivedAt).length;

  return (
    <ProfileSubpageLayout
      title="Comunicados"
      centerTitle
      left={null}
    >
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-pink-500/25 bg-gradient-to-r from-pink-500/12 to-violet-500/10 p-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#FF2E93] to-[#8B5CF6]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/bunzy-avatar.png" alt="Bunzy" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0">
            <p className="m-0 text-[10px] font-black uppercase tracking-[0.18em] text-pink-300/80">
              Rabbitty oficial
            </p>
            <p className="m-0 mt-0.5 text-sm font-black text-(--text-primary)">
              Comunicados verificados de Bunzy
            </p>
          </div>
          {unread > 0 && (
            <span className="ml-auto shrink-0 rounded-full bg-[#E91E63] px-2 py-0.5 text-[10px] font-black text-white">
              {unread}
            </span>
          )}
        </div>

        <div className="mb-4 flex items-center gap-2 overflow-x-auto hide-scrollbar">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                PlatformBridge.hapticFeedback('light');
                setFilter(f.id);
              }}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                filter === f.id
                  ? 'border border-white/20 bg-white/10 text-(--text-primary)'
                  : 'text-(--text-muted)'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading && (
          <p className="py-10 text-center text-xs text-(--text-muted)">Cargando comunicados…</p>
        )}

        {!loading && error && (
          <p className="py-10 text-center text-xs text-rose-400">{error}</p>
        )}

        {!loading && !error && visible.length === 0 && (
          <div className="py-12 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/5">
              <Megaphone size={22} className="text-(--text-muted)" />
            </div>
            <p className="m-0 text-sm font-black text-(--text-primary)">Sin comunicados aquí</p>
            <p className="m-0 mt-1 text-xs text-(--text-muted)">
              Los avisos oficiales de Rabbitty llegarán a este archivo y al chat de Bunzy.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {visible.map((c) => (
            <BunzyUpdateCard
              key={c.deliveryId}
              archived={Boolean(c.archivedAt)}
              onAcknowledge={c.archivedAt ? undefined : () => void acknowledge(c.deliveryId)}
              message={{
                id: c.deliveryId,
                content: c.body,
                createdAt: c.createdAt,
                metadata: {
                  category: c.category,
                  title: c.title,
                  ctaLabel: c.ctaLabel,
                  ctaUrl: c.ctaUrl,
                  deliveryId: c.deliveryId,
                  broadcastId: c.broadcastId,
                  archivedAt: c.archivedAt,
                },
              }}
            />
          ))}
        </div>
      </div>
    </ProfileSubpageLayout>
  );
}
