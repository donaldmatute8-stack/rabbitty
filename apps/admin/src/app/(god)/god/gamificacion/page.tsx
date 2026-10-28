"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Gamepad2, RefreshCw, Plus, Sparkles } from "lucide-react";
import { Card, Button, Input, cn, toast } from "@rabbitty/ui";

interface Trick { id: string; title: string; description: string; rewardHops: number; rewardBunz: number; conditionType: string; conditionTarget: number; isActive: boolean }
interface Level { id: string; name?: string; level?: number; requiredHops: number; bunzMultiplier: number }

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
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", rewardHops: "100", rewardBunz: "50", conditionTarget: "1" });

  const load = async () => {
    setLoading(true);
    try {
      const d = await godQuery<{ levels: Level[]; tricks: Trick[] }>("god.getGamification");
      setTricks(d.tricks || []); setLevels(d.levels || []);
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
              <div key={t.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-black/40 border border-white/5 text-[11px]">
                <div className="min-w-0">
                  <p className="font-black text-gray-200 truncate">{t.title}</p>
                  <p className="text-gray-500 truncate">{t.description}</p>
                </div>
                <span className="text-amber-400 font-black shrink-0">+{t.rewardBunz} Bunz · +{t.rewardHops} Hops</span>
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
