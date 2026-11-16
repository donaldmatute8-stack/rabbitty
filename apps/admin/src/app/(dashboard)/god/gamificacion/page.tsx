"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Gamepad2, RefreshCw, Plus, Sparkles, Trash2, Power, Pencil, Award } from "lucide-react";
import { Card, Button, Input, cn, toast } from "@rabbitty/ui";

interface Trick { id: string; title: string; description: string; rewardHops: number; rewardBunz: number; conditionType: string; conditionTarget: number; isActive: boolean }
interface Level { id: string; name?: string; level?: number; requiredHops: number; bunzMultiplier: number }
interface Achievement {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  conditionType: string;
  conditionTarget: number;
}

async function godQuery<T>(proc: string, input?: unknown, isMutation = false): Promise<T> {
  const url = `/api/trpc/${proc}?batch=1`;
  if (!isMutation) {
    const u = new URL(url);
    u.searchParams.set("input", JSON.stringify({ "0": { json: input ?? null } }));
    const r = await fetch(u.toString());
    const data = await r.json();
    if (data?.[0]?.error) throw new Error(data[0].error.message);
    return data?.[0]?.result?.data?.json as T;
  }
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ "0": { json: input } }),
  });
  const data = await r.json();
  if (data?.[0]?.error) throw new Error(data[0].error.message);
  return data?.[0]?.result?.data?.json as T;
}

