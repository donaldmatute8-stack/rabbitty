"use client";

import { useMemo, useState } from "react";
import { trpc } from "../../../../lib/trpc-client";
import { Card, Button, toast } from "@rabbitty/ui";
import { Sparkles, Plus, Trash2, Pause, Play, Clock, Gift, Store } from "lucide-react";

const MOODS = [
  { id: "calm", label: "Calma", emoji: "🌿" },
  { id: "energy", label: "Energía", emoji: "⚡" },
  { id: "focus", label: "Enfoque", emoji: "🎯" },
  { id: "celebration", label: "Celebración", emoji: "🎉" },
  { id: "connection", label: "Conexión", emoji: "💞" },
  { id: "surprise", label: "Sorpresa", emoji: "✨" },
] as const;

type MoodId = (typeof MOODS)[number]["id"];

const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

const emptyForm = {
  businessId: "",
  title: "",
  description: "",
  targetMood: "calm" as MoodId,
  rewardBunz: 0,
  startHour: 0,
  endHour: 23,
};

export default function MoodCampaignsPage() {
  const utils = trpc.useUtils();
  const { data: biz } = trpc.mood.businesses.useQuery();
  const { data: campaigns, isLoading } = trpc.mood.listCampaigns.useQuery();

  const invalidate = () => utils.mood.listCampaigns.invalidate();
  const create = trpc.mood.createCampaign.useMutation({
    onSuccess: () => { invalidate(); toast.success("Campaña Mood creada"); setOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const toggle = trpc.mood.toggleCampaign.useMutation({ onSuccess: invalidate, onError: (e) => toast.error(e.message) });
  const remove = trpc.mood.deleteCampaign.useMutation({
    onSuccess: () => { invalidate(); toast.success("Campaña eliminada"); },
    onError: (e) => toast.error(e.message),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filterMood, setFilterMood] = useState<MoodId | "all">("all");

  const businesses = biz?.businesses ?? [];
  const visible = useMemo(
    () => (campaigns ?? []).filter((c) => filterMood === "all" || c.targetMood === filterMood),
    [campaigns, filterMood],
  );
  const activeCount = (campaigns ?? []).filter((c) => c.isActive).length;

  const openCreate = () => {
    setForm({ ...emptyForm, businessId: businesses[0]?.id ?? "" });
    setOpen(true);
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-linear-to-br from-gray-900/60 to-black/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-pink-500">
              <Sparkles className="h-3.5 w-3.5" /> Marketing · Rabbitty Mood
            </span>
            <h1 className="text-4xl font-black tracking-tight text-white">Campañas por Mood</h1>
            <p className="text-gray-400 mt-2 text-sm font-medium max-w-2xl">
              Activa promociones según el estado de ánimo de los Rabbitters y la hora. Aparecen en el panel Mood y en el mapa para quienes elijan ese mood.
            </p>
          </div>
          <Button onClick={openCreate} disabled={businesses.length === 0}>
            <Plus className="h-4 w-4" /> Nueva campaña
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-gray-950 border-white/10 p-5 rounded-2xl">
          <p className="text-xs font-bold uppercase text-gray-500">Campañas</p>
          <p className="text-3xl font-black text-white">{campaigns?.length ?? "…"}</p>
        </Card>
        <Card className="bg-gray-950 border-white/10 p-5 rounded-2xl">
          <p className="text-xs font-bold uppercase text-gray-500">Activas</p>
          <p className="text-3xl font-black text-emerald-400">{isLoading ? "…" : activeCount}</p>
        </Card>
        <Card className="bg-gray-950 border-white/10 p-5 rounded-2xl">
          <p className="text-xs font-bold uppercase text-gray-500">Negocios</p>
          <p className="text-3xl font-black text-white">{businesses.length}</p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {[{ id: "all", label: "Todos", emoji: "🌈" }, ...MOODS].map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setFilterMood(m.id as MoodId | "all")}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold border transition-colors cursor-pointer ${
              filterMood === m.id ? "bg-pink-500 border-pink-500 text-white" : "border-white/10 text-gray-400 hover:text-white"
            }`}
          >
            {m.emoji} {m.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {isLoading && <p className="text-gray-500 text-sm">Cargando…</p>}
        {!isLoading && visible.length === 0 && (
          <Card className="bg-gray-950 border-white/10 p-8 rounded-2xl text-center text-gray-400 text-sm">
            {businesses.length === 0
              ? "Aún no tienes negocios afiliados aprobados para asignar campañas."
              : "No hay campañas para este filtro. Crea la primera con “Nueva campaña”."}
          </Card>
        )}
        {visible.map((c) => {
          const mood = MOODS.find((m) => m.id === c.targetMood);
          return (
            <Card key={c.id} className={`bg-gray-950 border-white/10 p-5 rounded-2xl flex flex-col md:flex-row md:items-center gap-4 ${c.isActive ? "" : "opacity-60"}`}>
              <div className="text-3xl">{mood?.emoji ?? "✨"}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-extrabold text-white">{c.title}</h3>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-white/5 text-gray-300">{mood?.label}</span>
                  {!c.isActive && <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">Pausada</span>}
                </div>
                {c.description && <p className="text-sm text-gray-400 mt-1">{c.description}</p>}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><Store className="h-3.5 w-3.5" />{c.businessName}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{hh(c.startHour)}–{hh(c.endHour)}</span>
                  <span className="flex items-center gap-1"><Gift className="h-3.5 w-3.5" />{c.rewardBunz} BUNZ</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => toggle.mutate({ id: c.id, businessId: c.businessId, isActive: !c.isActive })}>
                  {c.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {c.isActive ? "Pausar" : "Activar"}
                </Button>
                <Button
                  variant="danger"
                  onClick={() => { if (window.confirm(`¿Eliminar “${c.title}”?`)) remove.mutate({ id: c.id, businessId: c.businessId }); }}
                >
                  <Trash2 className="h-4 w-4 text-red-400" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-lg rounded-3xl border border-white/10 bg-gray-950 p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-black text-white">Nueva campaña Mood</h2>

            <label className="block text-xs font-bold text-gray-400">
              Negocio
              <select
                value={form.businessId}
                onChange={(e) => setForm({ ...form, businessId: e.target.value })}
                className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white"
              >
                {businesses.map((b) => <option key={b.id} value={b.id} className="bg-gray-900">{b.name}</option>)}
              </select>
            </label>

            <div>
              <p className="text-xs font-bold text-gray-400 mb-1">Mood objetivo</p>
              <div className="flex flex-wrap gap-2">
                {MOODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setForm({ ...form, targetMood: m.id })}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold border cursor-pointer ${
                      form.targetMood === m.id ? "bg-pink-500 border-pink-500 text-white" : "border-white/10 text-gray-400"
                    }`}
                  >
                    {m.emoji} {m.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="block text-xs font-bold text-gray-400">
              Título
              <input
                value={form.title}
                maxLength={80}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ej. Pausa Tranquila 2x1 en café"
                className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white"
              />
            </label>
            <label className="block text-xs font-bold text-gray-400">
              Descripción (opcional)
              <textarea
                value={form.description}
                maxLength={240}
                rows={2}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white"
              />
            </label>

            <div className="grid grid-cols-3 gap-3">
              <label className="block text-xs font-bold text-gray-400">
                Desde
                <select value={form.startHour} onChange={(e) => setForm({ ...form, startHour: Number(e.target.value) })} className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-2 py-2.5 text-sm text-white">
                  {Array.from({ length: 24 }, (_, h) => <option key={h} value={h} className="bg-gray-900">{hh(h)}</option>)}
                </select>
              </label>
              <label className="block text-xs font-bold text-gray-400">
                Hasta
                <select value={form.endHour} onChange={(e) => setForm({ ...form, endHour: Number(e.target.value) })} className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-2 py-2.5 text-sm text-white">
                  {Array.from({ length: 24 }, (_, h) => <option key={h} value={h} className="bg-gray-900">{hh(h)}</option>)}
                </select>
              </label>
              <label className="block text-xs font-bold text-gray-400">
                Bonus BUNZ
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={form.rewardBunz}
                  onChange={(e) => setForm({ ...form, rewardBunz: Math.max(0, Math.min(1000, Number(e.target.value) || 0)) })}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white"
                />
              </label>
            </div>
            <p className="text-[11px] text-gray-500">El bonus BUNZ se muestra al Rabbitter; el acreditado automático por visita aún no está activo.</p>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button
                disabled={!form.businessId || !form.title.trim() || create.isPending}
                onClick={() => create.mutate({ ...form, description: form.description || undefined })}
              >
                {create.isPending ? "Creando…" : "Crear campaña"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
