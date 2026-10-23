'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Trash2, Plus } from 'lucide-react';
import { MOOD_DEFINITIONS, MoodType } from '@/types/mood';
import { PlatformBridge } from '@/lib/platform';

interface Campaign {
  id: string;
  title: string;
  description: string | null;
  targetMood: string;
  rewardBunz: number;
  startHour: number;
  endHour: number;
  isActive: boolean;
  matches30d?: number;
}

const MOODS = Object.keys(MOOD_DEFINITIONS) as MoodType[];

export function MoodCampaignsManager({ businessId }: { businessId?: string }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    targetMood: 'focus' as MoodType,
    title: '',
    description: '',
    rewardBunz: 0,
    startHour: 0,
    endHour: 23,
  });

  const [reloadKey, setReloadKey] = useState(0);
  const load = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    if (!businessId) return;
    let cancelled = false;
    (async () => {
      try {
        const headers = await PlatformBridge.getAuthHeaders();
        const res = await fetch(`/api/business/mood-campaigns?businessId=${businessId}`, { headers });
        const data = await res.json();
        if (!cancelled && data.success) setCampaigns(data.campaigns);
      } catch {
        if (!cancelled) setError('No se pudieron cargar las campañas.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [businessId, reloadKey]);

  const request = async (method: string, body?: unknown, query = '') => {
    const headers = await PlatformBridge.getAuthHeaders();
    const res = await fetch(`/api/business/mood-campaigns${query}`, {
      method,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Error');
    return data;
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId || !form.title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await request('POST', { businessId, ...form });
      setForm((f) => ({ ...f, title: '', description: '', rewardBunz: 0 }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la campaña');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (c: Campaign) => {
    try {
      await request('PATCH', { businessId, id: c.id, isActive: !c.isActive });
      await load();
    } catch { setError('No se pudo actualizar la campaña.'); }
  };

  const remove = async (c: Campaign) => {
    try {
      await request('DELETE', undefined, `?businessId=${businessId}&id=${c.id}`);
      await load();
    } catch { setError('No se pudo eliminar la campaña.'); }
  };

  if (!businessId) return null;

  const inputCls = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-pink-400';

  return (
    <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-1">
        <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-pink-100 text-pink-600">
          <Sparkles size={15} />
        </span>
        <h3 className="font-extrabold text-gray-900 text-base m-0">Campañas por Mood</h3>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Cuando un Rabbitter elige un mood, tu local aparece como recomendación si tienes una campaña para ese mood.
      </p>

      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

      <div className="space-y-2 mb-5">
        {loading ? (
          <p className="text-xs text-gray-400">Cargando…</p>
        ) : campaigns.length === 0 ? (
          <p className="text-xs text-gray-400">Aún no tienes campañas. Crea la primera abajo.</p>
        ) : (
          campaigns.map((c) => {
            const def = MOOD_DEFINITIONS[c.targetMood as MoodType];
            return (
              <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-gray-100 p-3">
                <span className="text-xl">{def?.emoji ?? '✨'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate m-0">{c.title}</p>
                  <p className="text-[11px] text-gray-500 m-0">
                    {def?.label ?? c.targetMood} · {c.startHour}:00–{c.endHour}:59
                    {c.rewardBunz > 0 && ` · +${c.rewardBunz} BUNZ`}
                    {typeof c.matches30d === 'number' && ` · 🎯 ${c.matches30d} coincidencias`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(c)}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-full border-none cursor-pointer ${c.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}
                >
                  {c.isActive ? 'Activa' : 'Pausada'}
                </button>
                <button
                  type="button"
                  onClick={() => remove(c)}
                  aria-label="Eliminar campaña"
                  className="text-gray-400 hover:text-red-500 bg-transparent border-none cursor-pointer p-1"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={create} className="grid grid-cols-2 gap-3">
        <select
          className={`${inputCls} col-span-2`}
          value={form.targetMood}
          onChange={(e) => setForm({ ...form, targetMood: e.target.value as MoodType })}
        >
          {MOODS.map((m) => (
            <option key={m} value={m}>{MOOD_DEFINITIONS[m].emoji} {MOOD_DEFINITIONS[m].label}</option>
          ))}
        </select>
        <input
          className={`${inputCls} col-span-2`}
          placeholder="Título (ej. Pausa Tranquila)"
          maxLength={80}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
        />
        <input
          className={`${inputCls} col-span-2`}
          placeholder="Descripción corta (opcional)"
          maxLength={240}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <label className="text-[11px] text-gray-500 font-semibold">
          Desde (hora)
          <input type="number" min={0} max={23} className={inputCls} value={form.startHour}
            onChange={(e) => setForm({ ...form, startHour: Number(e.target.value) })} />
        </label>
        <label className="text-[11px] text-gray-500 font-semibold">
          Hasta (hora)
          <input type="number" min={0} max={23} className={inputCls} value={form.endHour}
            onChange={(e) => setForm({ ...form, endHour: Number(e.target.value) })} />
        </label>
        <label className="text-[11px] text-gray-500 font-semibold col-span-2">
          Bonus BUNZ por visita (opcional)
          <input type="number" min={0} max={1000} className={inputCls} value={form.rewardBunz}
            onChange={(e) => setForm({ ...form, rewardBunz: Number(e.target.value) })} />
        </label>
        <button
          type="submit"
          disabled={saving || !form.title.trim()}
          className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-pink-600 text-white text-sm font-bold py-2.5 border-none cursor-pointer disabled:opacity-50"
        >
          <Plus size={16} /> {saving ? 'Guardando…' : 'Crear campaña'}
        </button>
      </form>
    </div>
  );
}