export default function GodGamificacionPage() {
  const [tricks, setTricks] = useState<Trick[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [achievementsList, setAchievementsList] = useState<Achievement[]>([]);
  const [achForm, setAchForm] = useState({ name: "", description: "", iconUrl: "/icons/first-visit.png", conditionType: "VISITS", conditionTarget: "1" });
  const [showAchForm, setShowAchForm] = useState(false);
  const [editingTrick, setEditingTrick] = useState<string | null>(null);
  const [trickDraft, setTrickDraft] = useState({ title: "", rewardHops: "0", rewardBunz: "0", conditionTarget: "1" });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", rewardHops: "100", rewardBunz: "50", conditionTarget: "1" });
  // Flags de producto (visibilidad de features en el móvil)
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [savingFlag, setSavingFlag] = useState<string | null>(null);

  const toggleFlag = async (key: "vibe_passport_enabled", enabled: boolean) => {
    setSavingFlag(key);
    try {
      await godQuery("god.setAppFlag", { key, enabled }, true);
      setFlags((f) => ({ ...f, [key]: enabled }));
      toast.success(enabled ? "✅ Activado — visible en la app" : "Oculto en la app");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar el flag");
    } finally { setSavingFlag(null); }
  };

  const load = async () => {
    setLoading(true);
    try {
      const d = await godQuery<{ levels: Level[]; tricks: Trick[]; achievements?: Achievement[] }>("god.getGamification");
      setTricks(d.tricks || []); setLevels(d.levels || []); setAchievementsList(d.achievements || []);
      const f = await godQuery<{ vibe_passport_enabled: boolean }>("god.getAppFlags");
      setFlags({ vibe_passport_enabled: Boolean(f?.vibe_passport_enabled) });
    } catch { /* noop */ } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const createTrick = async () => {
    if (!form.title.trim()) { toast.error("Título requerido"); return; }
    setSaving(true);
    try {
      await godQuery("god.createHatTrick", {
        title: form.title.trim(),
        description: form.description.trim() || "Truco especial",
        rewardHops: Number(form.rewardHops) || 0,
        rewardBunz: Number(form.rewardBunz) || 0,
        conditionType: "TOTAL_VISITS",
        conditionTarget: Number(form.conditionTarget) || 1,
      }, true);
      toast.success("🪄 Truco creado");
      setShowForm(false);
      setForm({ title: "", description: "", rewardHops: "100", rewardBunz: "50", conditionTarget: "1" });
      await load();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Error"); } finally { setSaving(false); }
  };

  const toggleTrick = async (t: Trick) => {
    try {
      await godQuery("god.updateHatTrick", { id: t.id, isActive: !t.isActive }, true);
      toast.success(t.isActive ? "Misión desactivada" : "Misión activada");
      await load();
    } catch { toast.error("No se pudo cambiar el estado"); }
  };

  const deleteTrick = async (t: Trick) => {
    if (!window.confirm(`¿Borrar la misión "${t.title}"?`)) return;
    try {
      await godQuery("god.deleteHatTrick", { id: t.id }, true);
      toast.success("Misión borrada");
      await load();
    } catch { toast.error("No se pudo borrar"); }
  };

  const saveTrick = async (t: Trick) => {
    try {
      await godQuery("god.updateHatTrick", {
        id: t.id,
        title: trickDraft.title.trim() || t.title,
        rewardHops: Number(trickDraft.rewardHops) || 0,
        rewardBunz: Number(trickDraft.rewardBunz) || 0,
        conditionTarget: Number(trickDraft.conditionTarget) || 1,
      }, true);
      toast.success("Misión actualizada");
      setEditingTrick(null);
      await load();
    } catch { toast.error("No se pudo guardar"); }
  };

  const createAchievement = async () => {
    if (!achForm.name.trim()) { toast.error("Nombre requerido"); return; }
    try {
      await godQuery("god.createAchievement", {
        name: achForm.name.trim(),
        description: achForm.description.trim() || achForm.name.trim(),
        iconUrl: achForm.iconUrl.trim() || "/icons/first-visit.png",
        conditionType: achForm.conditionType.trim() || "VISITS",
        conditionTarget: Number(achForm.conditionTarget) || 1,
      }, true);
      toast.success("Logro creado");
      setShowAchForm(false);
      setAchForm({ name: "", description: "", iconUrl: "/icons/first-visit.png", conditionType: "VISITS", conditionTarget: "1" });
      await load();
    } catch { toast.error("No se pudo crear el logro"); }
  };

  const deleteAchievement = async (a: Achievement) => {
    if (!window.confirm(`¿Borrar el logro "${a.name}"?`)) return;
    try {
      await godQuery("god.deleteAchievement", { id: a.id }, true);
      toast.success("Logro borrado");
      await load();
    } catch { toast.error("No se pudo borrar"); }
  };

  const updateLevel = async (id: string, multiplier: number, hops: number) => {
    try {
      await godQuery("god.updateLevel", { id, bunzMultiplier: multiplier, requiredHops: hops }, true);
      toast.success("📈 Nivel actualizado");
      await load();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Error"); }
  };

  return (
    <div className="min-h-screen bg-[#050508] p-6 lg:p-10">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-purple-500/15 border border-purple-500/30"><Gamepad2 className="h-7 w-7 text-purple-400" /></div>
          <div>
            <h1 className="text-2xl font-black text-white">Gamificación Global</h1>
            <p className="text-xs text-gray-400">Trucos del Sombrero (misiones) y Niveles con multiplicador de Bunz</p>
          </div>
          <Button variant="secondary" onClick={() => void load()} className="ml-auto rounded-xl bg-white/5 border border-white/10 text-gray-200 text-xs font-bold cursor-pointer">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Flags de producto — lo que se ve en la app móvil */}
        <Card className="p-5 border border-white/10 bg-white/5">
          <h2 className="text-sm font-black text-white uppercase tracking-wider pb-1">🎛️ Visibilidad en la app</h2>
          <p className="text-[11px] text-gray-400 pb-3">
            Activa features cuando haya masa crítica. Apagado = invisible para los Rabbitters (sin redeploy).
          </p>
          <div className="flex items-center justify-between gap-4 px-3 py-3 rounded-xl bg-black/40 border border-white/5">
            <div className="min-w-0">
              <p className="text-[12px] font-black text-gray-100">Rabbitty Vibe Passport</p>
              <p className="text-[11px] text-gray-500">
                Banner en el home + rutas temáticas en Explorar. Recomendado: activarlo con 10+ aliados.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!!flags.vibe_passport_enabled}
              aria-label="Activar Rabbitty Vibe Passport"
              disabled={savingFlag === "vibe_passport_enabled"}
              onClick={() => void toggleFlag("vibe_passport_enabled", !flags.vibe_passport_enabled)}
              className={`relative shrink-0 w-12 h-6.5 rounded-full transition-colors cursor-pointer disabled:opacity-50 ${
                flags.vibe_passport_enabled ? "bg-emerald-500" : "bg-white/15"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5.5 w-5.5 rounded-full bg-white shadow transition-all ${
                  flags.vibe_passport_enabled ? "left-6" : "left-0.5"
                }`}
              />
            </button>
          </div>
        </Card>

        {/* Trucos */}
        <Card className="p-5 border border-white/10 bg-white/5">
          <div className="flex items-center justify-between pb-3">
            <h2 className="text-sm font-black text-white uppercase tracking-wider">🪄 Trucos del Sombrero ({tricks.length})</h2>
            <Button onClick={() => setShowForm(!showForm)} className="rounded-xl px-3 py-1.5 text-[11px] font-black bg-pink-600 text-white cursor-pointer">
              <Plus className="h-3.5 w-3.5 mr-1" /> Nuevo
            </Button>
          </div>
          {showForm && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2 pb-4">
              <Input placeholder="Título" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="bg-black/50 border-white/10 text-white text-xs h-9 lg:col-span-2" />
              <Input placeholder="Hops" inputMode="numeric" value={form.rewardHops} onChange={(e) => setForm({ ...form, rewardHops: e.target.value.replace(/\D/g, "") })} className="bg-black/50 border-white/10 text-white text-xs h-9" />
              <Input placeholder="Bunz" inputMode="numeric" value={form.rewardBunz} onChange={(e) => setForm({ ...form, rewardBunz: e.target.value.replace(/\D/g, "") })} className="bg-black/50 border-white/10 text-white text-xs h-9" />
              <Button onClick={createTrick} disabled={saving} className="rounded-lg h-9 text-[11px] font-black bg-linear-to-r from-pink-600 to-purple-600 text-white cursor-pointer">
                {saving ? "..." : "Guardar"}
              </Button>
            </div>
          )}
          <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
            {tricks.map((t) => (
              <div key={t.id} className="rounded-lg bg-black/40 border border-white/5 text-[11px]">
                <div className="flex items-center justify-between px-3 py-2 gap-2">
                  <div className="min-w-0">
                    <p className={cn("font-black truncate", t.isActive ? "text-gray-200" : "text-gray-500 line-through")}>{t.title}</p>
                    <p className="text-gray-500 truncate">{t.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-amber-400 font-black">+{t.rewardBunz} Bunz · +{t.rewardHops} Hops</span>
                    <button type="button" title="Editar" onClick={() => { setEditingTrick(t.id); setTrickDraft({ title: t.title, rewardHops: String(t.rewardHops), rewardBunz: String(t.rewardBunz), conditionTarget: String(t.conditionTarget) }); }} className="text-gray-400 hover:text-white"><Pencil className="h-3.5 w-3.5" /></button>
                    <button type="button" title={t.isActive ? "Desactivar" : "Activar"} onClick={() => void toggleTrick(t)} className={t.isActive ? "text-emerald-400" : "text-gray-500"}><Power className="h-3.5 w-3.5" /></button>
                    <button type="button" title="Borrar" onClick={() => void deleteTrick(t)} className="text-rose-400/80 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                {editingTrick === t.id && (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2 px-3 pb-3">
                    <Input value={trickDraft.title} onChange={(e) => setTrickDraft({ ...trickDraft, title: e.target.value })} className="bg-black/50 border-white/10 text-white text-xs h-8 lg:col-span-2" />
                    <Input value={trickDraft.rewardHops} onChange={(e) => setTrickDraft({ ...trickDraft, rewardHops: e.target.value.replace(/\D/g, "") })} placeholder="Hops" className="bg-black/50 border-white/10 text-white text-xs h-8" />
                    <Input value={trickDraft.rewardBunz} onChange={(e) => setTrickDraft({ ...trickDraft, rewardBunz: e.target.value.replace(/\D/g, "") })} placeholder="Bunz" className="bg-black/50 border-white/10 text-white text-xs h-8" />
                    <Button onClick={() => void saveTrick(t)} className="rounded-lg h-8 text-[11px] font-black bg-pink-600 text-white cursor-pointer">Guardar</Button>
                  </div>
                )}
              </div>
            ))}
            {!loading && tricks.length === 0 && <p className="text-xs text-gray-500 py-2">Sin trucos aún</p>}
          </div>
        </Card>

        {/* Niveles */}
        <Card className="p-5 border border-white/10 bg-white/5">
          <h2 className="text-sm font-black text-white uppercase tracking-wider pb-3">📈 Niveles & Multiplicadores</h2>
          <div className="space-y-2">
            {levels.map((l, i) => (
              <LevelRow key={l.id} level={l} index={i} onSave={updateLevel} />
            ))}
            {!loading && levels.length === 0 && <p className="text-xs text-gray-500 py-2">Sin niveles configurados</p>}
          </div>
        </Card>

        {/* Logros */}
        <Card className="p-5 border border-white/10 bg-white/5">
          <div className="flex items-center justify-between pb-3">
            <h2 className="text-sm font-black text-white uppercase tracking-wider">🏅 Logros ({achievementsList.length})</h2>
            <Button onClick={() => setShowAchForm(!showAchForm)} className="rounded-xl px-3 py-1.5 text-[11px] font-black bg-pink-600 text-white cursor-pointer">
              <Plus className="h-3.5 w-3.5 mr-1" /> Nuevo
            </Button>
          </div>
          {showAchForm && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2 pb-4">
              <Input placeholder="Nombre" value={achForm.name} onChange={(e) => setAchForm({ ...achForm, name: e.target.value })} className="bg-black/50 border-white/10 text-white text-xs h-9 lg:col-span-2" />
              <Input placeholder="Descripción" value={achForm.description} onChange={(e) => setAchForm({ ...achForm, description: e.target.value })} className="bg-black/50 border-white/10 text-white text-xs h-9 lg:col-span-2" />
              <Input placeholder="Meta (n)" inputMode="numeric" value={achForm.conditionTarget} onChange={(e) => setAchForm({ ...achForm, conditionTarget: e.target.value.replace(/\D/g, "") })} className="bg-black/50 border-white/10 text-white text-xs h-9" />
              <Button onClick={() => void createAchievement()} className="rounded-lg h-9 text-[11px] font-black bg-linear-to-r from-pink-600 to-purple-600 text-white cursor-pointer lg:col-span-5">Guardar logro</Button>
            </div>
          )}
          <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
            {achievementsList.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-black/40 border border-white/5 text-[11px]">
                <div className="flex items-center gap-2 min-w-0">
                  <Award className="h-4 w-4 text-amber-300 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-black text-gray-200 truncate">{a.name}</p>
                    <p className="text-gray-500 truncate">{a.description} · {a.conditionType} {a.conditionTarget}</p>
                  </div>
                </div>
                <button type="button" title="Borrar" onClick={() => void deleteAchievement(a)} className="text-rose-400/80 hover:text-rose-300 shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
            {!loading && achievementsList.length === 0 && <p className="text-xs text-gray-500 py-2">Sin logros aún</p>}
          </div>
        </Card>

        <div className="flex items-center gap-2 text-[10px] text-gray-600">
          <Sparkles className="h-3.5 w-3.5" />
          Cambios aplican al instante para todos los Rabbitters (config global en systemSettings/DB)
        </div>
      </motion.div>
    </div>
  );
}

function LevelRow({ level, index, onSave }: { level: Level; index: number; onSave: (id: string, m: number, h: number) => void }) {
  const [mult, setMult] = useState(String(level.bunzMultiplier ?? 1));
  const [hops, setHops] = useState(String(level.requiredHops ?? 0));
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-black/40 border border-white/5">
      <span className="text-[11px] font-black text-purple-300 w-16">{level.name ?? `Nivel ${index + 1}`}</span>
      <Input value={hops} onChange={(e) => setHops(e.target.value.replace(/\D/g, ""))} className="w-24 bg-black/60 border-white/10 text-white text-[11px] h-8" placeholder="Hops" />
      <span className="text-[10px] text-gray-500">hops →</span>
      <Input value={mult} onChange={(e) => setMult(e.target.value)} className="w-20 bg-black/60 border-white/10 text-white text-[11px] h-8" placeholder="x" />
      <span className="text-[10px] text-gray-500">× Bunz</span>
      <Button onClick={() => onSave(level.id, Number(mult) || 1, Number(hops) || 0)} className="ml-auto rounded-lg px-3 py-1 text-[10px] font-black bg-white/10 text-gray-200 hover:bg-white/20 cursor-pointer">
        Guardar
      </Button>
    </div>
  );
}
