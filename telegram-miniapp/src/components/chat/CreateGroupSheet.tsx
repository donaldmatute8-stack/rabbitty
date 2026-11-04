"use client";

/**
 * ── CreateGroupSheet ── crea un grupo de Rabbitters.
 *
 * Nace `kind=GROUP`, `audience=PEER`: privacidad de Rabbitters (E2E es fase
 * posterior), sin métricas del negocio y sin aparecer en el inbox del admin.
 *
 * Busca personas en /api/contacts?q= y permite marcar varias.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Search, Check, Users } from 'lucide-react';
import { PlatformBridge } from '@/lib/platform';
import { useToast } from '@/contexts/ToastContext';

interface Candidate {
  id: string;
  name: string;
  username?: string | null;
  role?: string | null;
}

export function CreateGroupSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const headers = await PlatformBridge.getAuthHeaders();
        const res = await fetch(`/api/contacts?q=${encodeURIComponent(query)}`, { headers });
        const data = await res.json().catch(() => null);
        if (alive && data?.success) {
          const list: Candidate[] = (data.users || data.contacts || [])
            .filter((u: Candidate) => (u.role ?? '') !== 'AFFILIATE')
            .slice(0, 20);
          setCandidates(list);
        }
      } catch { /* noop */ } finally { if (alive) setLoading(false); }
    }, 250);
    return () => { alive = false; clearTimeout(timer); };
  }, [open, query]);

  useEffect(() => {
    if (!open) { setName(''); setQuery(''); setSelected([]); setCandidates([]); }
  }, [open]);

  if (!open) return null;

  const toggle = (id: string) => {
    PlatformBridge.hapticFeedback('light');
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const create = async () => {
    if (!name.trim() || selected.length === 0 || busy) return;
    setBusy(true);
    PlatformBridge.hapticFeedback('medium');
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch('/api/chat/groups', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), memberIds: selected }),
      });
      const data = await res.json().catch(() => null);
      if (data?.success && data.group?.id) {
        showToast('Grupo creado 🐰', 'success');
        onClose();
        router.push(`/chat/${data.group.id}`);
      } else {
        showToast(data?.error || 'No se pudo crear el grupo', 'error');
      }
    } catch {
      showToast('No se pudo crear el grupo', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl border-t border-white/10 bg-[#141418] p-4 pb-[calc(16px+env(safe-area-inset-bottom,0px))]"
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30">
              <Users size={17} />
            </div>
            <div>
              <p className="m-0 text-sm font-black text-white">Nuevo grupo</p>
              <p className="m-0 text-[11px] text-white/50">Solo Rabbitters · privado</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre del grupo"
          maxLength={60}
          className="mb-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white placeholder-white/35 outline-none focus:border-pink-500/60"
        />

        <div className="relative mb-2">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar personas por nombre, @usuario o teléfono"
            className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 pl-9 pr-3 text-sm text-white placeholder-white/35 outline-none focus:border-pink-500/60"
          />
        </div>

        <div className="max-h-56 overflow-y-auto">
          {loading && <p className="py-3 text-center text-xs text-white/40">Buscando…</p>}
          {!loading && candidates.length === 0 && (
            <p className="py-3 text-center text-xs text-white/40">Sin resultados</p>
          )}
          {candidates.map((c) => {
            const on = selected.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-white/5"
              >
                <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${on ? 'border-pink-500 bg-pink-500 text-white' : 'border-white/25 text-transparent'}`}>
                  <Check size={13} strokeWidth={3} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-white">{c.name}</span>
                  {c.username && <span className="block truncate text-[11px] text-white/45">@{c.username}</span>}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="flex-1 text-[11px] text-white/45">
            {selected.length === 0 ? 'Elige al menos una persona' : `${selected.length} seleccionado${selected.length > 1 ? 's' : ''}`}
          </span>
          <button
            type="button"
            onClick={() => void create()}
            disabled={busy || !name.trim() || selected.length === 0}
            className="rounded-full px-5 py-2.5 text-[13px] font-black text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#FF2E93,#E11D74)' }}
          >
            {busy ? 'Creando…' : 'Crear grupo'}
          </button>
        </div>
      </div>
    </div>
  );
}
